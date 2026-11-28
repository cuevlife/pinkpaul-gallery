"""Build the museum's mixed exhibit from the existing archive (requires Pillow)."""
import json
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
SLOTS = 25  # Physical frames in museum-world.js.
NEAR_DUPLICATE_DISTANCE = 38  # Out of 256 horizontal brightness comparisons.
SESSION_GAP = timedelta(minutes=30)


def taken_at(photo):
    try:
        date = photo.get('date') or ''
        return datetime.fromisoformat(date).replace(tzinfo=None) if 'T' in date else None
    except ValueError:
        return None


def fingerprint(path):
    with Image.open(ROOT / path) as image:
        image = image.convert('L').resize((17, 16), Image.Resampling.LANCZOS)
        pixels = image.tobytes()
    bits = 0
    for row in range(0, len(pixels), 17):
        for col in range(16):
            bits = (bits << 1) | (pixels[row + col] > pixels[row + col + 1])
    return bits


def main():
    archive = json.loads((ROOT / 'photo-metadata.json').read_text(encoding='utf-8'))
    # Keep the archive intact. Only the 3D display ignores near-duplicates.
    candidates = list({photo['path']: photo for photo in archive if photo.get('thumb')}.values())
    signatures = [fingerprint(photo['thumb']) for photo in candidates]
    stamps = [taken_at(photo) for photo in candidates]
    distances = [256] * len(candidates)
    albums, days = Counter(), Counter()
    selected, selected_stamps = [], []
    for _ in range(SLOTS):
        pool = [i for i in range(len(candidates)) if distances[i] >= NEAR_DUPLICATE_DISTANCE]
        if not pool:
            break
        recent = {photo.get('album') for photo in selected[-3:]}

        def rank(i):
            photo = candidates[i]
            album = photo.get('album')
            day = (photo.get('date') or '')[:10]
            stamp = stamps[i]
            same_session = stamp is not None and any(abs(stamp - past) < SESSION_GAP for past in selected_stamps)
            return (album in recent, same_session, albums[album] > 0, not day, days[day], albums[album], -distances[i], photo['path'])

        index = min(pool, key=rank)
        photo = candidates[index]
        selected.append(photo)
        if stamps[index] is not None:
            selected_stamps.append(stamps[index])
        albums[photo.get('album')] += 1
        days[(photo.get('date') or '')[:10]] += 1
        distances = [min(old, (value ^ signatures[index]).bit_count()) for old, value in zip(distances, signatures)]
    if not selected:
        raise SystemExit('No eligible photos with thumbnails; exhibit unchanged')
    (ROOT / 'exhibit.json').write_text(json.dumps(selected, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Exhibit: {len(selected)} of {SLOTS} frames from {len(albums)} albums')


if __name__ == '__main__':
    main()
