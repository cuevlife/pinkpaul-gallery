"""Audit gallery references against images/ before publishing, without changing files."""
import argparse
import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def read_manifest(name):
    try:
        entries = json.loads((ROOT / name).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        raise ValueError(f'{name}: cannot read a UTF-8 JSON manifest') from None
    if not isinstance(entries, list):
        raise ValueError(f'{name}: expected a JSON array')
    return entries


def image_path(value, location):
    # Manifests use literal, repo-relative paths, not URLs or OS-specific paths.
    if (not isinstance(value, str) or not value.startswith('images/')
            or not value.isprintable() or any(char in value for char in '\\:?#%')
            or any(part in ('', '.', '..') for part in value.split('/'))):
        raise ValueError(f'{location}: expected a repo-relative path under images/')
    return value


def scan_images():
    def raise_scan_error(error):
        raise error

    return {
        (Path(directory) / name).relative_to(ROOT).as_posix()
        for directory, _, names in os.walk(ROOT / 'images', onerror=raise_scan_error)
        for name in names
        if (Path(directory) / name).is_file()
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--list', action='store_true', help='also list all unique referenced paths')
    args = parser.parse_args()

    full, thumbs, fallback = set(), set(), set()
    try:
        for index, photo in enumerate(read_manifest('photo-metadata.json'), start=1):
            location = f'photo-metadata.json entry {index}'
            if not isinstance(photo, dict):
                raise ValueError(f'{location}: expected an object')
            full.add(image_path(photo.get('path'), f'{location} path'))
            thumb = photo.get('thumb')
            if thumb is not None and thumb != '':
                thumbs.add(image_path(thumb, f'{location} thumb'))
        for index, path in enumerate(read_manifest('images.json'), start=1):
            fallback.add(image_path(path, f'images.json entry {index}'))
        files = scan_images()
    except ValueError as error:
        print(f'Audit error: {error}', file=sys.stderr)
        return 2
    except OSError:
        print('Audit error: cannot scan files under images/', file=sys.stderr)
        return 2

    referenced = full | thumbs | fallback
    missing = referenced - files
    unreferenced = files - referenced

    print(f'photo-metadata.json: {len(full)} unique full images, {len(thumbs)} unique thumbnails')
    print(f'images.json fallback: {len(fallback)} unique images')
    print(f'Referenced: {len(referenced)} unique paths; files under images/: {len(files)}')
    print(f'Missing: {len(missing)}')
    for path in sorted(missing):
        print(f'  {path}')
    print(f'Unreferenced: {len(unreferenced)}')
    if unreferenced:
        print('Warning: unreferenced files are still directly downloadable if published; this audit does not delete them.')
        for path in sorted(unreferenced):
            print(f'  {path}')
    if args.list:
        print(f'Referenced paths ({len(referenced)}):')
        for path in sorted(referenced):
            print(f'  {path}')
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
