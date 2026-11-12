/**
 * 全站接口兜底中间件（v616）
 *
 * 为什么要有它：
 *   2026-11-12 晚上线上出现「满屏报错」——根因不是页面代码，是 D1 免费额度当天读行数用尽，
 *   所有查询都抛 D1_ERROR，接口统一变 500，前台就变成了"很多报错"。
 *   数据库额度这类故障短时间内修不了（要等次日 UTC 0 点或升级套餐），但用户不该看到一堆 500。
 *
 * 做法：
 *   1. 只接管 /api/*；静态资源、页面一律直通，不增加任何延迟。
 *   2. 捕获下游函数抛出的异常；若判定为「数据库不可用」（额度用尽/连接失败/表损坏），
 *      统一返回 503 + {ok:false, code:'DB_BUSY'}，并带 Retry-After，前端可据此显示一句人话。
 *   3. 其它异常保持原样，避免把真 bug 藏起来。
 */
const DB_BUSY_PATTERNS = [
  'exceeded d1',
  'daily row read limit',
  'd1_error',
  'database is locked',
  'no such table',
  'network connection lost',
  'storage operation exceeded',
];

function looksLikeDbDown(msg) {
  const s = String(msg || '').toLowerCase();
  return DB_BUSY_PATTERNS.some((p) => s.includes(p));
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!url.pathname.startsWith('/api/')) return context.next();

  try {
    const res = await context.next();
    /* 下游自己返回的 500 也可能是数据库问题（很多接口 catch 后统一回 500），
       这里读一次 body 判定：命中就换成 503 + 人话提示；不命中就把原响应原样放回。
       注意只能读一次 body，所以读完必须重建 Response。 */
    if (res.status >= 500) {
      let text = '';
      try { text = await res.clone().text(); } catch (e) { text = ''; }
      if (looksLikeDbDown(text)) {
        return jsonBusy();
      }
    }
    return res;
  } catch (e) {
    if (looksLikeDbDown(e && (e.message || e))) return jsonBusy();
    throw e;
  }
}

function jsonBusy() {
  return new Response(
    JSON.stringify({
      ok: false,
      code: 'DB_BUSY',
      msg: '系统维护中，请稍后',
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': '600',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
