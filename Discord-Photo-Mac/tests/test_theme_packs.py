import base64,hashlib,importlib.util,json,os,shutil,stat,struct,subprocess,tempfile,unittest,zipfile,zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pack',ROOT/'validate-pack.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
def chunk(tag,data): return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
PNG=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\0\x20\x60\x90'))+chunk(b'IEND',b'')
def fixture():return {'theme.json':json.dumps({'schemaVersion':1,'id':'test-theme','name':'Test','image':'background.png','appearance':'dark','colors':{'accent':'#40cddd'}}).encode(),'theme.css':b'[data-ds-part="sidebar"] { border-radius: 12px; }','background.png':PNG}
class Tests(unittest.TestCase):
 def setUp(self): self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
 def tearDown(self):self.temp.cleanup()
 def archive(self,files,folder=''):
  out=self.root/'pack.zip'
  with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
   for n,d in files.items():z.writestr(folder+n,d)
  return out
 def bad(self,files):
  with self.assertRaises(Exception):pack.read_package(self.archive(files))
 def test_simple_and_wrapper(self):
  for folder in ('','one/'):
   self.assertEqual(pack.read_package(self.archive(fixture(),folder))['background.png'],PNG)
 def test_manifest(self):
  f=fixture();m={'packageVersion':1,'skinApiVersion':1,'themeId':'test-theme','minClientVersion':'1.5.9','platforms':['macos'],'capabilities':['background','tokens','safe-css'],'files':[{'path':n,'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest(),'mediaType':'application/json' if n.endswith('json') else 'text/css' if n.endswith('css') else 'image/png'} for n,d in f.items()]}
  f['manifest.json']=json.dumps(m).encode();self.assertIn('manifest.json',pack.read_package(self.archive(f)))
  f['theme.css']+=b' ';self.bad(f)
 def test_missing_empty_css(self):
  f=fixture();del f['theme.css'];self.bad(f);f['theme.css']=b'';self.bad(f)
 def test_unknown_nested_traversal(self):
  for n in ('../outside','/absolute','a/b/c','evil.js','other.zip','a\\b'):
   f=fixture();f[n]=b'x';self.bad(f)
 def test_duplicate_path(self):
  p=self.archive(fixture())
  with zipfile.ZipFile(p,'a') as z:z.writestr('theme.css',b'x')
  with self.assertRaises(Exception):pack.read_package(p)
 def test_links(self):
  p=self.archive(fixture())
  with zipfile.ZipFile(p,'a') as z:
   e=zipfile.ZipInfo('link');e.create_system=3;e.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(e,b'/tmp')
  with self.assertRaises(Exception):pack.read_package(p)
 def test_ambiguous_root(self):
  f=fixture();f['one/extra']=b'x';self.bad(f)
 def test_count_and_compression(self):
  f=fixture();f.update({str(i):b'x' for i in range(33)});self.bad(f)
  f=fixture();f['LICENSE.txt']=b'0'*(2*1024**2);self.bad(f)
 def test_duplicate_json(self):
  f=fixture();f['theme.json']=b'{"schemaVersion":1,"schemaVersion":1}';self.bad(f)
 def test_folder_symlink(self):
  d=self.root/'folder';d.mkdir()
  for n,b in fixture().items():(d/n).write_bytes(b)
  (d/'background.png').unlink();(d/'background.png').symlink_to('/tmp')
  with self.assertRaises(Exception):pack.read_package(d)
 def test_safe_css_and_decode(self):
  for css in (b'@import url(https://example.com);',b'[data-ds-part="root"]{position:fixed;}',b'body{color:red;}',b'[data-ds-part="root"]{background-color:url(https://example.com);} '):
   f=fixture();f['theme.css']=css;p=self.archive(f)
   r=subprocess.run(['node','--input-type=module','-e','import {loadPack} from '+json.dumps(str(ROOT/'theme-packs.mjs'))+';loadPack(process.argv[1]);',str(p)],capture_output=True)
   self.assertNotEqual(r.returncode,0)
  p=self.archive(fixture())
  r=subprocess.run(['node','--input-type=module','-e','import {loadPack} from '+json.dumps(str(ROOT/'theme-packs.mjs'))+';console.log(loadPack(process.argv[1]).theme.id);',str(p)],capture_output=True,text=True)
  self.assertEqual(r.returncode,0,r.stderr);self.assertIn('test-theme',r.stdout)
 def test_import_and_export_roundtrip(self):
  app=self.root/'app';shutil.copytree(ROOT,app,ignore=shutil.ignore_patterns('.discord-photo-runtime','.local-evidence','tests','__pycache__'))
  script=str(app/'DiscordPhoto.mjs');archive=self.archive(fixture())
  def cli(*args):return subprocess.run(['node',script,*map(str,args)],capture_output=True,text=True)
  r=cli('theme-import',archive);self.assertEqual(r.returncode,0,r.stderr)
  active=app/'.discord-photo-runtime/photo.json';self.assertFalse(active.exists())
  self.assertEqual(cli('theme-use','test-theme').returncode,0)
  before=active.read_bytes();self.assertEqual(cli('theme-import',archive).returncode,0);self.assertEqual(active.read_bytes(),before)
  out=self.root/'own.zip';r=cli('theme-export',out);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(pack.parse(pack.read_package(out)['theme.json'])['id'],'test-theme')
  f=fixture();f['theme.css']=b'body{display:none;}';r=cli('theme-import',self.archive(f));self.assertNotEqual(r.returncode,0);self.assertEqual(active.read_bytes(),before)
 def test_invalid_palette_and_media(self):
  for mode in ('palette','media'):
   f=fixture();t=json.loads(f['theme.json'])
   if mode=='palette':t['colors']['accent']='#12345'
   else:t['image']='background.jpg';f['background.jpg']=f.pop('background.png')
   f['theme.json']=json.dumps(t).encode();p=self.archive(f)
   r=subprocess.run(['node','--input-type=module','-e','import {loadPack} from '+json.dumps(str(ROOT/'theme-packs.mjs'))+';loadPack(process.argv[1]);',str(p)],capture_output=True)
   self.assertNotEqual(r.returncode,0)
if __name__=='__main__':unittest.main(verbosity=2)
