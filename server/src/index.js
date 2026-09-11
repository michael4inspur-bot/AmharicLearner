import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { JsonStore } from './store.js';
import { createRouter } from './routes.js';

export async function createApp(store) {
  await store.load();
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createRouter(store));
  return app;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const store = new JsonStore(config.dataFile);
  const app = await createApp(store);
  app.listen(config.port, () => {
    console.log(`AmharicLeander server listening on http://localhost:${config.port}`);
    if (!config.deepseek.apiKey) console.warn('警告：未配置 DEEPSEEK_API_KEY，AI 接口将返回 503');
    if (!config.wx.appId) console.warn('提示：未配置 WX_APPID，登录走匿名开发模式');
  });
}
