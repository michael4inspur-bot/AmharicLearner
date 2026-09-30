#!/usr/bin/env python3
"""生成奥罗莫语朗读音频：Meta MMS 开源模型 facebook/mms-tts-orm（CC BY-NC 4.0）。

用法（开发机）：
  python3 -m venv .venv-tts && . .venv-tts/bin/activate
  pip install -r scripts/requirements-tts.txt
  python scripts/gen-oromo-audio.py           # 只生成新增/改动的句子
  python scripts/gen-oromo-audio.py --prune   # 同时删除已不在词库里的旧文件
同一句话每次生成的结果相同（固定随机种子）。想换成真人录音：用同名 mp3 覆盖即可。
"""
import hashlib
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'cloudfunctions', 'api', 'audio-om')
MODEL = 'facebook/mms-tts-orm'
RATES = {'normal': 1.0, 'slow': 0.75}
SEED = 555
BITRATE = 32


def key(rate, text):
    return hashlib.sha1(f'om|{rate}|{text}'.encode('utf-8')).hexdigest()


def collect_texts():
    out = subprocess.check_output(['node', os.path.join(ROOT, 'scripts', 'om-texts.js')], cwd=ROOT)
    return json.loads(out.decode('utf-8'))


def main():
    prune = '--prune' in sys.argv
    import numpy as np
    import torch
    import lameenc
    from transformers import AutoTokenizer, VitsModel

    os.makedirs(OUT, exist_ok=True)
    model = VitsModel.from_pretrained(MODEL)
    tok = AutoTokenizer.from_pretrained(MODEL)
    sr = model.config.sampling_rate
    manifest = {}
    made = 0
    for text in collect_texts():
        for rate, speed in RATES.items():
            name = key(rate, text) + '.mp3'
            manifest[f'{rate}|{text}'] = name
            path = os.path.join(OUT, name)
            if os.path.exists(path):
                continue
            model.speaking_rate = speed
            torch.manual_seed(SEED)
            with torch.no_grad():
                wav = model(**tok(text, return_tensors='pt')).waveform[0].numpy()
            pcm = (np.clip(wav, -1.0, 1.0) * 32767).astype(np.int16)
            enc = lameenc.Encoder()
            enc.set_bit_rate(BITRATE)
            enc.set_in_sample_rate(sr)
            enc.set_channels(1)
            enc.set_quality(2)
            with open(path, 'wb') as f:
                f.write(enc.encode(pcm.tobytes()) + enc.flush())
            made += 1
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(manifest.items())), f, ensure_ascii=False, indent=0)
        f.write('\n')
    keep = set(manifest.values())
    orphans = [n for n in os.listdir(OUT) if n.endswith('.mp3') and n not in keep]
    if prune:
        for n in orphans:
            os.remove(os.path.join(OUT, n))
    total = sum(os.path.getsize(os.path.join(OUT, n)) for n in os.listdir(OUT) if n.endswith('.mp3'))
    print(f'新生成 {made} 个，共 {len(keep)} 个音频，{total / 1048576:.1f}MB；'
          f'{"已删除" if prune else "多余"} {len(orphans)} 个')


if __name__ == '__main__':
    main()
