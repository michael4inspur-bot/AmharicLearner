// 奥罗莫语预生成音频（Meta MMS，CC BY-NC 4.0）：随云函数代码包发布在 audio-om/，manifest.json 记录「语速|文本 → 文件名」。
const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');

const DIR = path.join(__dirname, 'audio-om');

/** 缓存键 / 文件名：sha1(`om|${rate}|${text}`) */
function omKey(rate, text) {
  return crypto.createHash('sha1').update(`om|${rate}|${text}`).digest('hex');
}

function createOmAudio(dir) {
  const base = dir || DIR;
  let manifest = null;
  function load() {
    if (manifest) return manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
    } catch (e) {
      manifest = {};
    }
    return manifest;
  }
  return {
    /** 文件绝对路径；清单里没有返回 '' */
    lookup(text, rate) {
      const name = load()[`${rate}|${text}`];
      return name ? path.join(base, name) : '';
    },
    read(file) { return fs.readFileSync(file); }
  };
}

const defaultOmAudio = createOmAudio();

module.exports = { createOmAudio, omKey, defaultOmAudio };
