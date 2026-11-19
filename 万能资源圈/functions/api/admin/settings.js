/**
 * GET  /api/admin/settings   → 获取全部平台设置（需登录）
 * PUT  /api/admin/settings   → 批量更新平台设置（需登录）
 * body (PUT): { shop_name, shop_logo, contact_url, ... }
 */
import { json, requireAuth, requirePerm, ensureAdminUsers, readJSON, sweepDroppedKeys } from '../../_utils.js';
import { parsePerms, can } from '../../_perms.js';

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
  /* v675（老板：「公告设置/公告显示方式/绑定上限 下级可以自己设置自己的」）：
     整份设置不再一律要 settings.write，改成**按提交的字段分流**——
       店铺名/Logo/客服码/群码/公众号码/页面风格 → settings.write（超管独占，不变）
       announcement_mode（公告弹出频率）        → settings.mode（全局，无范围锁）
       resource_bind_limit（全局绑定上限默认值）  → settings.bindlimit（全局，无范围锁）
       公告内容 announcement/announcements      → 先过 ann.edit（后面还有 v666 的 diff 细判 del/hide/add/edit）
     混合提交：缺任何一个都 403，且**点名缺哪项**（不用笼统的「该功能未开放」）。 */
  {
    const WRITE_KEYS = ['shop_name', 'shop_logo', 'logo', 'style', 'theme', 'ann_anchor', 'shop_slogan', 'sub_freeze'];
    const CONTACT_KEYS = ['contact_url', 'contact_qr', 'group_url', 'group_qr', 'gzh_qr'];
    const hasWrite = bodyKeys.some((k) => WRITE_KEYS.indexOf(k) !== -1);
    const hasContact = bodyKeys.some((k) => CONTACT_KEYS.indexOf(k) !== -1); /* v676：客服/群/三张码 → settings.contact */
    const hasMode = bodyKeys.indexOf('announcement_mode') !== -1;
    const hasBind = bodyKeys.indexOf('resource_bind_limit') !== -1;
    const hasAnn = bodyKeys.some((k) => k === 'announcement' || k === 'announcements'); /* v675：公告**内容**才要 ann.edit；announcement_mode 只归 settings.mode，别混 */
    const __LBL = { 'settings.write': '平台设置', 'settings.contact': '客服与二维码', 'settings.mode': '公告显示方式', 'settings.bindlimit': '设备绑定上限', 'ann.edit': '编辑公告' };
    const __need = [];
    if (hasWrite) __need.push('settings.write');
    if (hasContact) __need.push('settings.contact');
    if (hasMode) __need.push('settings.mode');
    if (hasBind) __need.push('settings.bindlimit');
    if (hasAnn) __need.push('ann.edit');
    if (!__need.length) __need.push('settings.write'); /* 空提交/未知字段：按最严的来 */
    let __auth = null;
    for (const __act of __need) {
      const __r = await requirePerm(env, request, __act);
      if (__r instanceof Response) return json({ ok: false, msg: '缺少「' + (__LBL[__act] || __act) + '」权限，请联系管理员开通', need: __act }, 403);
      __auth = __r;
    }
    var auth = __auth;
  }
  if (auth instanceof Response) return auth;

  /* v666（老板：公告删除/隐藏要单独授权）：公告没有独立接口，整份数组一次 PUT，
     光看请求分不清这次是"改文字"还是"删了一条"还是"只是点了隐藏"——所以这里对
     「库里现在的公告」和「这次提交的公告」做一次 diff，按动作分别要权限：
       提交里没有的真实 id → 删除 → ann.del
       hidden 变化         → 显示/隐藏 → ann.hide
       库里没有的真实 id   → 新增 → ann.add
       其它（标题/正文/排序/等级）变化 → 编辑 → ann.edit
     ⚠ 必须在下面 annScope 范围过滤**之前**算，否则范围外的公告会被误判成"这条被删了"。
     ⚠ 缺权限时**整体拒绝**（不做部分保存），避免"删成功了改没成功"的中间态。
     ⚠ 只认真实数字 id（>0）：前端会塞一条合成的默认公告（id='def'/0），它不是"新增"，按编辑处理。 */
  if (auth.role !== 'super' && b && ('announcements' in b)) {
    const _perms = parsePerms(typeof auth.perms === 'string' ? auth.perms : JSON.stringify(auth.perms || {}));
    const _cur = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('announcements').first();
    let _curArr = []; try { _curArr = JSON.parse((_cur && _cur.value) || '[]') || []; } catch (e) { _curArr = []; }
    let _inArr = []; try { _inArr = JSON.parse(String(b.announcements || '[]')) || []; } catch (e) { _inArr = []; }
    if (!Array.isArray(_curArr)) _curArr = [];
    if (!Array.isArray(_inArr)) _inArr = [];
    const _realId = (id) => /^\d+$/.test(String(id)) && Number(id) > 0;
    const _curMap = new Map(_curArr.map((x) => [String(x && x.id), x]));
    const _inMap = new Map(_inArr.map((x) => [String(x && x.id), x]));
    const _sig = (o) => JSON.stringify([o && o.title, o && o.content, o && o.sort, o && o.level, o && o.isDefault]);
    const _need = new Set();
    _inMap.forEach((v, id) => {
      const old = _curMap.get(id);
      if (!old) { if (_realId(id)) _need.add('ann.add'); else _need.add('ann.edit'); return; }
      if (Number(!!old.hidden) !== Number(!!v.hidden)) _need.add('ann.hide');
      if (_sig(old) !== _sig(v)) _need.add('ann.edit');
    });
    _curMap.forEach((v, id) => { if (!_inMap.has(id) && _realId(id)) _need.add('ann.del'); });
    /* 顺序固定，报错文案才稳定可预期 */
    const _LABEL = { 'ann.del': '删除公告', 'ann.hide': '显示与隐藏', 'ann.add': '发布公告', 'ann.edit': '编辑公告' };
    for (const _act of ['ann.del', 'ann.hide', 'ann.add', 'ann.edit']) {
      if (_need.has(_act) && !can(_act, auth.role, _perms)) {
        return json({ ok: false, msg: '缺少「' + _LABEL[_act] + '」权限，请联系管理员开通', need: _act }, 403);
      }
    }
  }

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
  try { const { clearPublicCache } = await import('../../_utils.js'); await clearPublicCache(request); } catch (e6) {} /* v633：改完设置立刻失效公开缓存 */
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
  try { const { clearPublicCache } = await import('../../_utils.js'); await clearPublicCache(request); } catch (e5) {} /* v633：公开设置现在有 60 秒缓存，写完必须清 */
  return json({ ok: true, id: nextId });
}
