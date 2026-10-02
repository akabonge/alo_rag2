"""Level existing recordings with constant gain; never synthesize or alter pacing.

Requires FFmpeg with libmp3lame. Original MP3 files remain in Git history.
Usage: python scripts/audio/level-recordings.py INPUT_DIR OUTPUT_DIR --ffmpeg PATH
Input and output directories must differ. Inspect the report before integration.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess


def run(binary, args):
    return subprocess.run([binary, '-hide_banner', '-nostdin', *args],
                          capture_output=True, check=True, timeout=60)


def measure(binary, file):
    output = run(binary, ['-i', str(file), '-af',
        'loudnorm=I=-19:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
    text = output.stderr.decode('utf-8', errors='replace')
    data = json.JSONDecoder().raw_decode(text[text.rfind('{'):])[0]
    return {key: float(data[key]) for key in ('input_i', 'input_tp', 'input_lra')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    args = parser.parse_args()
    source, target = args.input.resolve(), args.output.resolve()
    if source == target or source in target.parents or target in source.parents:
        parser.error('Use separate, non-nested input and output directories.')
    if target.exists():
        parser.error('Output directory must be new; existing recordings are preserved.')
    files = sorted(source.glob('*.mp3'))
    if not files:
        parser.error('No MP3 recordings found.')
    target.mkdir(parents=True)
    report = {'target_lufs': -19, 'maximum_true_peak_db': -1.5,
              'method': 'Measured constant gain only; no denoising, pitch, tempo, trimming or synthetic voice.',
              'subjective_listening_verified': False, 'recordings': []}
    for file in files:
        before = measure(args.ffmpeg, file)
        if not all(math.isfinite(v) for v in before.values()):
            raise ValueError(f'Cannot normalize silence/nonfinite level: {file.name}')
        gain = min(-19 - before['input_i'], -1.8 - before['input_tp'])
        output = target / file.name
        run(args.ffmpeg, ['-i', str(file), '-map', '0:a:0', '-map_metadata', '-1',
            '-af', f'volume={gain:.4f}dB', '-c:a', 'libmp3lame', '-b:a', '96k', str(output)])
        after = measure(args.ffmpeg, output)
        if after['input_tp'] > -1.5 or abs(after['input_i'] + 19) > .6:
            raise ValueError(f'Output needs manual review: {file.name}, {after}')
        row = {'file': file.name, 'gain_db': round(gain, 4), 'before': before, 'after': after,
               'original_sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
               'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
        report['recordings'].append(row)
        print(f"{file.name}: {before['input_i']:.2f} -> {after['input_i']:.2f} LUFS; peak {after['input_tp']:.2f} dBTP")
    (target / 'levels.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
