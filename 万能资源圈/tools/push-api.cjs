/* v539 兜底发布：GitHub 网页/HTTPS 推送连不上时，改走 api.github.com（这个域名通常还通）
   原理：Git Data API —— 建 blob → 建 tree → 建 commit → 移动 main 指针，一次提交全部改动。
   只上传"内容真的变了"的文件：本地算 git blob sha（sha1("blob <len>\0<内容>")）跟远端树对比。
   用法：node tools/push-api.cjs            （在 deploy.cjs 里作为 push 失败后的兜底自动调用） */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const OWNER = 'WNDDX', REPO = 'WNZYQ', BRANCH = 'main', SUBDIR = '万能资源圈';
const LOCAL = 'C:/Users/万能的大熊/Desktop/部署文件/测试/万能资源圈';
const SAFE_DIR = 'C:/Users/万能的大熊/AppData/Local/Temp/wnzyq-git/万能资源圈'; /* deploy 已同步 + 压过 CSS 的副本 */
const SKIP = new Set(['.git', '.workbuddy', 'HANDOVER.md']);

function token() {
  const out = execSync('git credential fill', {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  const m = /password=(.+)/.exec(out);
  if (!m) throw new Error('取不到 GitHub 凭据');
  return m[1].trim();
}

async function api(p, opt) {
  const r = await fetch('https://api.github.com' + p, Object.assign({
    headers: {
      Authorization: 'token ' + token(),
      Accept: 'application/vnd.github+json',
      'User-Agent': 'wnzyq-deploy',
      'Content-Type': 'application/json'
    }
  }, opt || {}));
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch (e) {}
  if (!r.ok) throw new Error((j && j.message) || txt.slice(0, 200));
  return j;
}

function blobSha(buf) {
  return crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
}

function walk(dir, base, out) {
  for (const n of fs.readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = path.join(dir, n);
    /* v539 修正：子目录必须带上目录名，否则 assets/xxx 会被当成根目录的 xxx（上一版就是这样把文件传到错位置的） */
    if (fs.statSync(p).isDirectory()) walk(p, base + n + '/', out);
    else out[base + n] = p;
  }
  return out;
}

(async function main() {
  const src = fs.existsSync(SAFE_DIR) ? SAFE_DIR : LOCAL;
  const files = walk(src, '', {}); /* 相对路径 → 绝对路径 */
  const head = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const headSha = head.object.sha;
  const commit = await api(`/repos/${OWNER}/${REPO}/git/commits/${headSha}`);
  const baseTree = commit.tree.sha;
  const tree = await api(`/repos/${OWNER}/${REPO}/git/trees/${baseTree}?recursive=1`);
  const remote = {};
  (tree.tree || []).forEach(function (e) { remote[e.path] = e.sha; });

  const changed = [];
  const localPaths = new Set();
  for (const rel of Object.keys(files)) {
    const repoPath = SUBDIR + '/' + rel;
    localPaths.add(repoPath);
    /* v539：统一转成 LF 再算 sha / 上传——Windows 本地是 CRLF，git 存的是 LF，
       不转换的话每次都会被判成"变了"，整仓库来回翻写。 */
    let buf = fs.readFileSync(files[rel]);
    if (/\.(js|css|html|json|md|txt|xml|svg|webmanifest|cmd)$/i.test(rel)) {
      buf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    }
    if (remote[repoPath] && remote[repoPath] === blobSha(buf)) continue; /* 没变 */
    changed.push({ repoPath, buf });
  }
  /* v539：本地已经没有、仓库里还留着的文件（历史误传/已删）一并清掉，保证仓库=本地 */
  /* v539：默认不删远端文件——上一版拿"部署副本"当基准，副本不全时会把线上真文件删掉。
     要清理就手动跑：$env:PRUNE=1 或 node tools/push-api.cjs --prune */
  const wantPrune = process.argv.includes('--prune') || process.env.PRUNE === '1';
  const strays = wantPrune ? Object.keys(remote).filter(function (p) {
    return p.indexOf(SUBDIR + '/') === 0 && !localPaths.has(p);
  }) : [];
  if (!changed.length && !strays.length) { console.log('[API] 远端已是最新，无需上传'); return; }

  console.log('[API] 需要上传 ' + changed.length + ' 个文件');
  const treeItems = [];
  for (const c of changed) {
    const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: c.buf.toString('base64'), encoding: 'base64' })
    });
    treeItems.push({ path: c.repoPath, mode: '100644', type: 'blob', sha: blob.sha });
  }
  strays.forEach(function (p) {
    treeItems.push({ path: p, mode: '100644', type: 'blob', sha: null }); /* sha=null = 删除 */
  });
  if (strays.length) console.log('[API] 清理多余文件 ' + strays.length + ' 个');
  const newTree = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree: treeItems })
  });
  const now = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const newCommit = await api(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: '站点更新 ' + now + '（API 兜底发布）', tree: newTree.sha, parents: [headSha] })
  });
  await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommit.sha, force: false })
  });
  console.log('[API] 已提交 ' + newCommit.sha.slice(0, 7) + '，Cloudflare 会自动构建');
})().catch(function (e) {
  console.error('[API] 兜底发布失败：' + e.message);
  process.exit(1);
});
