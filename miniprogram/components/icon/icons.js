// 线性 SVG 图标集（24 网格，2.2 描边）。COLOR 占位由组件替换。
const S = 'fill="none" stroke="COLOR" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const icons = {
  home: `<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>`,
  book: `<path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2z"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>`,
  cards: `<rect x="3" y="7" width="14" height="12" rx="3"/><path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>`,
  spark: `<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M5 17l.8 2 2 .8-2 .8L5 22l-.8-1.4-2-.8 2-.8z"/>`,
  speaker: `<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>`,
  mic: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>`,
  check: `<path d="M5 12l5 5L20 7"/>`,
  'chevron-right': `<path d="M9 6l6 6-6 6"/>`,
  'chevron-left': `<path d="M15 6l-6 6 6 6"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>`,
  play: `<path d="M8 5v14l11-7z"/>`,
  swap: `<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>`,
  plus: `<path d="M12 5v14"/><path d="M5 12h14"/>`,
  trash: `<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>`,
  cloud: `<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4 4 0 0 1-1 9z"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  refresh: `<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>`,
  copy: `<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>`,
  eye: `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
  // 实心
  flame: `<path fill="COLOR" stroke="none" d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-1.5.6-2.6 1.3-3.6C8.6 10.6 10 12 11 12c0-4 .5-7 1-10z"/>`,
  star: `<path fill="COLOR" stroke="none" d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/>`,
  badge: `<path fill="COLOR" stroke="none" d="M12 2l2.4 2.4 3.4-.4.4 3.4L21 9l-1.6 3 .9 3.3-3.3.9L15 19.3l-3-1.6-3 1.6-2-3.1-3.3-.9.9-3.3L3 9l2.8-1.6.4-3.4 3.4.4z"/>`
};

function svg(name, color) {
  const body = icons[name] || icons.spark;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${S}>${body}</svg>`.replace(/COLOR/g, color);
}

function dataUri(name, color) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(name, color));
}

module.exports = { icons, svg, dataUri, names: Object.keys(icons) };
