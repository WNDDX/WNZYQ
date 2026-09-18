/**
 * 万能资源圈 Service Worker
 * 缓存策略：
 *  - 页面导航（index/shop/admin/error）→ 网络优先：每次打开都拿最新版，
 *    后台改动前台立即生效；离线时才回退缓存（无缓存回退到错误页）。
 *  - JS / CSS（业务代码频繁改动）→ 网络优先：永远先取最新代码，网络失败才回退缓存，
 *    彻底避免“改了代码但页面一直用旧缓存 / 把错误页 HTML 当脚本缓存”的问题。
 *  - 图片等其他静态资源 → R172 改网络优先 + 失败回缓存（更新后刷新立即见新图，不留旧图标残留）。
 *  - /api/ 一律不缓存，始终走网络。
 *  - 任何非 200、或内容类型为 HTML 的 /assets 响应一律不缓存（防止错误页伪装成脚本/样式）。
 */
const CACHE_NAME = 'wnzyq-v207'; // R207（用户 09-18 14:39）：①老板拍板不恢复定时版，清理走访问顺带（track.js R30-#10 已并入 sessions/login_attempts 两表）；②60 天口径统一为「按各自录入时间滚动」，cleanup.js / login.js / track.js / stats.js 四处已核对一致；③sw.js 版本号升级触发旧缓存清理 // R206（用户 09-18 13:51）：①已作废——R207 老板拍板不恢复定时版，cleanup.js 定时入口已删除、定时配置痕迹已清；②全系统时间口径确认：一天 = 北京时间 0:00-24:00，所有日界/定时/过期逻辑已逐处核对并一致 // R205（用户 09-18 13:13 全系统整洁专项）：①删除冗余CSS（admin.css .palette-a、ui-common.css .confirm-mask）②合并三份重复逻辑（formatPrice/bindLightbox/triggerViewAnim）到 ui-common.js 全局函数，shop.js/admin.js 各删一份，净减约 1KB // R204（用户 09-18 13:13 部署失败修复）：删除根目录 wrangler.toml——R188 新增的配置文件 name='wnzyq'/pages_build_output_dir='.'/[triggers]crons 与老板实际 Pages 项目名/部署方式冲突，导致部署阻断；删除后恢复老板原有部署流程 // R194e（用户 01:33 高度按最多规格统一）：①编辑弹窗分类下拉 min-height 42→40 对齐表单输入框（标题/封面/简介 40）②编辑器工具栏展开键 30→32、放大态 36 对齐同排按键与下拉 ③前台变体 tab 与公告 tab 钉 38 对齐分类 tag/顶栏 tab（后台预览弹窗变体 tab 同步 38）④统计页日期按键 36→38 对齐 tab 类；弹窗底部按键经查已由全站统一规则 42px 前后台一致无需动 // R194c（用户 01:01 三连评）：①工具栏按键高度对齐字体字号下拉（32px/放大态36px/手机32px，padding 6px 10px→0 10px+height 钉高）②按键 hover/active 特效色弃 Material 硬编码（#e3f2fd/#1976d2）改页面常见色——hover=淡蓝胶囊家族 rgba(30,136,229,0.12) 底+var(--blue1) 蓝字、active=var(--blue1) 蓝底白字（与 emoji-tab.active/ann-item.primary 同款）③引用块左边线与分割线 #bbb/#ddd 硬编码灰统一改 var(--border)（后台编辑器+前台展示四处同步，与前台 hr 原有口径一致）④表情格按压 scale 0.92→0.94 回全站统一（R163）⑤新增资源弹窗封面上传按钮 height:auto——不再以 46px 主按钮高度拉伸同行输入框，flex stretch 使按钮与输入框同高，封面输入框恢复与简介一致高度 // R194 第二批（用户 00:37 拍板「继续第二批」）：①表格边框灰色→黑色（后台 .rte-editor 表 + 前台展示表同步改 #000）②工具栏分组定稿重排：字体→颜色→插入→文字格式→对齐→列表→历史→工具（插入组挪到文字格式前，四处编辑器同步）③字体 7 个中文字体（微软雅黑/宋体/黑体/楷体/仿宋/隶书/幼圆）各自体渲染（option 内联 font-family + makeSelectPicker 透传到自制下拉条目）④字号 7 档（小/偏小/正常/大/特大/超大/巨大）各档对应字号渲染⑤表情面板 6 类×60=360 个（笑脸/手势/动物自然/食物/活动物品/符号庆祝，分类 tab+10列网格，点击插入不收起可连续插入，复用 .rte-pop 白卡）⑥引用块（formatBlock 切换 blockquote/p 再点取消）+复选框（光标处插 ☐ 纯字符）+撤销/重做（↩↪）+分割线（—灰色）⑦字数统计（四处编辑器下方 rte-count，MutationObserver 驱动）⑧粘贴自动清理（一律只留纯文字 insertText） // R194 第一批（用户 09-18 00:02 拍板「开工」）：编辑器表格全套+60色面板——①颜色组改造：四处编辑器（公告/详情/变体简介/变体内容）原摊开 14 色旧色板（.rte-palette）收起为 2 键（文字色A红/背景色A黄底），点击弹 60 色面板（.rte-pop 复用 cat-picker-panel 白卡同款：padding 6px/圆角 10px/投影 0 10px 28px rgba(20,60,110,0.16)），60 色=10 色系（灰红橙黄绿青蓝紫粉棕）×6 档深浅全覆盖（含清除颜色键、点外收起、再次点同键 toggle 收起）②插入表格：▦ 表格键 → 6×6 hover 网格选择器（行列提示），插入后宽度自适应；光标进表浮现操作条 7 键（加行/删行/加列/删列/合并/拆分/删表）——合并=锚点格+焦点格对角矩形口径（支持反向拖选，矩形含已合并格自动扩边防破表，文字按行拼接保留）；拆分还原行列结构；删表 confirm 确认；错误提示改用站内 toast 轻提示（非阻塞）；列宽=td 右边缘 6px 热区拖拽落 width 到整列（保底40px）；跨格选区高亮（selectionchange 驱动）③表格渲染样式：后台 .rte-editor table 灰色系边框+th 浅灰底（用户指定常见灰色）；前台 sanitizeHTML 白名单放行 table/tbody/thead/tr/td/th（style/width/colspan/rowspan），.modal-detail/.ann-body/.variant-detail/.resource-content 内表格横滑容器（display:block+max-width:100%+overflow-x:auto 手机不撑破）④rteTblGrid 网格映射：含 colspan/rowspan 的表展开 grid[r][c] 统一运算（修复 maxC 少算 1 导致删行/加删列失效的 bug） // R193c-2（用户 23:26 修正）：⑨实时校验只留红框——去掉框下红字 .field-err（admin.js showFieldErr 不再创建红字节点、admin.css 删 .field-err 样式；clearFieldErr 保留兼容清理），红框出现/消失逻辑不变 // R193c（用户 23:10 拍板）：⑤长按小菜单（定稿三类）样式与后台「资源码下拉框」(cat-picker-panel/cp-item) 完全同款并同步——面板 padding 6px/圆角 10px/投影 0 10px 28px rgba(20,60,110,0.16)；条目 flex 布局/padding 9px 10px/圆角 8px/14px/hover var(--hover-bg)（ui-common.css ctx-menu/ctx-item 重写）⑨表单实时校验——标题/分类 blur 或开过下拉未选即红框+框下红字 .field-err（#ff4444/12px），填上即消、重开弹窗清残留；分类下拉经 MutationObserver 监听收起触发（admin.js showFieldErr/clearFieldErr/attachLiveCheck）⑩图片异步解码 img.decoding='async'——前台卡片图/详情弹窗图/变体图+后台缩略图共 5 处（后台线程解码不占主线程，长列表滚动更顺）；⑪ content-visibility 用户未选不做 // R193b（用户 23:06 修正）：编辑器工具栏回退 R193 的「彻底收纳」——收起态恢复既有「单行+左右滑动查看」+蓝色三角展开键（功能本身已有，不加新东西）；真正修的是电脑端排布奇怪的根因：工具栏子项 flex-shrink:0 从手机档扩到全端（原电脑端 nowrap 时按钮被压缩「挤成一块」），展开键 sticky 钉右缘常显 // R193（用户 09-17 22:32 逐项拍板）：①空态前后台统一一模一样（后台改成前台同款三件套：📦图标48px半透明+16px标题+蓝边白底清除按钮；公共样式收编 ui-common.css，搜索无结果=「该搜索暂无资源」+清除按钮、非搜索=「暂无资源」无按钮）②骨架屏方案A（无缓存首访铺 20 张骨架与每页条数一致，数据到达同位替换+30ms 错峰渐入；骨架期空态不抢跑）③Ctrl+K 命令面板底部灰色提示行删除④编辑器工具栏收起态彻底收纳（rte-collapsed 时只显示「展开工具栏」一键，不再 11 键挤一行）⑤长按小菜单全站统一（__ctxMenu 组件：长按卡片=复制标题/复制简介/分享资源、长按图片=保存图片/复制链接/预览大图、长按详情弹窗文字=复制选中/全文复制；shop.html 脚本顺序修正 ui-common.js 先于 shop.js） // R192（用户 09-17 20:30 逐项拍板）：①字距全站标准 1.2px（门户首页弹窗按钮宽度不动）②绿蓝拍板色——资源弹窗咨询客服键=交流群聊蓝 #1688FF（--blue-live 专用变量）、客服弹窗跳转键=咨询客服绿 #01C000 ③搜索高亮 mark.hl 唯一绿 16% 淡化底（修复 hlTitle 无限循环崩溃 bug）④错峰入场 stagger 30ms 递增+prefers-reduced-motion 关闭 ⑤toast 队列逐条播放+error 红字语义 ⑥下滑手势关闭改暂存语义（编辑内容保留，__modalKit stash 通道，补 share-box/preview-box 手势盒）⑦后台 Ctrl+K 命令面板（页面跳转+操作命令+资源名直达编辑，10 条+过滤+键盘导航）⑧编辑器 Ctrl+B/I/U 基本快捷键 ⑨后台行内搜索高亮同款绿  R189（用户 09-17 16:12）：①建议7 图片响应式落码——cfImg 通用工具（仅本站 / 开头路径走 /cdn-cgi/image/width=W,quality=80,format=auto,fit=scale-down 转换；外链 http(s)/协议相对原样不动）+ loadImg 两级回退（转换 URL 404 回原图→原图再失败才占位）；卡片图 800/详情弹窗 1000/变体图 800/后台缩略图 240；Zone 未开 Transformations 时自动回原图页面永不缺图 ②建议8 preconnect 全客服入口同步——__kfPreconnect 通用工具（data-pc-origin 去重）：openContactModal 组件内（覆盖前台顶栏/资源弹窗变体链接/全局客服全部入口）+ shop 兜底弹窗 + index showModal（客服/群聊）+ settings 加载即建连 ③配置依赖：需用户在 Cloudflare Zone（自定义域）开启 Images→Transformations，未开启时代码自动回退原图零影响 // R188（用户 09-17 15:15）：①搜索框清除 × 淡蓝胶囊作废——全系统统一灰圆款（弹窗右上角标准：灰圆 var(--bg-light)、hover 变红白字 #ff4444、按压 scale 0.94；前后台两处 22×22 br50%；至此全系统所有 × 一个标准）②建议8 preconnect 客服提速（index.html 静态 + shop.js 拿到 settings 后动态插 link rel=preconnect——用户浏览期间提前建好 DNS+TLS 连接，点客服即达）③建议10 定时清理完善（cleanup.js 新增定时处理三表 60 天清理 + 根目录 wrangler.toml [triggers] crons 定时触发；与埋点顺带清理构成双保险） // R187（用户 09-17 14:52）：①搜索框清除 × 前后台规格统一（前台 24×20 br10 → 24×22 br11 与后台同款，补 aria-label；全系统盘点确认仅前台/后台两个搜索框且都已带 ×）②深色模式撤 ☾/☀ 手动钮（shop/admin/index 三处按钮+themePref 锁定+点击委托全移除）——纯自动跟随系统实时切换，meta theme-color 同步保留 // R186（用户 09-17 14:08）：①清除搜索键保持淡蓝胶囊（定稿）；②全系统 × 回退弹窗右上角标准——灰圆、hover/点击变红、按压 scale(0.94)（modal-close-x/kf-x/vf-del/rte-img-del 三份 CSS 八组；大小按实际 32/22px）③建议1 搜索历史（前后台搜索框值为空 focus 时显示最近搜索 8 条，localStorage；词条复用 tab 淡蓝胶囊家族、单条删除复用灰圆小×hover红、尾部一键清空）④建议3 全站返回键/返回手势优先关最上层弹窗不退出页面（__modalKit 打开栈 pushState 哨兵+popstate 逐层丢弃通道，主动关闭自动 back 抵消；admin 局部灯箱补注册）⑤建议5 深色模式全站补完——顶栏手动主题键（默认跟随系统实时切换、手动锁定 localStorage themePref、meta theme-color 同步；shop/admin 顶栏白半透明胶囊、index 右下浮动圆钮）+内联白底/灰边清剿接 var(--card-bg/--border/--text)（toast/statsFilterBar/翻页/动态弹窗）+--toast-bg 暗色深底+轴数字 #999 接 var(--text-faint) ⑥建议6 卡片图定宽高比全系统复查确认已有（网格3/2→手机16/10、列表108px、后台96方槽/卡片3/2、预览120方槽、弹窗占位16/9+真图R43内在比例同帧接管）无需改码 // R185（用户 09-17 13:21）：①回退 R184 条17 错误理解——后台清除搜索 × 改后台顶栏 tab 同款风格：淡蓝底蓝字胶囊（非蓝底白字）②全系统 × 统一 tab 风格：前台/后台搜索清除、全站弹窗关闭（modal-close-x/kf-x 三份 CSS）、编辑器图片删除 rte-img-del、视频卡删除 vf-del——白底上下文淡蓝底(rgba(30,136,229,0.12))蓝字胶囊 hover 加深；媒体深底上下文半透白(rgba(255,255,255,0.18))胶囊白× 按压白底蓝字；hover 一律 scale(0.97)+opacity 0.9、按压 scale(0.94)（tab 交互同款，原圆形淡灰 hover 红口径作废） // R184（用户 09-17 12:12 拍板）：①复制变绿 1.2s→1.5s ②后台清除搜索键与空态键改后台 tab 风格蓝底白字 ③删除撤销回退——恢复确认后立即真删（R183 的延迟真删+撤销 toast 移除） ④顶部网络进度条（全局 fetch 包装+150ms 防闪烁，慢请求渐进白色高亮条——蓝底顶栏上恒可见） ⑤阴影统一 5 档 Token（--shadow-card/pop/modal/blue/blue-strong，语义阴影不归档） ⑥修复 R183 时长清扫的自引用 fallback bug // R183（用户 09-17 终极清单拍板·执行项）：①图片入场动画（前台卡片图/详情图/后台缩略图，同二维码 kfQrIn 口径 scale0.9→1+0.18s）②弹窗「从哪开从哪关」对称收缩——MutationObserver 拦截全站 .open 移除，当帧补挂 .mask-closing 维持可见并播 0.18s 收缩（遮罩淡出+卡片 scale1→0.92），200ms 后真隐藏；收缩期间重开自动恢复入场；提示弹窗 showAlert 同步收缩③保存/登录/解锁按钮忙碌态加转圈图标（不动 disabled 防重与全屏遮罩——用户拍板不做）④动效时长三档 Token（--dur-fast 0.10s 微反馈 / --dur-mid 0.18s 状态与弹窗 / --dur-slow 0.30s 内容淡出，三份 CSS 逐值归档）⑤删除资源改延迟真删+撤销（「已删除+撤销」toast 常驻 10 秒无倒计时——用户拍板不限 5 秒；期间撤销=原位恢复；到时未撤销才调接口；beforeunload keepalive 兜底）⑥分类/批量分类/码删除补 120ms 塌缩动画（资源删除原有）⑦统计卡数字 0.6s 滚动（prefers-reduced-motion 直显终值）⑧复制成功键短暂变绿 1.2s+手机端轻震 10ms（复制/保存/解锁/登录成功）⑨后台搜索 300ms 防抖+✗清除键+空态「清除搜索」按钮（与前台同步；原委托+直接双份监听收口成单路由）⑩桌面端「/」直达搜索框+Esc 清空（弹窗全关时）⑪后台筛选条件 localStorage 记忆恢复⑫Ctrl+S 覆盖全部保存弹窗（编辑/公告/客服/分类/批量/码/媒体，确认删除类不绑防误触）⑬拖拽增强：拖起=抬起投影微放大，落点=发光插入线（资源/分类/公告三处同款，原 3px 实线升级）⑭:focus-visible 焦点环统一 2px 蓝⑮价格/统计/表格 tabular-nums 等宽。解释未执行项：条5 顶部进度条/条14 View Transitions（详情是弹窗非换页）/条15 滚动记忆已有/条23 分页已控 DOM/条25 admin 已有预载/条31 阴影统一方案待定 // R182（用户 09-17 拍板 1.A/2/3/4）：①输入框占位文字全站清空，说明型规则挪到名字标签旁小灰字 .label-hint（登录框补名字标签）②前后台搜索框细节统一（字号14/放大镜18/左距38，前台为基准）③搜索框高度统一 33px（后台对齐筛选行、前台同步）④列表/网格切换按钮 38→40px 与主按钮同高（公共一处，两页同步） // R181（用户 09-17 圈选「2，5，8，10，9」五项落地）：①补 categories 管理接口（functions/api/admin/categories.js 列表带 cnt+新增；[id].js 部分字段更新+级联删除，资源归「全部」）②admin 格式刷三处重复抽取 rteReadBrushStyle/rteApplyBrushStyle 公共函数（净减约 1.7KB）③shop 卡片渲染两处重复抽取 buildProductCard（渲染逻辑单一来源）④favicon 多尺寸重打包 43.6KB→28.4KB（16/32/48/256 四层，256 层像素级一致）⑤图片缓存改 30 天 immutable 长缓存（_headers；JS/CSS/HTML/SW 仍 no-cache）+favicon 引用版本号 v174→v183 联动；CACHE_NAME v181→v183（跳过 v182：被否的来源不明覆盖版曾用该号，同号激活不会清理其残留缓存）  R179b（用户 09-16 20:20）：编辑器工具栏默认收起态——HTML 四处 rte-toolbar 初始挂 rte-collapsed（单行横滚省高度），点击展开键摘类成多行全显，全端同款（版本号沿用 v181：R179 从未上线无缓存残留） // R179（用户 09-16 19:24-19:35 六连评）：①编辑器工具栏展开键电脑统一+默认展开（基础态=多行全显，点击挂 rte-collapsed 收起单行横滚，全端同款；旧 rte-expanded 语义废弃）②编辑器内图片/视频双击才能选中（桌面 dblclick+触屏双 tap<400ms，单击不再选中）③资源类型手机档叠层根治（旧 col3=178px 码组列把 1fr 名称列挤到 ~12px，价格×码键叠 44px、编辑×删除键叠 22px；拆列重排 22px+1fr+100px+76px，v-code-group 改 display:contents 码键/绑定键各占一列）④全系统码/无码键宽高统一（固定 112×30 桌面/100×30 手机，长码截断省略+title 看全码）⑤uiTip 有些省略号点击不显示补漏（白名单补 .cpd-text/.cp-name/.v-price + WebKit/iOS ellipsis 不计 scrollWidth 用 Range 实测兜底）+ 小框文字与原文本一模一样含颜色（innerHTML 克隆替代纯文本染黑）⑥编辑器滚到顶/底边界后滚动链放行穿透到页面（移除 R173 的 overscroll-behavior:contain）⑦客服图标缓存残留——全站图片引用版本号整体从 v178 换到 v181 全新 URL（SW/HTTP/解码位图三层缓存必然 miss）// R178（用户 09-16 19:20 评论⑦）：全系统极致响应——统计 1/7/30 天按键的「本地即时更新+后台静默同步」范式推广到后台全部写操作：保存资源/保存类型/删除类型/复制资源（本地合并或插入 state.products 立即 renderProducts，600ms 后 silentSyncProducts 静默对账）；保存分类/删除分类/批量显示隐藏删除/拖拽排序（本地更新 state.categories 立即 renderCategories+refreshCatCnts，新增 silentSyncCategories 600ms 防抖静默同步；分类新增依赖后端返回 id，拿不到时退回 loadCategories 重拉）。原先这些操作成功后都 loadProducts/loadCategories 全量重拉，慢网下界面要等第二次网络往返才显示新数据。 // R177（用户 09-16 19:18 评论+截图）：产品行「资源码」下拉面板类型名可显示宽度统一——原 flex:1 1 auto 弹性吸收剩余空间，长名称一串显示几十字、短名称只显示一点；统一 max-width:150px 截断省略（全面板口径一致），nm.title 悬停看全名 // R176（用户 09-16 10:01-10:16 七连评）：①封面占位/真图统一居中（.img-preview.show margin auto，输入假链接过程左右横跳根治）②图标残留根治——全站本地图片引用统一 ?v=181 版本号（logo/kefu/qun/gzh 八文件 27 处，favicon ?v=174 机制扩展，SW 缓存/浏览器 HTTP 缓存/解码位图缓存三层同 URL 全绕开，刷新闪旧图标零窗口）③编辑器放大态出框根治——还原/Esc 退出放大时清残留内联 top/height（旧版 top:115px 在 relative 态把编辑器视觉下移 115px 盖住下方类型区，实测复现）+高度公式 100vh→100dvh 二段赋值（手机地址栏/软键盘收窄可视区不再底溢）④工具栏展开键（复用统计面板蓝色三角视觉）——手机单行横滚 ↔ 多行全显两种编辑模式可切换⑤视频浮动双保险——contain:paint 列表（shop 五容器/admin 四容器）补 translateZ(0) 硬件合成层，老内核对 video 合成层不应用 contain 裁剪时照样裁⑥统计 1/7/30 天切档极致响应——删 applyStatsDays 短路缓存、两段式（本地图表即时重绘+带范围请求回填六卡三表）、日期全链北京口径、表标题随所选范围动态更新、statsTrendAll 独立预取  // R175（用户 09-16 10:00 评论+截图）：全系统对齐根治——①码面板手机档错位修复（cp-item nowrap+名称 flex:1+金额/码键贴右恒定起点，旧 flex 名称弹性占位 390px 实测错位 125px）②variant-item 手机档 R171 flex-wrap 方案废弃改固定列 grid（22px+1fr+178px+76px 三行 areas；独立网格 auto 列随行浮动跨行永不对齐；子项 justify-self:start 防 stretch 拉伸按钮）③全系统码/无码键宽高统一（手机 min-width 100px 原 88px 有码 97/无码 88 不等宽；桌面 112px 保持）④renderVariants 三处稳定类名 v-code-group/v-edit-btn/v-del-btn  // R173（用户 00:27-00:40 五连评）：①封面占位符统一居中（旧满宽 calc(100%-32px)+左右 16px 与真图 auto 居中口径不一致，三态切换左右跳位；改 min(320px) 上限+margin auto 居中）+admin 预览假链接封面 onerror 换占位符（旧版 2px 破图）②回退 R171 统计改动——switchTab 门控回 __plS 单条件、statsLoading 回"统计卡未渲染才显示"条件口径、删掉切日期档的 stats-fade-in 全页重放（"切换日期全页面闪一次"直接根因，R170 就有）③uiTip 卡顿/瞬消续修——show 全部改 rAF 下一帧弹出（测量强制回流不再阻塞点击主线程，连划/连点天然去抖）+补 mouseout 的 __hoverDev 门控（R171 只门控了 mouseover，真机 tap 后清理模拟 hover 派发合成 mouseout 立即收框=手机"显示一瞬间"残留元凶）+resize 收框加 400ms 冷静期（地址栏收起/软键盘弹出立即收框路径）④RTE 编辑器三修——编辑器内 img/video 规则加 !important（内联 width:600px 粘贴媒体撑出编辑器/放大态也出格）+.rte-editor 加 overscroll-behavior:contain（滚到头滚动链穿透到底层 body="滑动的其实是最后面的资源"）+手机端工具栏 flex-wrap:nowrap+overflow-x:auto 单行横向滚动（17 键 wrap 7 行占 200px+ 显示不全）⑤前台 contain:paint 裁剪列表补 .resource-content（解锁内容区视频浮动）  // R171（用户 23:08/23:31 两连评）：①uiTip 卡顿/瞬消根治——同文本免二次强制回流+mouseover 只绑真 hover 设备（手机 tap 不再双份 show）+scroll 收框加 400ms 冷静期+350ms isConnected 改为白名单同文本元素迁移（tab 重渲染不再闪消）②编辑器媒体回归单击选中——pointerdown 只记 tap 基准、pointerup 位移<10px 才选中（滑动/拖选扫过不再选中出编辑框）③统计 1/7/30 天请求一发就转圈（statsLoading 不再仅首开显示）④手机端类型列表/码面板槽位保底不挤压（码/无码键统一 88px 同宽、排序 44px+按键 flex-shrink:0 显示全、类型名 flex 保底 120px 不再一字符省略号、行 flex-wrap 换行铺开不出框）⑤封面预览固定 120 方槽（假链接/占位/真图尺寸恒定不再跳动）⑥分类管理批量显示/隐藏换位（显示在前）⑦favicon 全站引用带 ?v=174（绕开浏览器 favicon 硬缓存，刷新闪旧图标根治）  // R170（用户 22:52）：下拉刷新两根治——①位置回到 top:80px（与之前 toast/下拉弹窗同位，用户"高度要跟之前弹窗高度一致"；R166 的 top:0 作废）②根治"下拉后滑回去中间消失"：旧实现胶囊钉死容器顶+容器高度随手指裁切（overflow:hidden），划回时 32px 胶囊从下往上被裁残（剩半截文字→一条蓝边→消失）；新实现容器恒 height:0/overflow:visible 纯定位锚点，胶囊整体 translateY 平移（默认 -48px 藏 80px 线上方 opacity 0，跟手 -48+dist*0.6 渐显，松手触发停 translateY(0)=80px 位显示「正在刷新…」，取消/完成完整滑回上方淡出，永不残缺）+ touchmove 中 transition:'none' 防跟手滞后、touchend 恢复回弹  // R169（用户 22:28，R168-① 去重口径扩展）：埋点去重从 view 扩展到全部类型——view / contact / resource_unlock 统一按「同设备（IP）+同资源+同类型」1 小时窗口去重（同一设备同一点击 1 小时内只算一次），管理员剔除/北京时区口径不变，R166-⑤⑥ 维持不做 // R168（用户 21:21，R166 建议清单拍板）：数据统计口径三项落地——①总浏览去水：view 埋点按「同设备（IP）+同资源」1 小时窗口去重（不拆 PV/UV，就一个总浏览数）；②管理员自己浏览前台不计入（带管理会话 Cookie 的 /api/track 请求直接跳过）；③时区统一北京时间全系统口径——stats 聚合一律 date/strftime +8 hours 切日切时（一天为北京时间 0-24 点），默认近30天/单日小时档/环比上期同口径，R166 建议第5条（按日汇总表留历史）/第6条（面板口径说明）用户要求只解释不执行 // R167（用户 20:27）：#uiTip 截断文字悬停/点按小框收编至 ui-common.js 全站四页统一（电脑 mouseover 悬停/手机 click 白名单点按，白名单扩前台 .card-title/.card-desc/.shop-name/.variant-tab；定位带 8px 右缘钳制永不越屏；弹窗开合经 syncBodyLock 自动隐藏小框，tab 切换重渲染后脱离文档自动收起；样式移至 ui-common.css z-index 100002）——原 R102「只做后台」口径由用户新指令推翻 // R166：①下拉刷新胶囊改从手机物理顶部滑出——四端 .pull-refresh top 80→0（R161 只改了胶囊锚定容器顶，容器本身还在 top:80px，手机地址栏+80px 让胶囊落在屏幕中上部像"中间出现"；R108 与 toast 同位 80px 口径对本容器作废，toast 不动）②自制下拉显示框同步修复——makeSelectPicker 的 ref 原存 sel.dataset.spRef 会字符串化拿不回（annMode 取消/重开仍显示草稿选中项的根因），改 spRefs Map + syncSelectDisplay() 辅助，三处 annMode 程序化赋值（loadSettings/annDiscard/openAnnBtn）+三处编辑器字体/字号重置同步显示框 // R165：①编辑器媒体跨浏览器修复——contain:paint 裁剪越界绘制（部分内核滚动容器内视频/原生蓝层不裁剪→视频浮出弹窗、蓝层超弹窗、划到顶仍挡屏 1/3，同根因一并修复）+×/选中加 pointerdown 兜底（有些浏览器 touchend/click 合成事件被吞）+自绘选中框 outline（受 contain 裁剪不越界，序列化双保险剥离）②资源码下拉面板右缘钳制（手机长类型名把面板推出屏幕右边界）③uiTip 支持单行截断容器（网格卡片副标题带子元素旧逻辑弹不出，悬停/点按都能看全文）④按键拥挤收敛——桌面网格卡片 gap 12→8、小屏全系统行内小键 padding/字号收一档+按钮组可换行 // R164：回退 R163 的圆角三档（用户拍板不做了）——全站 border-radius 逐行还原 v165 原值（搜索框19/标签18/弹窗14/灰盒10 等全回原样），保留 R163 的按压统一 scale(0.94)（含 logo !important 修复 logoFadeIn forwards 遮蔽） // R163：按键按压动画全站统一 scale(0.94)（仅 :active；hover 0.97/入场动画不动，根因=admin.css 末尾组 0.92 赢过前组 0.94 的双组并存+散落 0.9/0.92/0.93/0.95 异值） // R162：统计两图几何全量统一——柱图网格顶/跨度/间距(37.5k)/柱底/X标签(点对齐+同间隔)/Y数字右缘/灰盒高度(12px上下padding)/悬浮框顶与悬浮竖线范围全部按折线公式同步（原R153只对齐了顶线，间距 45k-9≠37.5k 是灰线与数字间隔不一致的根因）；X标签移出列进独立层 // R160：前后台类型tab长名单行截断省略号+title悬停查看 // R161：下拉刷新胶囊改顶锚定（从手机顶部拉出，第一版口径，高度/阈值不动） // R159：①资源页网格卡片桌面标题取消42px双行预留、紧贴蓝色简介（与手机一致）；②全系统弹窗防裁剪统一——遮罩改 dvh 高度+flex-start 安全居中+overflow-y:auto（手机地址栏可见时 84vh 超可视区导致底部时间框/按钮排永远看不到的根因修复），form 加 8px 底部呼吸空间 // R157：绑满被拦文案升级为「该码绑定设备已满（上限 N 台），请联系客服。注意：换浏览器、无痕模式、清除缓存都会被识别为新设备」（用户指定文案）；R156：时间显示统一转北京时间（D1 datetime('now') 存 UTC，展示层 __utcToLocal 固定 UTC+8 换算）
/* R192：组件统一 8 项（标题20px/主钮46-10-16-1.2/红钮10-16/群聊蓝#1688FF/行内键8px/输入框42-10/复选20/二维码12px）+ toast 队列语义色 + 卡片错峰 + 搜索淡绿高亮 + 编辑器 Ctrl+B/I/U + 弹窗下滑手势关闭（走暂存通道）。 */
/* R191：建议7 代码彻底删除（用户拍板不留后路）——cfImg/__cfW/__cfSrc/__tCf/__vCf/data-cfmg 及全局兜底放行逻辑全部移除，loadImg/变体图/后台缩略图回到原图直出+单级占位兜底（R189 前形态）。建议8 客服 preconnect 保留。 */
/* R190：建议7 回退——用户未买自定义域名（pages.dev 无法开 zone 级 Transformations），cfImg 总开关默认关闭，图片一律原图直出；启用方式：绑定自有域名并开 Transformations 后置 window.CF_IMG_TRANSFORM = true。建议8 客服 preconnect 不受影响，保留。 */
// R155：复制资源全量化（title 原样/排序照抄/is_hidden 照抄/类型补 title 字段，仅 is_online=隐藏）+编辑器视频×浮层（此前视频无任何删除键）+移动端 tap 视频可选可删（touchend capture 委托，Chromium 移动端 video tap 不派发 click）+×改 rAF 每帧贴合宿主（滚动不再漂移）
// R154：公告保存后取消/×不再残留脏数据（保存即重建备份）+类型列表/码下拉面板金额·码键·绑定键·排序固定槽位跨行对齐（无金额/无码行空占位，窄屏放宽） // R153：统计两图网格顶线/Y轴数字距灰盒上边界距离统一（柱状 barZone 随折线实测同步） // R152：favicon 下条鲸鱼头朝左+肚皮朝上（rotate180）+高清沿用 // R151：图片/视频删除×内缩 12px 与全站弹窗关闭键同口径（完全陷入不出框） // R150：favicon 下条鲸鱼改头朝左（镜像回 R143 构图）+8x 超采样轻锐化更高清 // R147：统计两图数字10px取小+Y轴上边距统一0.44系数+绿键回退(pwd处保蓝)+前台弹窗点外/Esc=丢弃+编辑器视频可删(选中/退格/×键/序列化还原)+分类选择禁选一级'全部'虚拟行 // R146：favicon下方鲸鱼翻转回同向+已解锁内容本地缓存(重开弹窗即时显示)+admin三处金额展示(副标题/下拉面板/类型列表,橙#ff6b35)+下拉刷新展开动画恢复(R135回退) // R145：统计两图数字13px取大统一+悬浮框去封顶恒等+图例同高+全系统绿色清零(改密键/导航四彩/客服跳转键)+公告取消全量恢复+全弹窗关闭=丢弃四通道统一 // R144：编辑器视频兜底卡不可编辑+放大态不随插入操作缩小+资源码键蓝底白字(宽高不变)+无码/绑定键字体颜色对齐编辑键 // R143：favicon 双鲸鱼盘旋（撤销旋转恢复水平、紧贴轮廓、镜像双条、留白按宽高成正方形） // R141：favicon 再减1/3（画布占用63%）+manifest.json 补齐+双闭合标签/死代码清理+弹窗标题统一20px+材质蓝收敛到链接+btn-blue纯色合并 // R140：favicon 鲸鱼旋转 44° 对角占满画布（标签页图标调大）+回退 R138 顶栏 logo 40px（用户点名别动 logo） // R139：资源码下拉面板码/无码项改编辑弹窗类型列表同款 row-btn 按键（替换 R98 胶囊） // R138：分享复制去同步 execCommand（移动端点击卡顿/弹窗不消失根因）+回退 R134 箭头 path+顶栏鲸鱼 logo 调大 40px // R137：CSP 修外链视频图片 ERR_FAILED（SW 放行跨域）+admin 视频兜底卡+复制补全定时与绑定上限+时间选择器顺序+码按键统一 // R136：类型列表资源码/绑定/无码统一 row-btn 按键+绑定弹窗码行同款+设备名 uiTip // R135：悬浮框窄屏不缩小（取大的那个）+下拉刷新入场统一淡入+公告显示频率取消恢复 // R119 修订：视频兜底按键复用资源管理/分类管理行按钮（通栏居中版） // R118：登录/改密码/shop 提示统一 toast 胶囊+登录页灰字删除居中 // R117：R114 transition 回退+定时显示隐藏左右布局+柱悬浮行对齐 // R80：全站 toast 统一为下拉刷新同款蓝胶囊 // R75：折线悬浮框（上期 N）右对齐 // R73：全系统保留统一 60 天（stats/sessions/login_attempts/浏览记录查询） // R72：stats 保留窗口 30→60 天（30天档对比上期有数据） // R71：统计卡内容垂直居中（两状态） // R70：两图高度统一+图例进灰底+开启态用tab淡蓝 // R69：对比键文字=对比上期/显示本期、开启态淡蓝 // R68：柱状图灰底统一+刻度贴柱区+对比键独立于时间档组 // R67：对比上期键复用应用键样式+文字切换（比对上期/只看本期） // R66：悬浮用「咨询客服」全称、柱状图加灰色网格与左侧数字刻度 // R65：对比上期开关按钮 // R64：图例逐系列×逐期单独描述 // R63：sitemap 加回 /error // R62：悬浮时间格式化 // R61：本期/上期图例移到图下方 // R60：环比小字全量百分比（上期0起算↑100%） // R59：恢复错误页404语义+图表悬浮具体数 // R58：环比小字改↑↓百分比、箭头跟随柱高、折线图加上期虚线 // R57b：错误页收录地址修正为 /error // R57：统计环比+收录扩四页 // R56：移除骨架屏 // R55：动态sitemap/robots
const STATIC_ASSETS = [
  './',
  './index.html',
  './shop.html',
  './admin.html',
  './error.html',
  './manifest.json',
  './favicon.ico?v=183', // R171：带版本绕开浏览器 favicon 硬缓存（刷新闪旧图标根治）
  './assets/ui-common.css',
  './assets/ui-common.js',
  './assets/admin.css',
  './assets/admin.js',
  './assets/shop.css',
  './assets/shop.js',
  './assets/images/logo.png?v=181',
  './assets/images/kefu.png?v=181',
  './assets/images/qun.png?v=181',
  './assets/images/gzh.png?v=181'
];

// 安装：逐项缓存静态资源（单项失败不影响整体）
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(STATIC_ASSETS.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    })
  );
  self.skipWaiting();
});

// 激活：清理全部旧版本缓存，立即接管页面
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// 判断响应是否可缓存：必须 200，且 /assets 下的脚本/样式绝不允许是 HTML（防止缓存错误页）
function isCacheable(req, res) {
  if (!res || res.status !== 200 || res.type === 'opaque') return false;
  var url = (req.url || '').split('?')[0];
  if (/\/assets\//.test(url) || /\.(js|css)($|\?)/.test(url)) {
    var ct = res.headers.get('content-type') || '';
    if (/text\/html/i.test(ct)) return false;
  }
  return true;
}

function putCache(req, res) {
  var clone = res.clone();
  return caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); });
}

// 请求拦截
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;            // 只处理 GET
  if (req.url.includes('/api/')) return;       // API 不缓存，走网络

  // R137（用户 18:14）：跨域请求（外链图片/视频等）不由 SW 接管，直接放行给浏览器加载。
  // 根因：线上 _headers 的 CSP 对所有文件（含 sw.js 本身）生效，SW 里 fetch(跨域请求) 会被
  // SW 脚本自身的 connect-src 'self' 拦下 → 外链视频/图片 net::ERR_FAILED（此前"能看的视频
  // 只显示占位符"即此故）。放行后由页面 CSP 的 img-src/media-src（已允许 https:）直接管控，
  // 同时也不再缓存跨域 opaque 响应（本就不可读、徒增存储与陈旧问题）。
  try { if (new URL(req.url).origin !== self.location.origin) return; } catch (e) { return; }

  var url = req.url.split('?')[0];
  var isCode = /\.(js|css)($|\?)/.test(url);   // JS/CSS：网络优先

  // 页面导航：R34 网络竞速——有缓存时同时发起网络请求，网络在 400ms 内返回就直接给最新版页面
  // （修复：部署新版后访客刷新先看到旧版页面/旧图标、要再刷一次才更新的问题）；网络慢或失败时
  // 缓存秒回（保住手机跨页不白屏），网络完成后在后台写入缓存供下次使用。
  // 一致性保障：SW 版本升级时 activate 会清掉旧缓存，缓存里的 HTML 始终与当前 js/css 同代，不混搭。
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) event.waitUntil(putCache(req, res));
          return res;
        }).catch(function () { return null; });
        event.waitUntil(network); // 保持 worker 存活至网络请求完成，确保后台缓存更新可靠
        if (!cached) {            // 无缓存（首次访问/刚升级清空）：走网络，失败回错误页
          return network.then(function (res) {
            return res || caches.match('./error.html').then(function (e) { return e || Response.error(); });
          });
        }
        return new Promise(function (resolve) {   // 有缓存：与网络竞速
          var settled = false;
          var timer = setTimeout(function () {
            if (!settled) { settled = true; resolve(cached); }   // 超时：缓存秒回，网络继续后台更新
          }, 400);
          network.then(function (res) {
            if (settled) return;
            settled = true; clearTimeout(timer);
            resolve(res || cached);                // 网络够快：直接给最新版页面（不闪旧版）
          });
        });
      })
    );
    return;
  }

  // JS / CSS：网络优先（代码更新立即生效），网络失败才回退缓存；错误响应绝不缓存
  if (isCode) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (isCacheable(req, res)) event.waitUntil(putCache(req, res));
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || Response.error();
        });
      })
    );
    return;
  }

  // R172（用户 00:26）：图片/图标等静态资源改「网络优先 + 失败/非200回缓存」——
  // 原「缓存优先 + 后台静默更新」在图片更新后：刷新时先返回缓存旧图（旧图标显示一瞬间），
  // 网络新图只写回缓存、要再刷一次才可见，即"图标残留"的根因之一。
  // 与 JS/CSS 同款策略：网络成功立即给新图（配合 _headers 图片改 no-cache 校验）；
  // 网络失败或非 200（部署中间态 404）回退缓存秒回，保住弱网/更新窗口期可用。
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && isCacheable(req, res)) event.waitUntil(putCache(req, res));
      if (res && res.status === 200) return res;
      return caches.match(req).then(function (cached) { return cached || res; });
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || Response.error();
      });
    })
  );
});
