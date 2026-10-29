/**
 * GET /api/admin/bindings?variant_id=xxx   绑定设备清单（需登录）
 * 响应: { ok, limit, count, list: [{ id, device, ua, created_at, last_access }] }
 *   device 显示为「设备 + token 前 6 位」（v386 与信息中心统一口径；完整 token 不下发，避免被拿到后伪造设备）
 * R303（09-30）：支持分页按页拉取（page + page_size）
 */
import { json, requireAuth, ensureBindingsTable, ensureVariantColumns, ensureCodeIssuesTable, getSetting } from '../../_utils.js';
import { parsePerms, visibleCode, catScopeSQL } from '../../_perms.js';

/* #116 复检修正：绑定明细接口的码可见锁——此前任何登录者都能拿全站所有资源码明文（绕过码可见范围） */
function scopeIdsOf(auth) {
  const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  const sc = catScopeSQL(auth.role, perms);
  return sc ? sc.ids : null; /* null=全范围 */
}
function maskCode(auth, perms, code, createdBy, cid) {
  return visibleCode(String(code || ''), auth.role, perms, createdBy || '', auth.username, cid == null ? null : Number(cid));
}


// R223：发码记录展示口径（原与 _utils.recentIssues 一致，R307 已删该函数）——
// status='issued' 待用 / 'bound' 已用；「已过期」按 issued_at 距今超 60 天动态判定。
function issueView(row) {
  let ageDays = 60;
  try {
    const t = new Date(String(row.issued_at).replace(' ', 'T') + 'Z').getTime();
    ageDays = Math.floor((Date.now() - t) / 86400000);
    if (ageDays < 0) ageDays = 0;
  } catch (e) { /* 时间解析失败按满窗计 */ }
  let statusText = '待用';
  if (row.status === 'bound') statusText = '已用';
  else if (ageDays >= 60) statusText = '已过期';
  return { code: row.code, issued_at: row.issued_at, remaining_days: Math.max(0, 60 - ageDays), status: statusText };
}

// R227（老板 19:39「设置能记住」）：早期绑定补录
async function backfillLegacyCodes(env, variantId) {
  try {
    const sql = 'SELECT DISTINCT variant_id, product_id, code, created_at FROM resource_bindings '
      + "WHERE code IS NOT NULL AND code != ''" + (variantId ? ' AND variant_id = ?' : '');
    const q = variantId ? env.DB.prepare(sql).bind(variantId) : env.DB.prepare(sql);
    const r = await q.all();
    const binds = (r && r.results) || [];
    if (!binds.length) return;
    const e = await env.DB.prepare('SELECT code FROM code_issues').all();
    const have = new Set(((e && e.results) || []).map((x) => String(x.code || '').toLowerCase()));
    for (const b of binds) {
      const c = String(b.code || '').trim();
      if (!c || have.has(c.toLowerCase())) continue;
      await env.DB.prepare(
        "INSERT INTO code_issues (variant_id, product_id, code, issued_at, status, bound_at) VALUES (?, ?, ?, ?, 'bound', ?)"
      ).bind(b.variant_id, b.product_id || 0, c, b.created_at, b.created_at).run();
      have.add(c.toLowerCase());
    }
  } catch (e2) { console.error('R227 早期绑定补录失败（不影响列表返回）:', e2 && e2.message); }
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;
  const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  const scopeIds = scopeIdsOf(auth);

  const url = new URL(request.url);
  const variantId = Number(url.searchParams.get('variant_id') || 0);

  // R114（无感预载）：prefetch=1 不带 variant_id——一次性批量返回全部类型的绑定数据
  if (url.searchParams.get('prefetch') === '1') {
    await ensureBindingsTable(env);
    await ensureVariantColumns(env);
    await ensureCodeIssuesTable(env);
    await backfillLegacyCodes(env, 0);
    const limitRaw = await getSetting(env, 'resource_bind_limit', '1');
    const globalLimit = Math.max(1, parseInt(limitRaw, 10) || 1);
    let vrows = [];
    try {
      const vScope = scopeIds
        ? ' JOIN products p ON p.id = v.product_id AND p.deleted_at IS NULL AND p.cid IN (' + scopeIds.map(() => '?').join(',') + ')'
        : ' JOIN products p ON p.id = v.product_id AND p.deleted_at IS NULL';
      const r = await env.DB.prepare('SELECT v.id, v.resource_code, v.bind_limit, p.cid AS p_cid, p.created_by AS p_created_by FROM product_variants v' + vScope).bind(...(scopeIds || [])).all();
      vrows = r.results || [];
    } catch (e) { console.error('R114 预载类型查询失败（按空降级）:', e && e.message); }
    const inScopeVid = new Set((vrows || []).map((v) => v.id));
    let brows = [];
    try {
      /* v348 条31：原来是"一次把全表拉出来"，数据多了会很慢甚至超时。
         现在给一个 5000 条的上限（正常运营远不到这个量），保证单次响应有界。 */
      const r = await env.DB.prepare(
        'SELECT variant_id, code, id, device_token, ua, created_at, last_access FROM resource_bindings ORDER BY variant_id ASC, id ASC LIMIT 5000'
      ).all();
      brows = (r.results || []).filter((x) => inScopeVid.has(x.variant_id));
    } catch (e) { console.error('R114 预载绑定清单查询失败（按空降级）:', e && e.message); }
    const byV = {};
    const vMeta = {};
    (vrows || []).forEach((v) => { vMeta[v.id] = { cid: v.p_cid, createdBy: v.p_created_by }; });
    (brows || []).forEach((r) => {
      if (!byV[r.variant_id]) byV[r.variant_id] = [];
      const _m = vMeta[r.variant_id] || {};
      byV[r.variant_id].push({
        id: r.id,
        device: '设备 ' + String(r.device_token || '').slice(0, 6), /* v386 统一：与信息中心同款「设备+前6位」 */
        ua: r.ua || '',
        code: maskCode(auth, perms, r.code, _m.createdBy, _m.cid), /* #116：码按可见规则打码 */
        created_at: r.created_at,
        last_access: r.last_access,
      });
    });
    let irows = [];
    try {
      const r = await env.DB.prepare(
        'SELECT variant_id, code, issued_at, status, bound_at FROM code_issues ORDER BY issued_at DESC, id DESC'
      ).all();
      irows = (r.results || []).filter((x) => inScopeVid.has(x.variant_id));
    } catch (e) { console.error('R223 预载发码记录查询失败（按空降级）:', e && e.message); }
    const issuesByV = {};
    (irows || []).forEach((r) => {
      if (!issuesByV[r.variant_id]) issuesByV[r.variant_id] = [];
      const _iv = issueView(r);
      const _m = vMeta[r.variant_id] || {};
      _iv.code = maskCode(auth, perms, _iv.code, _m.createdBy, _m.cid); /* #116 */
      issuesByV[r.variant_id].push(_iv);
    });
    const map = {};
    (vrows || []).forEach((v) => {
      const code = String(v.resource_code || '').trim();
      const vLimit = parseInt(v.bind_limit, 10);
      const limit = vLimit >= 1 ? vLimit : globalLimit;
      const list = byV[v.id] || [];
      let curCount = 0;
      if (code) {
        for (const r of brows) if (r.variant_id === v.id && r.code === code) curCount++;
      }
      map[v.id] = { limit, code: maskCode(auth, perms, code, v.p_created_by, v.p_cid), cur_count: curCount, count: list.length, list, issues: issuesByV[v.id] || [] }; /* #116：主码打码 */
    });
    return json({ ok: true, map });
  }

  if (!variantId) return json({ ok: false, msg: '缺少 variant_id' }, 400);
  /* #116：范围锁——只能看授权范围内类型的绑定明细 */
  try {
    const _vrow = await env.DB.prepare('SELECT product_id FROM product_variants WHERE id = ?').bind(variantId).first();
    if (!_vrow) return json({ ok: false, msg: '类型不存在' }, 404);
    const _prow = await env.DB.prepare('SELECT cid, created_by FROM products WHERE id = ? AND deleted_at IS NULL').bind(_vrow.product_id).first();
    if (!_prow) return json({ ok: false, msg: '资源不存在或已下架' }, 404);
    if (auth.role !== 'super') {
      const { catAllowed } = await import('../../_perms.js');
      if (!catAllowed(Number(_prow.cid) || 0, auth.role, perms)) return json({ ok: false, msg: '该功能未开放' }, 403);
      var _curCid = Number(_prow.cid) || 0; var _curOwner = _prow.created_by || '';
    } else { var _curCid = Number(_prow.cid) || 0; var _curOwner = _prow.created_by || ''; }
  } catch (eS) { return json({ ok: false, msg: '查询失败' }, 500); }
  await ensureBindingsTable(env);
  await ensureVariantColumns(env);
  await ensureCodeIssuesTable(env);
  await backfillLegacyCodes(env, variantId);

  // R303：分页参数
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(0, Number(url.searchParams.get('page_size') || 0)));

  // R106：绑定表查询防御——表异常时按空清单返回
  let results = [];
  let total = 0;
  try {
    if (pageSize > 0) {
      const countRes = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM resource_bindings WHERE variant_id = ?'
      ).bind(variantId).first();
      total = countRes ? countRes.n : 0;
      const offset = (page - 1) * pageSize;
      const r = await env.DB.prepare(
        'SELECT id, device_token, ua, code, created_at, last_access FROM resource_bindings WHERE variant_id = ? ORDER BY id ASC LIMIT ? OFFSET ?'
      ).bind(variantId, pageSize, offset).all();
      results = r.results || [];
    } else {
      // 兼容旧口径：不分页返回全部
      const r = await env.DB.prepare(
        'SELECT id, device_token, ua, code, created_at, last_access FROM resource_bindings WHERE variant_id = ? ORDER BY id ASC'
      ).bind(variantId).all();
      results = r.results || [];
      total = results.length;
    }
  } catch (e) { console.error('R106 绑定清单查询失败（按空降级）:', e && e.message); }

  const limitRaw = await getSetting(env, 'resource_bind_limit', '1');

  // R96：返回当前资源码 + 当前码周期的已绑数
  let vRow = null;
  try {
    vRow = await env.DB.prepare('SELECT resource_code, bind_limit FROM product_variants WHERE id = ?').bind(variantId).first();
  } catch (e) {
    console.error('R106 类型上限查询失败（无 bind_limit 降级重查）:', e && e.message);
    vRow = await env.DB.prepare('SELECT resource_code FROM product_variants WHERE id = ?').bind(variantId).first();
  }
  const curCode = vRow ? String(vRow.resource_code || '').trim() : '';
  const vLimit = vRow ? parseInt(vRow.bind_limit, 10) : NaN;
  const limit = vLimit >= 1 ? vLimit : Math.max(1, parseInt(limitRaw, 10) || 1);
  let curCount = 0;
  if (curCode) {
    try {
      const c = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM resource_bindings WHERE variant_id = ? AND code = ?'
      ).bind(variantId, curCode).first();
      curCount = c ? c.n : 0;
    } catch (e) { /* 计数失败按 0 */ }
  }

  // R223：该类型全部发码记录（发放时间倒序），前端合并平铺表用
  let issues = [];
  try {
    const r = await env.DB.prepare(
      'SELECT code, issued_at, status, bound_at FROM code_issues WHERE variant_id = ? ORDER BY issued_at DESC, id DESC'
    ).bind(variantId).all();
    issues = (r.results || []).map(issueView);
  } catch (e) { console.error('R223 发码记录查询失败（按空降级）:', e && e.message); }

  const resp = {
    ok: true,
    limit,
    code: maskCode(auth, perms, curCode, _curOwner, _curCid), /* #116 */
    cur_count: curCount,
    count: total,
    list: results.map((r) => ({
      id: r.id,
      device: '设备 ' + String(r.device_token || '').slice(0, 6), /* v386 统一：与信息中心同款「设备+前6位」 */
      ua: r.ua || '',
      code: maskCode(auth, perms, r.code, _curOwner, _curCid), /* #116 */
      created_at: r.created_at,
      last_access: r.last_access,
    })),
    issues: issues.map((x) => { x.code = maskCode(auth, perms, x.code, _curOwner, _curCid); return x; }),
  };
  if (pageSize > 0) {
    resp.page = page;
    resp.page_size = pageSize;
    resp.total_pages = Math.ceil(total / pageSize);
  }
  return json(resp);
}
