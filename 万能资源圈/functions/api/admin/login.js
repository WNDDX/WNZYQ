/**
 * POST /api/admin/login
 * 管理员登录：校验用户名密码（带盐哈希），签发 token（24小时过期）
 * 登录限流：连续失败后锁定，锁定时间随失败次数递增（5分钟起步，最多24小时）
 * body: { username, password }
 * 成功返回 { token, username }
 */
import { json, readJSON, verifyPassword, upgradePasswordHash, randomToken, ensureAdminUsers } from '../../_utils.js';

// 获取客户端 IP
function getClientIP(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    request.headers.get('X-Real-IP') ||
    ''
  );
}

// 计算锁定时间（分钟）：5次内不锁，第5次失败开始算，每5次增加一档，每档10分钟，最多24小时
function calcLockMinutes(failedCount) {
  if (failedCount < 5) return 0;
  var level = Math.floor(failedCount / 5); // 第5次=1档，第10次=2档...
  return Math.min(level * 10, 1440);
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    // 检查数据库绑定是否生效
    if (!env.DB) {
      return json({ ok: false, msg: '数据库绑定未生效，请检查 wrangler.toml 配置' }, 500);
    }

    const body = await readJSON(request);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const ip = getClientIP(request);

    if (!username || !password) return json({ ok: false, msg: '请输入账号和密码' }, 400);
    // R307 U9（用户 09-30 拍板）：后端密码校验加 50 字符上限——与前端 maxlength=50 一致，
    // 超长直接拒绝，不进哈希比对
    if (password.length > 50) return json({ ok: false, msg: '密码最多 50 个字符' }, 400);

    // 1. 检查是否被锁定
    const attempt = await env.DB.prepare(
      'SELECT failed_count, locked_until FROM login_attempts WHERE ip = ? AND username = ?'
    ).bind(ip, username).first();

    if (attempt && attempt.locked_until) {
      const now = new Date();
      const lockUntil = new Date(attempt.locked_until.replace(' ', 'T') + 'Z');
      if (now < lockUntil) {
        const remainMin = Math.ceil((lockUntil - now) / 60000);
        const remainSec = Math.ceil((lockUntil - now) / 1000);
        return json({ ok: false, msg: `尝试次数过多，请 ${remainMin} 分钟后再试`, retryAfter: remainSec }, 429); // v294：125 返回retryAfter供前端显示
      }
    }

    // 2. 查找管理员：先查超管（admins），未命中再查子账号（admin_users，v439 #116）
    let row = await env.DB.prepare('SELECT * FROM admins WHERE username = ?').bind(username).first();
    let isSub = false;
    if (!row) {
      await ensureAdminUsers(env);
      const sub = await env.DB.prepare('SELECT * FROM admin_users WHERE username = ?').bind(username).first();
      if (sub) {
        if (!sub.status) { await recordFailure(env, ip, username, attempt); return json({ ok: false, msg: '该账号已停用，请联系管理员' }, 403); }
        /* #116：应急冻结期间子账号一律拒绝登录（超管不受影响） */
        try {
          const fz = await env.DB.prepare("SELECT value FROM settings WHERE key = 'sub_freeze'").first();
          if (fz && fz.value === '1') return json({ ok: false, msg: '该功能未开放' }, 403);
        } catch (e) { /* 查询失败不拦登录（requirePerm 仍会拦操作） */ }
        row = sub; isSub = true;
      }
    }
    if (!row) {
      await recordFailure(env, ip, username, attempt);
      return json({ ok: false, msg: '账号或密码错误' }, 401);
    }

    // 3. 验证密码（R29：兼容旧 SHA256 与新 PBKDF2；旧格式验证通过后自动升级重哈希，用户无感知）
    const v = await verifyPassword(password, row);
    if (!v.ok) {
      await recordFailure(env, ip, username, attempt);
      return json({ ok: false, msg: '账号或密码错误' }, 401);
    }
    if (v.needUpgrade && !isSub) {
      try { await upgradePasswordHash(env, row.id, password); } catch (e) { console.error('密码哈希升级失败(不影响登录):', e); }
    }

    // 4. 登录成功：清除失败记录
    if (attempt) {
      await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ? AND username = ?')
        .bind(ip, username).run();
    }
    /* #116：子账号登录成功记最近活跃（子账号管理列表展示用） */
    if (isSub) {
      try { await env.DB.prepare("UPDATE admin_users SET last_seen = datetime('now') WHERE id = ?").bind(row.id).run(); } catch (e) { /* 不影响登录 */ }
    }

    // 5. 签发新 token（24 小时过期，允许多设备同时登录）；#116：子账号会话标 utype='u'
    const token = randomToken();
    await env.DB.prepare(
      "INSERT INTO sessions (token, admin_id, utype, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))"
    ).bind(token, row.id, isSub ? 'u' : 'a').run();

    // R30-#4：令牌只写进 HttpOnly Cookie（网页脚本读不到），不再随响应体下发
    // R298：60 天清理统一移到 track.js 每日清理，登录成功不再捎带删除

    const cookie = [
      'wnzyq_token=' + encodeURIComponent(token),
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=86400',
    ].join('; ');
    /* v439 #63：新设备登录记录（详细设备信息）+ 审计 */
    try {
      const { recordAdminLogin, audit } = await import('../_utils.js');
      await recordAdminLogin(env, request);
      await audit(env, request, '登录', '管理后台');
    } catch (e0) {}
    return json({ ok: true, username: row.username }, 200, { 'Set-Cookie': cookie });
  } catch (e) {
    // R27：错误细节只进服务端日志，对外返回通用提示（与 _middleware.js 全局错误策略对齐，避免泄露内部信息）
    console.error('登录失败:', e);
    return json({ ok: false, msg: '服务器开小差了，请重试' }, 500);
  }
}

// 记录登录失败：更新失败次数和锁定时间（5次内不锁定）
async function recordFailure(env, ip, username, existing) {
  const newCount = (existing?.failed_count || 0) + 1;
  const lockMin = calcLockMinutes(newCount);
  const lockedUntil = lockMin > 0 ? `datetime('now', '+${lockMin} minutes')` : "''";

  if (existing) {
    await env.DB.prepare(
      `UPDATE login_attempts SET failed_count = ?, locked_until = ${lockedUntil}, last_attempt = datetime('now') WHERE ip = ? AND username = ?`
    ).bind(newCount, ip, username).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO login_attempts (ip, username, failed_count, locked_until) VALUES (?, ?, ?, ${lockedUntil})`
    ).bind(ip, username, newCount).run();
  }
}
