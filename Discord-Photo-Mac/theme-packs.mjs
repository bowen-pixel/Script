import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeAndValidateSafeCss} from './vendor/safe-css-validator.mjs';
const DIR = path.dirname(fileURLToPath(import.meta.url));
export {decodeAndValidateSafeCss};
export const color = value => typeof value === 'string' && /^(?:#[\da-f]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\))$/i.test(value);
export function validateTheme(t) {
  if (!t || t.schemaVersion !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(t.id) || typeof t.name !== 'string' || !t.name.length || t.name.length > 120 || /[\u0000-\u001f\u007f-\u009f]/.test(t.name)) throw Error('Invalid theme ID/name/schema');
  if (t.appearance !== undefined && !['auto', 'light', 'dark'].includes(t.appearance)) throw Error('Invalid appearance');
  if (t.colors !== undefined && (!t.colors || typeof t.colors !== 'object' || Array.isArray(t.colors))) throw Error('Invalid colors');
  for (const [k,v] of Object.entries(t.colors || {})) {
    if (!['background','panel','panelAlt','accent','accentAlt','secondary','highlight','text','muted','line'].includes(k) || !color(v)) throw Error('Invalid theme color: ' + k);
    decodeAndValidateSafeCss(Buffer.from(`[data-ds-part="root"] { color: ${v}; }`));
  }
  if(t.art!==undefined && (!t.art || typeof t.art!=='object' || Array.isArray(t.art))) throw Error('Invalid art');
  for (const k of ['focusX','focusY']) if (t.art?.[k] !== undefined && (!Number.isFinite(t.art[k]) || t.art[k] < 0 || t.art[k] > 1)) throw Error('Invalid art focus');
  return t;
}
export function loadPack(source) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'discord-theme-'));
  try {
    execFileSync('python3', [path.join(DIR, 'validate-pack.py'), path.resolve(source), stage], {stdio:['ignore','pipe','pipe']});
    const t = validateTheme(JSON.parse(fs.readFileSync(path.join(stage, 'theme.json'), 'utf8')));
    const sourceCSS = fs.readFileSync(path.join(stage, 'theme.css'));
    decodeAndValidateSafeCss(sourceCSS);
    const image = path.join(stage, t.image);
    const bytes = fs.readFileSync(image);
    const png = bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a';
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
    if (!png && !jpg && !webp) throw Error('Background has invalid image magic');
    const ext=path.extname(t.image).toLowerCase();
    if(ext==='.png' && !png || ['.jpg','.jpeg'].includes(ext) && !jpg || ext==='.webp' && !webp) throw Error('Background media type does not match filename');
    const info = execFileSync('/usr/bin/sips', ['-g','pixelWidth','-g','pixelHeight', image], {encoding:'utf8'});
    const w = Number(info.match(/pixelWidth: (\d+)/)?.[1]), h = Number(info.match(/pixelHeight: (\d+)/)?.[1]);
    if (!w || !h || w > 8192 || h > 8192 || w*h > 24_000_000) throw Error('Theme image dimensions exceed limits');
    const out = path.join(stage,'normalized.png');
    execFileSync('/usr/bin/sips',['-s','format','png',...(Math.max(w,h)>2560?['-Z','2560']:[]),image,'--out',out],{stdio:'pipe'});
    const converted=fs.readFileSync(out); if (converted.length > 20*1024*1024) throw Error('Converted image too large');
    const manifest=fs.existsSync(path.join(stage,'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(stage,'manifest.json'),'utf8')) : null;
    return {imageData:'data:image/png;base64,'+converted.toString('base64'), safeCSS:sourceCSS.toString('utf8'), theme:t, name:t.name, sourcePlatforms:manifest?.platforms || [], license:manifest?.license || 'Unspecified', fingerprint:createHash('sha256').update(JSON.stringify(t)).update(sourceCSS).update(bytes).digest('hex')};
  } finally { fs.rmSync(stage,{recursive:true,force:true}); }
}
export function adaptedCSS(source) {
  // Compile with the upstream parser on every apply, then scope to our temporary attributes.
  return decodeAndValidateSafeCss(Buffer.from(source)).runtimeSource
    .replaceAll('[data-ds-part=', '[data-discord-ds-part=')
    .replaceAll('@layer dreamskin-community', '@layer discord-dreamskin-community');
}
