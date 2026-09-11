import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3000),
  dataFile: process.env.DATA_FILE || './data/store.json',
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS || 60000)
  },
  wx: {
    appId: process.env.WX_APPID || '',
    secret: process.env.WX_SECRET || ''
  }
};
