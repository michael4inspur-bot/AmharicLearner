// 云存储适配器。接口与 test/fakeStorage.js 一致。
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const TEMP_URL_BATCH = 50;

module.exports = {
  /** @returns {Promise<string>} fileID */
  async upload(cloudPath, buffer) {
    const r = await cloud.uploadFile({ cloudPath, fileContent: buffer });
    return r.fileID;
  },
  /** @returns {Promise<{[fileID: string]: string}>} */
  async tempUrls(fileIDs) {
    const out = {};
    for (let i = 0; i < fileIDs.length; i += TEMP_URL_BATCH) {
      const batch = fileIDs.slice(i, i + TEMP_URL_BATCH);
      const r = await cloud.getTempFileURL({ fileList: batch });
      for (const f of r.fileList || []) {
        if (f.tempFileURL) out[f.fileID] = f.tempFileURL;
      }
    }
    return out;
  },
  /** @returns {Promise<Buffer>} */
  async download(fileID) {
    const r = await cloud.downloadFile({ fileID });
    return r.fileContent;
  },
  async remove(fileIDs) {
    if (!fileIDs || !fileIDs.length) return;
    await cloud.deleteFile({ fileList: fileIDs });
  }
};
