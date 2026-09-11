// 东非时间（UTC+3）自然日 / 自然月起点计算。handler.js 与 speech.js 共用，避免循环依赖。
const EAT_OFFSET_HOURS = 3;
const EAT_OFFSET_MS = EAT_OFFSET_HOURS * 3600 * 1000;

/** 东非时间当天 00:00 对应的 ISO 时刻 */
function dayStartIso(now) {
  const shifted = new Date(now.getTime() + EAT_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - EAT_OFFSET_MS).toISOString();
}

/** 东非时间本月 1 日 00:00 对应的 ISO 时刻 */
function monthStartIso(now) {
  const shifted = new Date(now.getTime() + EAT_OFFSET_MS);
  shifted.setUTCDate(1);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - EAT_OFFSET_MS).toISOString();
}

module.exports = { dayStartIso, monthStartIso, EAT_OFFSET_HOURS };
