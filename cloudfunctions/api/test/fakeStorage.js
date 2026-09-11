// 内存云存储，接口与 ../storage.js 完全一致，供测试与小程序模拟脚本使用。
function createFakeStorage() {
  const files = new Map(); // fileID -> Buffer
  return {
    _files: files,
    async upload(cloudPath, buffer) {
      const fileID = `cloud://fake/${cloudPath}`;
      files.set(fileID, buffer);
      return fileID;
    },
    async tempUrls(fileIDs) {
      const out = {};
      for (const id of fileIDs) out[id] = `https://fake/${id}`;
      return out;
    },
    async download(fileID) {
      if (!files.has(fileID)) throw new Error(`fakeStorage: 文件不存在 ${fileID}`);
      return files.get(fileID);
    },
    async remove(fileIDs) {
      for (const id of fileIDs || []) files.delete(id);
    }
  };
}

module.exports = { createFakeStorage };
