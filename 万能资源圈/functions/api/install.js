/**
 * POST /api/install
 * 一键初始化系统（幂等）：
 *   1. 建表（表不存在才建）
 *   2. 写入固定分类"全部"（空时才写）
 *   3. 不写入任何示例资源（管理员自行添加）
 *   4. 创建管理员（账密由部署者首次初始化时通过请求体指定，代码不保存任何明文凭据）
 *   5. 写入默认平台设置（含类型表资源码/隐藏字段）
 * 首次部署后手动调用：curl -X POST https://你的域名/api/install -d '{"username":"...","password":"..."}'
 */
import { json, hashPasswordWithSalt, randomSalt } from '../_utils.js';

// 建表 SQL（与 schema.sql 一致）
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  parent_id  INTEGER NOT NULL DEFAULT 0,
  is_hidden  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  cid           INTEGER NOT NULL DEFAULT 0,
  title         TEXT    NOT NULL DEFAULT '',
  "desc"        TEXT    NOT NULL DEFAULT '',
  detail        TEXT    NOT NULL DEFAULT '',
  img           TEXT    NOT NULL DEFAULT '',
  detail_images TEXT    NOT NULL DEFAULT '[]',
  detail_videos TEXT    NOT NULL DEFAULT '[]',
  contact_url   TEXT    NOT NULL DEFAULT '',
  price         REAL    NOT NULL DEFAULT 0,
  is_online     INTEGER NOT NULL DEFAULT 1,
  is_hidden     INTEGER NOT NULL DEFAULT 0,
  schedule_on   TEXT,                          -- 定时上架时间（NULL=不定时）
  schedule_off  TEXT,                          -- 定时下架时间（NULL=不定时）
  sort          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS product_variants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL,
  name        TEXT    NOT NULL DEFAULT '',
  "desc"      TEXT    NOT NULL DEFAULT '',
  img         TEXT    NOT NULL DEFAULT '',
  video       TEXT    NOT NULL DEFAULT '',
  contact_url TEXT    NOT NULL DEFAULT '',
  price       REAL    NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL DEFAULT 0,
  resource_code    TEXT NOT NULL DEFAULT '',
  resource_content TEXT NOT NULL DEFAULT '',
  is_hidden        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ip            TEXT NOT NULL DEFAULT '',
  username      TEXT NOT NULL DEFAULT '',
  failed_count  INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT NOT NULL DEFAULT '',
  last_attempt  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, username);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS stats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  type       TEXT NOT NULL,
  ip         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stats_product ON stats(product_id);
CREATE INDEX IF NOT EXISTS idx_stats_created ON stats(created_at);
CREATE INDEX IF NOT EXISTS idx_products_online ON products(is_online);
CREATE INDEX IF NOT EXISTS idx_products_cid ON products(cid);
CREATE INDEX IF NOT EXISTS idx_products_hidden ON products(is_hidden);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_stats_type_created ON stats(type, created_at);
CREATE INDEX IF NOT EXISTS idx_stats_product_type ON stats(product_id, type);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`;

// 固定分类：只有"全部"，其他分类由管理员自行添加
const DEFAULT_CATEGORIES = [
  { id: 0, name: '全部', sort: 0 },
];

// 安全修复：不再在代码中硬编码任何默认账号/密码（旧版明文密码已删除）。
// 首次初始化时由部署者通过请求体指定管理员账密：POST /api/install {"username":"...","password":"..."}
// 仅在 admins 表为空时生效；已初始化的站点重跑本接口不会创建/重置任何管理员。

// 默认平台设置
const DEFAULT_SETTINGS = [
  { key: 'shop_name', value: '万能资源圈' },
  { key: 'shop_logo', value: '/assets/images/logo.png' },
  { key: 'contact_url', value: 'https://work.weixin.qq.com/kfid/kfc39748ad948e8b691' },
];

export async function onRequestPost(context) {
  const { env } = context;

  try {
    // 检查数据库绑定是否生效
    if (!env.DB) {
      return json({ ok: false, msg: '数据库绑定未生效，请检查 wrangler.toml 配置或 Cloudflare 面板绑定' }, 500);
    }

    // 1. 建表（拆分成单条执行，避免 exec 多语句问题）
    const sqlStatements = CREATE_SQL.split(';').filter(s => s.trim());
    for (const sql of sqlStatements) {
      try {
        await env.DB.prepare(sql).run();
      } catch (e) {
        // 忽略表已存在等错误
        console.error('SQL执行错误:', sql.substring(0, 50), e.message);
      }
    }

    // 1.5 迁移：为已部署的数据库添加新字段（schedule_on / schedule_off）
    try {
      const cols = await env.DB.prepare("PRAGMA table_info(products)").all();
      const colNames = cols.results.map(c => c.name);
      if (!colNames.includes('schedule_on')) {
        await env.DB.exec("ALTER TABLE products ADD COLUMN schedule_on TEXT");
      }
      if (!colNames.includes('schedule_off')) {
        await env.DB.exec("ALTER TABLE products ADD COLUMN schedule_off TEXT");
      }
    } catch (e) { /* 忽略迁移错误 */ }

    // 1.6 迁移：为已部署的类型表补充 资源码/专属内容/隐藏 字段（幂等）
    try {
      const vcols = await env.DB.prepare("PRAGMA table_info(product_variants)").all();
      const vcolNames = vcols.results.map(c => c.name);
      if (!vcolNames.includes('resource_code')) await env.DB.exec("ALTER TABLE product_variants ADD COLUMN resource_code TEXT NOT NULL DEFAULT ''");
      if (!vcolNames.includes('resource_content')) await env.DB.exec("ALTER TABLE product_variants ADD COLUMN resource_content TEXT NOT NULL DEFAULT ''");
      if (!vcolNames.includes('is_hidden')) await env.DB.exec("ALTER TABLE product_variants ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0");
    } catch (e) { /* 忽略类型表迁移错误 */ }

    // 2. 默认分类（仅"全部"）
    const cat = await env.DB.prepare('SELECT COUNT(*) AS n FROM categories').first();
    if (!cat || cat.n === 0) {
      for (const c of DEFAULT_CATEGORIES) {
        await env.DB.prepare('INSERT INTO categories (id, name, sort) VALUES (?, ?, ?)')
          .bind(c.id, c.name, c.sort).run();
      }
    }

    // 3. 不写入示例资源（留空，管理员自行添加）

    // 4. 管理员（仅 admins 表为空时创建；账密来自请求体，代码里不保存任何明文凭据）
    const adm = await env.DB.prepare('SELECT COUNT(*) AS n FROM admins').first();
    if (!adm || adm.n === 0) {
      let initUser = '', initPass = '';
      try {
        const body = await context.request.json();
        initUser = String((body && body.username) || '').trim();
        initPass = String((body && body.password) || '');
      } catch (e) { /* 请求体缺失/非 JSON 时保持为空，走下方校验 */ }
      if (!/^[A-Za-z0-9_]{3,32}$/.test(initUser) || initPass.length < 8 || initPass.length > 64) {
        return json({ ok: false, msg: '首次初始化需指定管理员：POST /api/install，body 为 {"username":"3-32位字母数字下划线","password":"8-64位"}' }, 400);
      }
      const salt = randomSalt();
      const hash = await hashPasswordWithSalt(initPass, salt);
      await env.DB.prepare('INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)')
        .bind(initUser, hash, salt).run();
    }

    // 5. 默认平台设置
    const st = await env.DB.prepare('SELECT COUNT(*) AS n FROM settings').first();
    if (!st || st.n === 0) {
      for (const s of DEFAULT_SETTINGS) {
        await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
          .bind(s.key, s.value).run();
      }
    }

    return json({ ok: true, msg: '初始化完成（管理员账号以本次请求指定的为准，请妥善保管）' });
  } catch (e) {
    console.error('初始化失败:', e);
    return json({ ok: false, msg: '初始化失败: ' + e.message, error: e.message }, 500);
  }
}
