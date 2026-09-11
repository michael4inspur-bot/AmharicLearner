// 极简 JSON 文件存储：单机部署足够；需要时可替换为 SQLite / MySQL。
import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = { users: {}, tokens: {} };
    this.loaded = false;
    this.writing = Promise.resolve();
  }

  async load() {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      this.data = { users: {}, tokens: {}, ...JSON.parse(raw) };
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    this.loaded = true;
  }

  async save() {
    // 串行化写入，避免并发请求互相覆盖
    this.writing = this.writing.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.data, null, 2));
      await fs.rename(tmp, this.file);
    });
    return this.writing;
  }

  getUser(userId) {
    if (!this.data.users[userId]) {
      this.data.users[userId] = {
        userId,
        createdAt: new Date().toISOString(),
        progress: null,
        aiHistory: []
      };
    }
    return this.data.users[userId];
  }

  userIdForToken(token) {
    return this.data.tokens[token] || null;
  }

  issueToken(userId) {
    const token = `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    this.data.tokens[token] = userId;
    return token;
  }
}
