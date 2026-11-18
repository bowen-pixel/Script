import base64,json,sys,zipfile
from pathlib import Path
c=json.loads(Path(sys.argv[1]).read_text())
t=c.get('theme') or {'schemaVersion':1,'id':'my-discord-theme','name':c.get('name','My Discord Theme'),'appearance':'dark','colors':{'accent':c['accent']}}
focus={'top':(.5,0),'bottom':(.5,1),'left':(0,.5),'right':(1,.5),'center':(.5,.5)}[c['position']]
t={**t,'image':'background.png','colors':{**t.get('colors',{}),'accent':c['accent']},'art':{**t.get('art',{}),'focusX':c.get('focusX',focus[0]),'focusY':c.get('focusY',focus[1])},'discordPhoto':{k:c[k] for k in ['darkness','blur','readability','position'] if k in c}}
css=c.get('safeCSS') or '[data-ds-part="root"] { color: var(--ds-theme-color-text); }\n[data-ds-part="composer"] { border-radius: 16px; }\n'
# Export an accepted simplified package; do not invent an upstream compatibility manifest.
with zipfile.ZipFile(sys.argv[2],'x',zipfile.ZIP_DEFLATED) as z:
 z.writestr('theme.json',json.dumps(t,ensure_ascii=False,indent=2))
 z.writestr('theme.css',css)
 z.writestr('background.png',base64.b64decode(c['imageData'].split(',',1)[1],validate=True))
