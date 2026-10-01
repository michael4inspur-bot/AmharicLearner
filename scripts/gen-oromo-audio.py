#!/usr/bin/env python3
"""生成奥罗莫语朗读音频：Meta MMS 公开模型 facebook/mms-tts-orm（CC BY-NC 4.0，
https://creativecommons.org/licenses/by-nc/4.0/）。

用法（开发机）：
  python3 -m venv .venv-tts && . .venv-tts/bin/activate
  pip install -r scripts/requirements-tts.txt
  python scripts/gen-oromo-audio.py           # 只生成新增/改动的句子
  python scripts/gen-oromo-audio.py --prune   # 同时删除已不在词库里的旧文件
  python scripts/gen-oromo-audio.py --force   # 全部重新生成（会覆盖已换成真人录音的文件！）
同一台机器上同一句话每次生成的结果逐字节相同（固定随机种子）；换了机器（CPU 不同）浮点运算有极小差异，文件会变但听不出区别。每个文件先写临时文件再改名，中途中断不会留下半截 mp3。

模型只认识小写字母、撇号 ' 和连字符 -：标点会被直接丢掉，长句和对话就读成一口气。
所以按标点分段合成，段间插入静音（逗号类 0.25 秒，句号、问号、感叹号 0.4 秒）；
模型词表里没有 v（外来词如 Sarvarii），合成时按 f 读。只影响音频，页面上显示的文字不变。
改了分段或读法规则后用 --force 全部重新生成，并把 langs/om/index.js 的 meta.audioVersion 加 1。

换成真人录音（文件名见 audio-om/manifest.json，「语速|文本 → 文件名」）：
  1. 用真人录音的 mp3 覆盖 cloudfunctions/api/audio-om/ 里的同名文件（清单不用改）；
  2. 重新上传并部署云函数 api —— 云端缓存键带文件内容版本，部署后自动换用新文件；
  3. 把 miniprogram/langs/om/index.js 里 meta.audioVersion 加 1 —— 手机上已缓存的旧音频随之失效；
  4. 上传小程序新版本并提审。
之后不要再用 --force 运行本脚本，否则真人录音会被模型音频覆盖。
"""
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'cloudfunctions', 'api', 'audio-om')
MODEL = 'facebook/mms-tts-orm'
RATES = {'normal': 1.0, 'slow': 0.75}
SEED = 555
BITRATE = 32
PAUSE_SHORT = 0.25  # 逗号、分号、冒号后的停顿（秒）
PAUSE_LONG = 0.4    # 句号、问号、感叹号、省略号后的停顿（秒）
SPLIT_RE = re.compile(r'([,;:.!?…]+)')


def segments(text):
    """按标点切成 [(要合成的文本, 之后的停顿秒数)]；最后一段停顿为 0，只有标点没有字母的段丢掉。"""
    parts = SPLIT_RE.split(text)
    out = []
    for i in range(0, len(parts), 2):
        chunk = parts[i].strip()
        sep = parts[i + 1] if i + 1 < len(parts) else ''
        if not re.search(r'[A-Za-z]', chunk):
            continue
        pause = PAUSE_SHORT if sep and set(sep) <= set(',;:') else PAUSE_LONG
        out.append((chunk, pause))
    if not out:
        return [(text.strip(), 0.0)]
    out[-1] = (out[-1][0], 0.0)
    return out


def tts_text(chunk):
    """送进模型前的读法：小写；词表里没有 v，按 f 读。"""
    return chunk.lower().replace('v', 'f')


def key(rate, text):
    return hashlib.sha1(f'om|{rate}|{text}'.encode('utf-8')).hexdigest()


def collect_texts():
    out = subprocess.check_output(['node', os.path.join(ROOT, 'scripts', 'om-texts.js')], cwd=ROOT)
    return json.loads(out.decode('utf-8'))


def main():
    prune = '--prune' in sys.argv
    force = '--force' in sys.argv
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
            if os.path.exists(path) and not force:
                continue
            model.speaking_rate = speed
            pieces = []
            for chunk, pause in segments(text):
                torch.manual_seed(SEED)
                with torch.no_grad():
                    pieces.append(model(**tok(tts_text(chunk), return_tensors='pt')).waveform[0].numpy())
                if pause > 0:
                    pieces.append(np.zeros(int(sr * pause), dtype=pieces[-1].dtype))
            wav = np.concatenate(pieces)
            pcm = (np.clip(wav, -1.0, 1.0) * 32767).astype(np.int16)
            enc = lameenc.Encoder()
            enc.set_bit_rate(BITRATE)
            enc.set_in_sample_rate(sr)
            enc.set_channels(1)
            enc.set_quality(2)
            tmp = path + '.tmp'
            with open(tmp, 'wb') as f:
                f.write(enc.encode(pcm.tobytes()) + enc.flush())
            os.replace(tmp, path)  # 原子替换：中断时只会留下 .tmp，不会有半截 mp3
            made += 1
    manifest_path = os.path.join(OUT, 'manifest.json')
    with open(manifest_path + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(manifest.items())), f, ensure_ascii=False, indent=0)
        f.write('\n')
    os.replace(manifest_path + '.tmp', manifest_path)
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
