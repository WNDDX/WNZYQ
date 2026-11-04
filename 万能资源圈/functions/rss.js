/**
 * GET /rss → 资源订阅源（v439 #110：最新 20 条资源，用户可用阅读器追更新）
 */
import { ensureSoftDelete } from './_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
  await ensureSoftDelete(env); /* v440：先迁移软删列 */
  const origin = 'https://wnzyq.pages.dev';
  let items = '';
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, title, \"desc\", updated_at FROM products WHERE deleted_at IS NULL AND is_online = 1 AND is_hidden = 0 ORDER BY id DESC LIMIT 20"
    ).all();
    items = (results || []).map(function (p) {
      const d = new Date((p.updated_at || '').replace(' ', 'T') + 'Z');
      const date = isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
      return '<item><title>' + xmlEsc(p.title || ('资源#' + p.id)) + '</title>' +
        '<link>' + origin + '/shop</link>' +
        '<description>' + xmlEsc(p.desc || '') + '</description>' +
        '<pubDate>' + date + '</pubDate>' +
        '<guid>' + origin + '/shop#p' + p.id + '</guid></item>';
    }).join('');
  } catch (e) { items = ''; }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0"><channel>' +
    '<title>万能资源圈 · 最新资源</title>' +
    '<link>' + origin + '/shop</link>' +
    '<description>最新上架资源订阅</description>' +
    items +
    '</channel></rss>';
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  });
}

function xmlEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
