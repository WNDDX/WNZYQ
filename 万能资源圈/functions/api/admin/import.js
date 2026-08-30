/**
 * POST /api/admin/import
 * 批量导入商品（CSV 格式）
 * CSV 列：title, desc, detail, img, cid, price, is_online, sort
 * 需要管理员登录
 */
import { json, requireAuth, readJSON } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return json({ ok: false, msg: '没有可导入的商品' }, 400);
  if (items.length > 100) return json({ ok: false, msg: '单次最多导入 100 个商品' }, 400);

  let success = 0;
  let fail = 0;
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const title = String(item.title || '').trim();
    if (!title) { fail++; errors.push(`第 ${i + 1} 行：标题为空`); continue; }

    try {
      await env.DB.prepare(
        `INSERT INTO products (cid, title, "desc", detail, img, detail_images, detail_videos, contact_url, price, is_online, is_hidden, sort)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
        .bind(
          Number(item.cid) || 0,
          title,
          String(item.desc || ''),
          String(item.detail || ''),
          String(item.img || ''),
          '[]',
          '[]',
          String(item.contactUrl || ''),
          Number(item.price) || 0,
          item.is_online === 0 || item.is_online === '0' ? 0 : 1,
          0,
          Number(item.sort) || 0
        )
        .run();
      success++;
    } catch (e) {
      fail++;
      errors.push(`第 ${i + 1} 行：${e.message}`);
    }
  }

  return json({ ok: true, success, fail, errors, message: `成功导入 ${success} 个，失败 ${fail} 个` });
}
