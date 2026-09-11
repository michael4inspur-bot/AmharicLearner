import { Router } from 'express';
import { chatCompletion, parseJsonReply, DeepSeekError } from './deepseek.js';
import {
  diagnosisSystemPrompt,
  planAdjustSystemPrompt,
  tutorSystemPrompt,
  buildDiagnosisUserMessage,
  buildPlanAdjustUserMessage
} from './prompts.js';
import { codeToOpenId } from './wx.js';

const MAX_HISTORY = 30;
const MAX_CHAT_MESSAGES = 20;

export function createRouter(store) {
  const router = Router();

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  function auth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const userId = token && store.userIdForToken(token);
    if (!userId) return res.status(401).json({ error: '未登录或 token 失效' });
    req.userId = userId;
    next();
  }

  router.get('/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  router.post('/auth/login', wrap(async (req, res) => {
    const { code } = req.body || {};
    const { openid, devMode } = await codeToOpenId(code);
    const userId = openid ? `wx_${openid}` : `anon_${Math.random().toString(36).slice(2, 12)}`;
    store.getUser(userId);
    const token = store.issueToken(userId);
    await store.save();
    res.json({ userId, token, devMode });
  }));

  router.get('/progress', auth, (req, res) => {
    const user = store.getUser(req.userId);
    res.json({ progress: user.progress, updatedAt: user.updatedAt || null });
  });

  router.put('/progress', auth, wrap(async (req, res) => {
    const { progress } = req.body || {};
    if (!progress || typeof progress !== 'object') {
      return res.status(400).json({ error: 'progress 必须是对象' });
    }
    const user = store.getUser(req.userId);
    user.progress = progress;
    user.updatedAt = new Date().toISOString();
    await store.save();
    res.json({ ok: true, updatedAt: user.updatedAt });
  }));

  router.get('/ai/history', auth, (req, res) => {
    const user = store.getUser(req.userId);
    res.json({ history: user.aiHistory });
  });

  router.post('/ai/diagnose', auth, wrap(async (req, res) => {
    const { summary, planOutline } = req.body || {};
    if (!summary) return res.status(400).json({ error: '缺少 summary' });
    const text = await chatCompletion(
      [
        { role: 'system', content: diagnosisSystemPrompt() },
        { role: 'user', content: buildDiagnosisUserMessage(summary, planOutline) }
      ],
      { json: true, temperature: 0.4, maxTokens: 2500 }
    );
    const diagnosis = parseJsonReply(text);
    const user = store.getUser(req.userId);
    user.aiHistory.unshift({ type: 'diagnosis', date: new Date().toISOString(), result: diagnosis });
    user.aiHistory = user.aiHistory.slice(0, MAX_HISTORY);
    await store.save();
    res.json({ diagnosis });
  }));

  router.post('/ai/adjust-plan', auth, wrap(async (req, res) => {
    const { summary, planOutline, diagnosis, request } = req.body || {};
    if (!summary) return res.status(400).json({ error: '缺少 summary' });
    const text = await chatCompletion(
      [
        { role: 'system', content: planAdjustSystemPrompt() },
        { role: 'user', content: buildPlanAdjustUserMessage(summary, planOutline, diagnosis, request) }
      ],
      { json: true, temperature: 0.5, maxTokens: 2500 }
    );
    const adjustment = parseJsonReply(text);
    const user = store.getUser(req.userId);
    user.aiHistory.unshift({ type: 'plan', date: new Date().toISOString(), request: request || '', result: adjustment });
    user.aiHistory = user.aiHistory.slice(0, MAX_HISTORY);
    await store.save();
    res.json({ adjustment });
  }));

  router.post('/ai/chat', auth, wrap(async (req, res) => {
    const { messages, summary } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages 必须是非空数组' });
    }
    const history = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_CHAT_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    const reply = await chatCompletion(
      [{ role: 'system', content: tutorSystemPrompt(summary) }, ...history],
      { temperature: 0.7, maxTokens: 1200 }
    );
    res.json({ reply });
  }));

  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err instanceof DeepSeekError ? err.status : err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || '服务器错误' });
  });

  return router;
}
