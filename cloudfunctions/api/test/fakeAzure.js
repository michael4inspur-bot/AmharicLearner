// 假 Azure Speech：按脚本返回音频 / 识别结果或抛错，记录调用参数。
const { buildSsml, xmlEscape } = require('../azure.js');

function createFakeAzure({ synth, recog } = {}) {
  // synth: (text, voiceName, rate) => Buffer | throws；默认返回内容为 `mp3:${text}` 的 Buffer
  // recog: (wavBuffer) => {status, text} | throws；默认返回 {status: 'Success', text: ''}
  const synthCalls = [];
  const recogCalls = [];
  return {
    synthCalls,
    recogCalls,
    buildSsml,
    xmlEscape,
    async synthesize(text, voiceName, rate) {
      synthCalls.push({ text, voiceName, rate });
      if (synth) return synth(text, voiceName, rate);
      return Buffer.from(`mp3:${text}`);
    },
    async recognize(wavBuffer) {
      recogCalls.push({ wavBuffer });
      if (recog) return recog(wavBuffer);
      return { status: 'Success', text: '' };
    }
  };
}

module.exports = { createFakeAzure };
