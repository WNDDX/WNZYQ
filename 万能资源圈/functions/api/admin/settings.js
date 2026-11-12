/**
 * GET  /api/admin/settings   → 获取全部平台设置（需登录）
 * PUT  /api/admin/settings   → 批量更新平台设置（需登录）
 * body (PUT): { shop_name, shop_logo, contact_url, ... }
 */
import { json, requireAuth, requirePerm, ensureAdminUsers, readJSON, sweepDroppedKeys } from '../../_utils.js';
import { parsePerms } from '../../_perms.js';

// 允许设置的 key 白名单
/* v383：新增 group_url（交流群聊跳转链接）+ contact_qr/group_qr/gzh_qr（三张二维码图片），链接/图片全部后台可改 */
const ALLOWED_KEYS = ['shop_name', 'shop_logo', 'contact_url', 'group_url', 'contact_qr', 'group_qr', 'gzh_qr', 'announcement', 'announcement_mode', 'announcements', 'resource_bind_limit', 'sub_freeze'] /* R54：r2_public_base 已废弃删除（图片走 /img/ 路由，无需直连地址） */

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  /* v448 修复越权：原来这里只有 requireAuth —— 任何「已登录」的子账号（包括 perms={} 的零权限号）
     都能读到平台运营配置（客服链接/群链接/二维码键/公告/绑定上限等）。写操作却要 settings.write，
     读写权限不对称。改为与写操作对齐：超管放行；子账号需持公告或批量导入相关权限才可读
     （公告编辑、批量导入都要读这份设置，不能一刀切 403）。 */
  {
    const { can, parsePerms } = await import('../../_perms.js');
    const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
    const allowed = auth.role === 'super'
      || can('settings.write', auth.role, perms)
      || can('ann.view', auth.role, perms) || can('ann.edit', auth.role, perms) || can('ann.add', auth.role, perms)
      || can('batch.import', auth.role, perms);
    if (!allowed) return json({ ok: false, msg: '该功能未开放' }, 403);
  }

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

  /* v546：跳转链接只收 http(s)。前端已拦一道，这里再拦一道——
     实测「abc」「javascript:alert(1)」都能直接写进库，前台客服键拿这个值 window.open，等于把坏链接发给客户。 */
  for (const k of ['contact_url', 'group_url']) {
    if (b && typeof b[k] === 'string') {
      const v = b[k].trim();
      if (v && !/^https?:\/\//i.test(v)) return json({ ok: false, msg: '跳转填完整网址' }, 400);
      b[k] = v;
    }
  }

  /* v354：保存前记下旧值——保存完成后把"旧有新无"的上传文件自动追删（后端核对全库引用，绝不误删） */
  let __oldSettings = '';
  try { const { results } = await env.DB.prepare('SELECT value FROM settings').all(); for (const r of (results || [])) __oldSettings += (r.value || '') + '\n'; } catch (e) {}

  /* v454：公告范围锁——子账号只能在授权的公告 id 上改/删，范围外的公告原样保留（老板：可以只让他改某一个公告） */
  if (onlyAnn && auth.role !== 'super' && ('announcements' in b)) {
    try {
      const perms = parsePerms(typeof auth.perms === 'string' ? auth.perms : JSON.stringify(auth.perms || {}));
      const scope = perms.annScope;
      if (Array.isArray(scope)) {
        const allowed = new Set(scope.map(String));
        const cur = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('announcements').first();
        let curArr = []; try { curArr = JSON.parse((cur && cur.value) || '[]') || []; } catch (e) { curArr = []; }
        let inArr = []; try { inArr = JSON.parse(String(b.announcements || '[]')) || []; } catch (e) { inArr = []; }
        const inMap = new Map((Array.isArray(inArr) ? inArr : []).map(x => [String(x && x.id), x]));
        const merged = (Array.isArray(curArr) ? curArr : []).map(a => {
          const id = String(a && a.id);
          if (!allowed.has(id)) return a;                 /* 不在范围内：一个字都不许动 */
          return inMap.has(id) ? inMap.get(id) : null;    /* 在范围内：可改，也可删（提交里没有=删） */
        }).filter(Boolean);
        (Array.isArray(inArr) ? inArr : []).forEach(x => {
          const id = String(x && x.id);
          if (!(curArr || []).some(a => String(a && a.id) === id) && allowed.has(id)) merged.push(x);
        });
        b.announcements = JSON.stringify(merged);
      }
    } catch (e) { /* 解析失败按原样保存，交给上面的权限锁兜底 */ }
  }

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
