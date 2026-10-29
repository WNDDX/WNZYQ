/**
 * v439 #116 多管理员子账号 · 权限核心模块（纯函数，node 可直测）
 *
 * 设计（老板拍板 v3）：
 * - 三把锁：功能锁 actions（细到改价/删除/导出）× 范围锁 catsScope（all | 分类 id 数组）× 信息锁（码/IP/明细）
 * - 资源码：codeScope 'own'=只看自己新增 | 'scoped'=范围内全部 | 'all'=全部（超管固定 all）
 * - 层级不限：但授出的权限必须是自己的子集（权限只能缩不能涨）；防环（不能把自己/祖先当下级）
 * - 无权动作统一文案「该功能未开放」
 */

export const DENY_MSG = '该功能未开放';

/* ===== 权限对象解析与兜底 ===== */
/* perms JSON 结构：
   { products:{view,add,edit,price,online,del,restore,purge,moveCat},
     cats:{view,add,edit,del},
     ann:{view,add,edit,del},
     batch:{import,price,online,del},
     data:{stats,detail,ip,export},
     users:0|1, freezeBypass 不需要（冻结只作用 sub）
     catsScope:'all'|[id...], codeScope:'own'|'scoped'|'all' } */
export function parsePerms(raw) {
  let p = {};
  try { p = JSON.parse(raw || '{}') || {}; } catch (e) { p = {}; }
  const g = (o, k) => (o && typeof o === 'object') ? !!o[k] : false;
  return {
    products: { view: g(p.products, 'view'), add: g(p.products, 'add'), edit: g(p.products, 'edit'), price: g(p.products, 'price'), online: g(p.products, 'online'), del: g(p.products, 'del'), restore: g(p.products, 'restore'), purge: g(p.products, 'purge'), moveCat: g(p.products, 'moveCat') },
    cats: { view: g(p.cats, 'view'), add: g(p.cats, 'add'), edit: g(p.cats, 'edit'), del: g(p.cats, 'del') },
    ann: { view: g(p.ann, 'view'), add: g(p.ann, 'add'), edit: g(p.ann, 'edit'), del: g(p.ann, 'del') },
    batch: { import: g(p.batch, 'import'), price: g(p.batch, 'price'), online: g(p.batch, 'online'), del: g(p.batch, 'del') },
    data: { stats: g(p.data, 'stats'), detail: g(p.data, 'detail'), ip: g(p.data, 'ip'), export: g(p.data, 'export') },
    users: !!p.users,
    catsScope: (p.catsScope === 'all') ? 'all' : (Array.isArray(p.catsScope) ? p.catsScope.map(Number).filter(x => x > 0) : []), /* 兜底=空范围（最小权限），显式 'all' 才全范围 */
    codeScope: (p.codeScope === 'scoped' || p.codeScope === 'all') ? p.codeScope : 'own',
  };
}

/* 超管权限：全开 */
export function superPerms() {
  return {
    products: { view: true, add: true, edit: true, price: true, online: true, del: true, restore: true, purge: true, moveCat: true },
    cats: { view: true, add: true, edit: true, del: true },
    ann: { view: true, add: true, edit: true, del: true },
    batch: { import: true, price: true, online: true, del: true },
    data: { stats: true, detail: true, ip: true, export: true },
    users: true,
    catsScope: 'all',
    codeScope: 'all',
  };
}

/* ===== 功能锁判定 ===== */
/* action 形如 'products.add' / 'batch.import' / 'data.export' / 'users' */
export function can(action, role, perms) {
  if (role === 'super') return true;
  if (!perms) return false;
  if (action === 'users') return !!perms.users;
  const dot = String(action).indexOf('.');
  if (dot < 0) return false;
  const grp = String(action).slice(0, dot), key = String(action).slice(dot + 1);
  const grpObj = perms[grp];
  if (!grpObj || typeof grpObj !== 'object') return false;
  return !!grpObj[key];
}

/* ===== 范围锁判定 ===== */
/* catId 是否在授权范围内；cats 数组是「含子分类展开后」的集合（子分类继承父授权，由调用方展开或查询时带 parent 链） */
export function catAllowed(catId, role, perms) {
  if (role === 'super') return true;
  if (!perms) return false;
  if (perms.catsScope === 'all') return true;
  return perms.catsScope.indexOf(Number(catId)) !== -1;
}

/* SQL 范围片段：返回 { clause:'cid IN (?,?,…)', ids:[...] } 或 null（=无限制） */
export function catScopeSQL(role, perms) {
  if (role === 'super') return null;
  if (!perms) return { clause: '1=0', ids: [] };
  if (perms.catsScope === 'all') return null;
  const ids = perms.catsScope;
  if (!ids.length) return { clause: '1=0', ids: [] };
  return { clause: 'cid IN (' + ids.map(() => '?').join(',') + ')', ids };
}

/* ===== 信息锁：资源码可见性 ===== */
/* 返回明文 code 或掩码。规则：
   super → 全部明文；sub：created_by==自己 → 明文；codeScope='scoped' 且资源在自己分类范围 → 明文；'all' → 明文；否则掩码 */
export function visibleCode(code, role, perms, createdBy, meUsername, productCatId) {
  const raw = String(code || '');
  if (role === 'super') return raw;
  if (!raw) return raw;
  if (createdBy && createdBy === meUsername) return raw; /* 自己新增的可见 */
  if (perms && perms.codeScope === 'all') return raw;
  if (perms && perms.codeScope === 'scoped' && productCatId != null && catAllowed(productCatId, role, perms)) return raw;
  return '●●●●'; /* 掩码 */
}

/* ===== 授权校验：授出的权限必须是自己的子集（层级不限但权限只能缩） ===== */
/* childPermsRaw/grantorPermsRaw 都是原始 JSON/对象；返回 { ok, violations:[...] } */
export function validateGrant(childRaw, grantorRole, grantorPermsRaw) {
  if (grantorRole === 'super') return { ok: true, violations: [] };
  const child = parsePerms(typeof childRaw === 'string' ? childRaw : JSON.stringify(childRaw || {}));
  const mine = parsePerms(typeof grantorPermsRaw === 'string' ? grantorPermsRaw : JSON.stringify(grantorPermsRaw || {}));
  const violations = [];
  const grps = ['products', 'cats', 'ann', 'batch', 'data'];
  for (const g of grps) {
    for (const k of Object.keys(child[g])) {
      if (child[g][k] && !mine[g][k]) violations.push(g + '.' + k);
    }
  }
  if (child.users && !mine.users) violations.push('users');
  /* 范围锁子集：子的范围必须是授者范围的子集 */
  if (child.catsScope !== 'all' && Array.isArray(child.catsScope)) {
    if (mine.catsScope === 'all') { /* 授者全范围 → 任意子集合法 */ }
    else {
      for (const id of child.catsScope) {
        if (mine.catsScope.indexOf(id) === -1) violations.push('catsScope#' + id);
      }
    }
  } else if (child.catsScope === 'all' && mine.catsScope !== 'all') {
    violations.push('catsScope=all');
  }
  /* 信息锁子集 */
  if (child.codeScope === 'all' && mine.codeScope !== 'all') violations.push('codeScope=all');
  if (child.codeScope === 'scoped' && mine.codeScope === 'own') violations.push('codeScope=scoped');
  return { ok: violations.length === 0, violations };
}

/* ===== 防环：新上级不能是自己或自己的后代 ===== */
/* chain: 从当前账号沿 parent 往上走的 id 集合（含自己）；descendantIds: 自己整棵子树的 id 集合 */
export function treeMoveOk(newParentId, selfId, descendantIds) {
  const np = Number(newParentId) || 0;
  if (np === 0) return true; /* 挂到超管=顶层，永远合法 */
  if (np === Number(selfId)) return false; /* 不能认自己做上级 */
  return descendantIds.indexOf(np) === -1; /* 不能认自己的下级（含子孙）做上级 */
}

/* ===== 冻结总闸判定（应急冻结只作用子账号） ===== */
export function frozenDenied(role, freezeOn) {
  return role !== 'super' && !!freezeOn;
}
