# 万能资源圈 · 部署与配置说明

## 部署（Cloudflare Pages）
1. 把本项目整个文件夹（不含 `.workbuddy/`）通过 Pages「直接上传」或 Git 连仓库部署。
2. 必须完整上传：4 个 HTML + `config.js` + `sw.js` + `manifest.json` + `_headers` + `favicon.ico` + `assets/` + `functions/`。只传 HTML 会导致功能全部失效（页面会自动弹红色提示）。

## 必需绑定（Cloudflare 面板 → Pages 项目 → 设置 → 函数）
| 绑定名 | 类型 | 用途 |
|---|---|---|
| DB | D1 数据库 | 资源/分类/订单/会话等全部数据 |
| IMAGE_BUCKET / FILE_BUCKET | R2 桶 | 图片与文件存储 |
| KV | KV 命名空间 | 会话/缓存（如已使用） |

## 环境变量（可选）
- `INIT_ADMIN_USER` / `INIT_ADMIN_PASS`：全新部署时自动创建管理员（8-64 位密码），不配则首次打开 /admin 按页面引导初始化。

## 常规更新流程
1. 改完文件 → 整个文件夹重新上传（不能只传 HTML）。
2. `sw.js` 里 `CACHE_NAME` 是全站版本号：每次发布 +1（当前 v336），手机端才会丢弃旧缓存。
3. 换 logo/二维码等图片后，把 `config.js` 的 `IMG_VERSION` 和图片引用的 `?v=` 一起 +1。

## 后台入口
浏览器打开 `/admin`（或资源页左上角 logo）。管理员账号在首次初始化时创建。
