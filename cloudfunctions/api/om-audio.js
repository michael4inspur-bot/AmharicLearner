// 奥罗莫语预生成音频（Meta MMS，CC BY-NC 4.0）：随云函数代码包发布在 audio-om/，manifest.json 记录「语速|文本 → 文件名」。
// audio-om/ 里除了 mp3 与 manifest.json 还有 NOTICE.txt（署名与许可），这里只按 manifest 取文件，其他文件不影响。
const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');

const DIR = path.join(__dirname, 'audio-om');

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

/** 代码包里的文件名：sha1(`om|${rate}|${text}`)，与 scripts/gen-oromo-audio.py 一致 */
function omFileKey(rate, text) {
  return sha1(`om|${rate}|${text}`);
}

/**
 * 云端缓存键 / 云存储文件名：sha1(`om|${rate}|${text}|${ver}`)。
 * ver 是文件内容版本，mp3 换成真人录音后缓存键跟着变，不会一直播旧的云端文件。
 */
function omKey(rate, text, ver) {
  return sha1(`om|${rate}|${text}|${ver}`);
}

function createOmAudio(dir) {
  const base = dir || DIR;
  let manifest = null;
  const versions = new Map(); // 文件路径 → 内容版本；同一进程内每个文件只读一次
  function load() {
    if (manifest) return manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
    } catch (e) {
      manifest = {};
    }
    return manifest;
  }
  function version(file) {
    if (!versions.has(file)) versions.set(file, sha1(fs.readFileSync(file)).slice(0, 12));
    return versions.get(file);
  }
  return {
    /** { file: 绝对路径, ver: 内容 sha1 前 12 位 }；清单里没有（或文件读不到）返回 null */
    lookup(text, rate) {
      const name = load()[`${rate}|${text}`];
      if (!name) return null;
      const file = path.join(base, name);
      try { return { file, ver: version(file) }; } catch (e) { return null; } // 清单有、文件丢了：当作没有
    },
    read(file) { return fs.readFileSync(file); }
  };
}

const defaultOmAudio = createOmAudio();

module.exports = { createOmAudio, omKey, omFileKey, defaultOmAudio };
