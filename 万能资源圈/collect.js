/**
 * v534 自动采集端点（改造：不再需要 CRON_KEY，也不再需要外部定时器）
 *
 * 老板 r14：「定时不用做这些设置啊，就想我们系统自带清除一些数据那个机制一样啊」
 * 所以真正的自动触发改成「顺带」——见 functions/_autocollect.js：
 *   每天第一次有人访问前台/后台时，后台悄悄采一遍，采完当天就不再动。
 * 这个端点保留下来只做两件事：
 *   GET  /api/cron/collect            → 现在就跑一次（当天没跑过才跑），返回每个平台抓了多少条，浏览器直接打开即可自检
 *   GET  /api/cron/collect?op=status  → 今天采没采、上次结果（设置页「自动采集」弹窗读这个）
 *   POST /api/cron/collect {force:1}  → 强制重采一遍（需管理员登录，避免外人反复敲）
 *
 * 无密钥也安全：非 force 的调用是「每天一次」幂等的，且只做公开信息的抓取与入库，不会删改任何已有数据。
 */
import { json, readJSON, getAuthAdmin, requireAuth, ensureAdminUsers } from '../../_utils.js';
import { ensureCollect } from '../admin/external.js';
import { maybeAutoCollect, autoCollectStatus } from '../../_autocollect.js';

async function handleGet(context) {
  const { env, request } = context;
  await ensureAdminUsers(env);
  await ensureCollect(env);

  const url = new URL(request.url);

  if (url.searchParams.get('op') === 'status') {
    const who = await getAuthAdmin(env, request);
    if (!who) return json({ ok: false, msg: '未登录' }, 401);
    return json({ ok: true, status: await autoCollectStatus(env) });
  }

  const force = url.searchParams.get('force') === '1';
  if (force) {
    const auth = await getAuthAdmin(env, request);
    if (!auth) return json({ ok: false, msg: '强制重采需要先登录后台' }, 401);
  }

  const r = await maybeAutoCollect(context, { force: force, wait: true, budget: 22000 });
  return json({
    ok: true,
    day: r.day,
    ran: r.started,
    done: r.done,
    platforms: r.total,
    added: r.added,
    msg: r.started ? '已跑一次' : '今天已经自动采过了'
  });
}

async function handlePost(context) {
  const { env, request } = context;
  await ensureAdminUsers(env);
  await ensureCollect(env);

  const body = await readJSON(request).catch(function () { return {}; });

  if (body && body.op === 'status') {
    const auth = await getAuthAdmin(env, request);
    if (!auth) return json({ ok: false, msg: '未登录' }, 401);
    return json({ ok: true, status: await autoCollectStatus(env) });
  }

  /* 后台「现在采一次」：必须登录 */
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const r = await maybeAutoCollect(context, { force: true, wait: true, budget: 22000 });
  return json({ ok: true, day: r.day, done: r.done, platforms: r.total, added: r.added });
}

export async function onRequestGet(context) { return handleGet(context); }
export async function onRequestPost(context) { return handlePost(context); }
