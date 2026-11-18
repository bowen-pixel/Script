"""Bounded DreamSkin ZIP/directory reader. Never executes package content."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile

def require(condition, message):
    if not condition:
        raise ValueError(message)

def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key: ' + key)
        result[key] = value
    return result

def parse(data):
    return json.loads(data.decode('utf-8'), object_pairs_hook=unique_object)

def read_package(source):
    source = Path(source)
    require(not source.is_symlink(), 'Package cannot be a symbolic link')
    files = {}
    if source.is_dir():
        entries = list(source.iterdir())
        require(len(entries) <= 8, 'Too many files in theme directory')
        for entry in entries:
            require(not entry.is_symlink() and entry.is_file(), 'Only regular files are accepted')
            require(entry.stat().st_size <= 12 * 1024**2, 'Theme file too large')
            files[entry.name] = entry.read_bytes()
    else:
        require(source.suffix.lower() == '.zip', 'Choose an ordinary .zip package')
        require(source.stat().st_size <= 32 * 1024**2, 'ZIP exceeds 32MiB')
        with zipfile.ZipFile(source) as archive:
            entries = archive.infolist()
            require(0 < len(entries) <= 32, 'ZIP must contain 1–32 entries')
            require(sum(e.file_size for e in entries) <= 64 * 1024**2, 'Expanded ZIP exceeds 64MiB')
            paths = set()
            regular = []
            for e in entries:
                p = PurePosixPath(e.filename)
                require(not any(ord(c) < 32 for c in e.filename), 'Control character in ZIP path')
                require('\\' not in e.filename and not p.is_absolute() and '..' not in p.parts and ':' not in e.filename, 'Unsafe ZIP path')
                require(e.filename.rstrip('/') == str(p) and len(p.parts) <= 2, 'Nested or ambiguous ZIP path')
                require(str(p).casefold() not in paths, 'Duplicate ZIP path')
                paths.add(str(p).casefold())
                kind = stat.S_IFMT(e.external_attr >> 16)
                require(kind in (0, stat.S_IFREG, stat.S_IFDIR), 'Links and special files are forbidden')
                require(not e.flag_bits & 1 and e.compress_type in (0, 8), 'Encrypted or unsupported ZIP')
                require(e.file_size <= 12 * 1024**2, 'ZIP entry too large')
                require(e.file_size <= max(1024**2, e.compress_size * 250), 'Suspicious ZIP compression ratio')
                if not e.is_dir():
                    regular.append((e, p))
            depths = {len(p.parts) for _, p in regular}
            require(len(depths) == 1, 'Ambiguous package root')
            if depths == {2}:
                require(len({p.parts[0] for _, p in regular}) == 1, 'Multiple theme folders')
            for e, p in regular:
                require(p.name not in files, 'Duplicate package filename')
                files[p.name] = archive.read(e)  # verifies local headers and CRC
    require(0 < len(files.get('theme.json', b'')) <= 128 * 1024, 'Missing/oversized theme.json')
    require(0 < len(files.get('theme.css', b'')) <= 256 * 1024, 'Missing/oversized theme.css')
    theme = parse(files['theme.json'])
    require(isinstance(theme, dict) and theme.get('schemaVersion') == 1, 'Unsupported theme schema')
    image = theme.get('image')
    require(isinstance(image, str) and re.fullmatch(r'[\w .-]+\.(?:png|jpg|jpeg|webp)', image, re.I) and '/' not in image, 'Invalid theme image path')
    require(image in files and 0 < len(files[image]) <= 10 * 1024**2, 'Missing/oversized background image')
    allowed = {'theme.json', 'theme.css', image, 'manifest.json', 'manifest.sig', 'LICENSE.txt'}
    require(set(files) <= allowed, 'Unknown file in theme package')
    require(len({n.casefold() for n in files}) == len(files), 'Ambiguous filenames')
    if 'manifest.json' in files:
        require(len(files['manifest.json']) <= 128 * 1024, 'Manifest too large')
        manifest = parse(files['manifest.json'])
        require(manifest.get('packageVersion') == 1 and manifest.get('skinApiVersion') == 1, 'Unsupported package/Skin API version')
        require(manifest.get('themeId') == theme.get('id'), 'Manifest/theme ID mismatch')
        platforms = manifest.get('platforms')
        require(isinstance(platforms, list) and platforms and set(platforms) <= {'macos', 'windows'}, 'Unsupported source platform')
        version = manifest.get('minClientVersion', '')
        require(re.fullmatch(r'\d+\.\d+\.\d+', version) is not None, 'Invalid minimum client version')
        require(tuple(map(int, version.split('.'))) <= (1, 5, 21), 'Package needs a newer DreamSkin contract than this adapter supports')
        capabilities = manifest.get('capabilities')
        require(isinstance(capabilities, list) and {'background', 'safe-css'} <= set(capabilities) <= {'background', 'tokens', 'safe-css'}, 'Unsupported package capabilities')
        records = manifest.get('files')
        require(isinstance(records, list) and len(records) <= 6, 'Invalid manifest files')
        declared = set()
        for record in records:
            name = record.get('path')
            require(name in files and name not in declared and name not in {'manifest.json', 'manifest.sig'}, 'Invalid/duplicate manifest path')
            declared.add(name)
            require(record.get('bytes') == len(files[name]), 'Manifest byte count mismatch: ' + name)
            require(record.get('sha256') == hashlib.sha256(files[name]).hexdigest(), 'Manifest SHA256 mismatch: ' + name)
            expected = 'application/json' if name == 'theme.json' else 'text/css' if name == 'theme.css' else 'text/plain' if name == 'LICENSE.txt' else 'image/png' if name.endswith('.png') else 'image/webp' if name.endswith('.webp') else 'image/jpeg'
            require(record.get('mediaType') == expected, 'Manifest media type mismatch')
        require(declared == set(files) - {'manifest.json', 'manifest.sig'}, 'Manifest payload set mismatch')
    return files

if __name__ == '__main__':
    try:
        files = read_package(sys.argv[1])
        target = Path(sys.argv[2])  # caller creates a fresh private temporary directory
        for name, data in files.items():
            destination = target / name
            with destination.open('xb') as f:
                os.chmod(destination, 0o600)
                f.write(data)
        print('Package structure and integrity validated')
    except Exception as error:
        print('Invalid theme package: ' + str(error), file=sys.stderr)
        sys.exit(1)
