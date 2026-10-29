/**
 * GET  /api/admin/settings   → 获取全部平台设置（需登录）
 * PUT  /api/admin/settings   → 批量更新平台设置（需登录）
 * body (PUT): { shop_name, shop_logo, contact_url, ... }
 */
import { json, requireAuth, requirePerm, ensureAdminUsers, readJSON, sweepDroppedKeys } from '../../_utils.js';

// 允许设置的 key 白名单
/* v383：新增 group_url（交流群聊跳转链接）+ contact_qr/group_qr/gzh_qr（三张二维码图片），链接/图片全部后台可改 */
const ALLOWED_KEYS = ['shop_name', 'shop_logo', 'contact_url', 'group_url', 'contact_qr', 'group_qr', 'gzh_qr', 'announcement', 'announcement_mode', 'announcements', 'resource_bind_limit', 'sub_freeze'] /* R54：r2_public_base 已废弃删除（图片走 /img/ 路由，无需直连地址） */

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of results) obj[r.key] = r.value;
  return json({ ok: true, settings: obj });
}

export async function onRequestPut(context) {
  const { env, request } = context;
  await ensureAdminUsers(env); /* v440 修复：移到解构后 */
  /* #116：平台设置仅超管；但子账号有公告权限时可保存公告相关键（功能锁落地） */
  const ANN_KEYS = ['announcement', 'announcement_mode', 'announcements'];
  const b = await readJSON(request);
  const bodyKeys = Object.keys(b || {});
  const onlyAnn = bodyKeys.length > 0 && bodyKeys.every(k => ANN_KEYS.indexOf(k) !== -1);
  const auth = onlyAnn ? await requirePerm(env, request, 'ann.edit') : await requirePerm(env, request, 'settings.write');
  if (auth instanceof Response) return auth;

  /* v354：保存前记下旧值——保存完成后把"旧有新无"的上传文件自动追删（后端核对全库引用，绝不误删） */
  let __oldSettings = '';
  try { const { results } = await env.DB.prepare('SELECT value FROM settings').all(); for (const r of (results || [])) __oldSettings += (r.value || '') + '\n'; } catch (e) {}

  for (const key of ALLOWED_KEYS) {
    if (key in b) {
      const val = String(b[key] || '');
      const existing = await env.DB.prepare('SELECT key FROM settings WHERE key = ?').bind(key).first();
      if (existing) {
        await env.DB.prepare('UPDATE settings SET value = ? WHERE key = ?').bind(val, key).run();
      } else {
        await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind(key, val).run();
      }
    }
  }

  try { await sweepDroppedKeys(env, __oldSettings, JSON.stringify(b)); } catch (e) {} /* v354：换掉的图/删掉的公告里的文件自动追删 */
  /* v439 #64：设置变更留痕（60 天自动清理覆盖） */
  try { const { audit } = await import('../_utils.js'); const keys = Object.keys(b).filter(function (k) { return ALLOWED_KEYS.indexOf(k) >= 0; }); await audit(env, request, '更新设置', keys.join('、')); } catch (e1) {}
  return json({ ok: true, msg: '设置已保存' });
}

/**
 * POST /api/admin/settings  → 批量导入追加单条公告（v440 复检新增：此前接口不存在，导入公告必 405）
 * body: { annAdd: { title, content, sort, hidden } }
 * 权限：ann.add（发公告）；软删口径与 PUT 一致——追加不会碰已删公告条目。
 */
export async function onRequestPost(context) {
  const { env, request } = context;
  await ensureAdminUsers(env); /* v440 修复：移到解构后 */
  const auth = await requirePerm(env, request, 'ann.add');
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const item = b && b.annAdd;
  if (!item || !String(item.title || '').trim()) return json({ ok: false, msg: '请填写公告标题' }, 400);

  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'announcements'").first();
  let list = [];
  try { list = JSON.parse((row && row.value) || '[]') || []; } catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];
  list = list.filter(x => !x.deleted); /* 已删公告不参与追加展示顺序，但保留原条目（与回收站语义一致） */
  const deletedKept = [];
  try { const raw = JSON.parse((row && row.value) || '[]'); if (Array.isArray(raw)) raw.forEach(x => { if (x && x.deleted) deletedKept.push(x); }); } catch (e2) {}
  const nextId = list.concat(deletedKept).reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
  list.push({
    id: nextId,
    title: String(item.title || '').trim(),
    content: String(item.content || ''),
    sort: Number(item.sort) || 0,
    hidden: item.hidden ? 1 : 0,
    level: 1,
  });
  const val = JSON.stringify(list.concat(deletedKept));
  const existing = await env.DB.prepare('SELECT key FROM settings WHERE key = ?').bind('announcements').first();
  if (existing) await env.DB.prepare('UPDATE settings SET value = ? WHERE key = ?').bind(val, 'announcements').run();
  else await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind('announcements', val).run();
  /* 同步旧的 announcement 聚合字段（前台旧口径兜底） */
  try { await env.DB.prepare("UPDATE settings SET value = '' WHERE key = 'announcement'").run(); } catch (e3) {}
  try { const { audit } = await import('../_utils.js'); await audit(env, request, '导入公告', String(item.title || '').trim()); } catch (e4) {}
  return json({ ok: true, id: nextId });
}
