"""Make web-sized photos and thumbnails from an explicitly selected photo folder.

Requires Pillow. Originals are read only; GPS and other EXIF are not copied.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent
IMAGE_TYPES = {'.jpg', '.jpeg', '.png', '.webp'}
DATE_IN_NAME = re.compile(r'(?<!\d)((?:19|20)\d{2})[-_]?(\d{2})[-_]?(\d{2})(?:[T _-]?(\d{2})[-.:]?(\d{2})[-.:]?(\d{2}))?(?!\d)')


def photo_date(image, name):
    exif = image.getexif()
    original = exif.get_ifd(0x8769).get(0x9003)
    if original:
        try:
            return datetime.strptime(str(original).strip('\x00 '), '%Y:%m:%d %H:%M:%S').isoformat(), 'EXIF DateTimeOriginal'
        except ValueError:
            pass
    match = DATE_IN_NAME.search(name)
    if match:
        try:
            parts = [int(value or 0) for value in match.groups()]
            parsed = datetime(*parts)
            return (parsed.isoformat() if match[4] else parsed.date().isoformat()), 'source filename'
        except ValueError:
            pass
    return None, ''


def save_webp(image, path, size, quality):
    copy = image.copy()
    copy.thumbnail((size, size), Image.Resampling.LANCZOS)
    # Strip metadata and normalize orientation before writing public derivatives.
    copy.save(ROOT / path, 'WEBP', quality=quality, method=4, exif=b'', xmp=b'')


def make_photo(source, root, *, legacy=False):
    relative = source.relative_to(root)
    identity = ('legacy/' if legacy else '') + relative.as_posix()
    identifier = hashlib.sha256(identity.encode('utf-8')).hexdigest()[:16]
    full = f'images/collection/{identifier}.webp'
    thumb = f'images/collection/thumb/{identifier}.webp'
    with Image.open(source) as original:
        date, date_source = photo_date(original, source.stem)
        image = ImageOps.exif_transpose(original)
        image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
        save_webp(image, full, 1280, 75)
        save_webp(image, thumb, 420, 66)
    return {'path': full, 'thumb': thumb, 'date': date, 'dateSource': date_source,
            'album': 'ภาพจากคลังเดิม' if legacy else relative.parts[0] if len(relative.parts) > 1 else 'รวมภาพ'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    parser.add_argument('--keep-legacy', nargs='*', default=[], metavar='FILENAME',
                        help='existing images/ filenames that are not duplicated in the selected folder')
    args = parser.parse_args()
    source = args.folder.expanduser().resolve(strict=True)
    if not source.is_dir() or ROOT == source or ROOT in source.parents or source in ROOT.parents:
        parser.error('choose a source directory outside the project')
    photos = sorted(path for path in source.rglob('*') if path.is_file() and path.suffix.lower() in IMAGE_TYPES)
    if not photos:
        parser.error('no supported images found')
    legacy_root = ROOT / 'images'
    legacy = []
    for name in dict.fromkeys(args.keep_legacy):
        path = (legacy_root / name).resolve()
        if path.parent != legacy_root or not path.is_file() or path.suffix.lower() not in IMAGE_TYPES:
            parser.error('each legacy option must name an existing image directly inside images/')
        legacy.append(path)
    (ROOT / 'images/collection/thumb').mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda path: make_photo(path, source), photos))
        results.extend(pool.map(lambda path: make_photo(path, legacy_root, legacy=True), legacy))
    results.sort(key=lambda item: (item['date'] is None, item['date'] or '', item['album'], item['path']))
    (ROOT / 'photo-metadata.json').write_text(json.dumps(results, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (ROOT / 'images.json').write_text(json.dumps([item['path'] for item in results], indent=2) + '\n', encoding='utf-8')
    print(f'Imported: {len(photos)} new photos, {len(legacy)} kept from previous gallery; {sum(bool(item["date"]) for item in results)} with dates')
    print(f'Original images: {sum(path.stat().st_size for path in photos + legacy):,} bytes')
    for name in ('path', 'thumb'):
        size = sum((ROOT / item[name]).stat().st_size for item in results)
        print(f'{name}: {size:,} bytes')


if __name__ == '__main__':
    main()
