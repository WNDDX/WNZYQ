/**
 * 万能资源圈 Service Worker
 * 缓存策略：
 *  - 页面导航（index/shop/admin/error）→ 网络优先：每次打开都拿最新版，
 *    后台改动前台立即生效；离线时才回退缓存（无缓存回退到错误页）。
 *  - JS / CSS（业务代码频繁改动）→ 缓存优先 + 后台更新：缓存命中直接返回，不发网络请求；
 *    后台静默 fetch 更新缓存，确保 SW 版本升级时 activate 清旧缓存 + install 重新预缓存。
 *  - 图片等其他静态资源 → 缓存优先 + 后台更新（同 JS/CSS，减少弱网条件下的请求往返）。
 *  - /api/ 一律不缓存，始终走网络。
 *  - 任何非 200、或内容类型为 HTML 的 /assets 响应一律不缓存（防止错误页伪装成脚本/样式）。
 */
// R270（用户 09-27 17:30）：sw 缓存版本升级到 v267（封面图保存链路修复 + 预览弹窗轮播同步）。
// R280（老板 09-28 00:35「1.资源封面图不管是否轮播，固定展示框内宽或高取一维贴框、另一维按比例自适应；2.轮播切换小白点镶进图里不单独隔出；3.轮播 3 秒自动切换、切到最后循环回第一个」）：①shop.css/admin.css 封面固定展示框——单图封面（.modal-cover/.preview-cover）与轮播（.cover-carousel）同口径：框宽随弹窗内容宽（calc(100%-32px)、移动端 -24px）、框高定值 min(48vh,400px)，object-fit:contain 不裁不变形、一维贴框另一维按比例居中；占位/加载失败/加载中三态同尺寸（高特异性规则顶掉弹窗 16:9 占位通配），shop.js R258 按比例内联定型补丁与固定框冲突整体退役。②轮播小白点 .cc-dots 改 absolute 镶进展示框内底部居中（半透明黑胶囊底衬 rgba(0,0,0,.35)，任何图上都看得清），不再单独占布局空间。③轮播 3 秒自动切换循环收口——renderCarousel（shop/admin 同源两份）改元素级共享状态 st + 监听只绑一次（__ccBound，反复开关弹窗不再累积监听器），goToSlide 取模循环（自动/手动/拖动切到最后都回第一张）且任一切换后从头计 3 秒；弹窗关闭必停表——shop closeModal() 与 admin 预览三条关闭路径（×钮/底部关闭键/点遮罩）统一调 __ccPause/__stopPreviewCarousel，关了弹窗不再后台换图。
// R295（用户 09-30）：根因→全系统忙碌态样式统一：去省略号+旋转圈放到文字最后（v285→v286）。
// R298（用户 09-30）：根因→去掉每分钟后台对账+60天清理统一每天一次+缓存优先（v287→v288）。
// P2 选 B + P4 合并：完全去掉每分钟后台对账——全系统只在「进入页面或手动刷新」时拉数据。
// P16+P5：60 天清理统一每天一次——纯代码实现，不碰后台定时配置；跨天首访触发，先检查真有旧数据才删。
// P15：缓存优先——JS/CSS/图片一律缓存优先+后台更新，文件没变不重复下载。
// R303（用户 09-30）：P1/P7/P11 翻页按页拉取 + P13 列表 diff 更新 + U3 解锁超时（v288→v289）。
const CACHE_NAME = 'wnzyq-v484'; /* v484：v483 清残壳时顺手删了没有 select 的 .select-picker，把「字号」整个删没了（截图确认只剩字体）。改成只精准删 select 左边那一个显示层。 */ /* v483 /* v483：字体/字号把自制下拉换回原生 select 后，旧显示层（带箭头的『字体 ▸』）没清干净，界面上出现两个「字体」（截图确认）。换完再扫一遍删残留死壳。 */ /* v482 /* v482：重复导入补全——原来商品名已存在就整条跳过，若第一次没带封面/链接，之后再导也补不上（实测 3 条封面链接一直空）。现在命中重复时把缺的 cover / src_url / 平台归属补上。 */ /* v481 /* v481：导入解析结果暴露到 window.__lastSheet（排查「封面链接没带进来」用）。 */ /* v480 /* v480：xlsx 导入认列修——底层 __rowsFromSheet 无条件砍掉第一行当表头，__parseAnySheet 拿到的是纯数据，没有列名，封面和链接全丢（实测 3 条标题对、封面链接空）。给 __rowsFromSheet 加 keepHeader 并透传；另加「按值嗅探」兜底：图片后缀的当封面、其余 http 当链接。 */ /* v479 /* v479：xlsx 导入修——parseXlsx 返回「表名→行数组」的对象，__parseAnySheet 却按数组遍历，一上传 xlsx 就报 (sheets||[]).forEach is not a function，导入功能等于不可用（实测踩到）。 */ /* v478 /* v478：勾选商品不再整页重绘——原来点一下就把整个网格换掉，连点两个卡片第二次会点在已被替换的旧节点上（实测「勾 2 个只选中 1 个」），也会闪、丢滚动位置。改成只更新该卡片 + 已选计数 + 批量按钮。 */ /* v477 /* v477：goods.clear 支持 all / platform_id=0（清空商品池 / 只清未归平台的），清 48 条孤儿商品时逐条删要几分钟。 */ /* v476 /* v476：删平台时把它采来的商品置为「未归平台」而不是留成孤儿——实测删平台后商品 platform_id 指向已删平台，按平台筛永远看不到，界面显示「0 个」但库里还占着（这次实测就是这么被误导的）。 */ /* v475 /* v475：（编辑器真修）实测发现工具条按钮不是全局委托，而是按 #detailRteToolbar 逐个 addEventListener —— 克隆出来的工具条一个事件都没有，所以「我的说明」里点加粗毫无反应（上一版只对比了按钮数量，误判为已统一）。现在把绑定抽成 bindRteBar(barEl, editorEl) 并暴露，克隆后直接挂同一份逻辑；字体/字号把运行时的自制下拉换回原生 select 再绑 change；updateRteActive 改为按当前焦点编辑器找工具条，克隆的按钮也有激活态。 */ /* v474 /* v474（v473 实测热修）：①建表/改表原本每次请求都跑十几条 DDL，实测一次 POST 要 4~6 秒，改成 isolate 内只跑一次 ②前端 api() 加兜底——请求超时或返回非 JSON 时 Promise 一直挂着，保存按钮永远停在「保存中…」（实测确认），现在统一转成 {ok:false,msg} 并提示重试，超过 6 秒按钮改文案「还在处理，请稍候…」 */ /* v473 /* v473（老板：很多解析不了、粘贴没有、编辑器不对、功能太简陋）：①解析器重写——旧版标签剥离会在属性里的 > 处切断，把 aria-label=\"查看XX卡 当标题、留下 \"pan> 竣工即可交付\"；改引号安全剥离；图片过滤不再整体排除 /static/ /assets/（很多站商品图就在那里）；标题收紧为「含卡/WiFi/宽带且带运营商或数字」；同标题去重。实测 77 个站从 21 命中 → 同样 21 但脏数据清零、漏抓的整页回来（haokamao 23→101）②粘贴解析补上入口：粘商品链接（find.one）/ 粘整页内容（从剪贴板 HTML 提图）两条路都在③编辑器改为克隆系统 #detailRteToolbar——字体/字号/颜色/表情/引用/表格/插图/放大全部与系统一致④新增导入：吃对方后台导出的 xlsx/csv，或直接贴多行⑤上架前确认窗：预览、改标题、选分类（按标题自动猜）、填价格；支持批量勾选一次上架⑥商品池可搜索/分页/按状态筛、可改标题封面、可看详情图⑦采集记录：成功失败都留痕，失败给原因并可重试 */ /* v472：新增 goods.clear（一次清空某平台采集来的商品）—— 逐条删 240 条要几分钟，接口一次 SQL 搞定。 */ /* v471 /* v471：平台保存后改成就地更新列表 + 先关窗再回刷（原来等 loadAll 回刷，弹窗关得晚、下拉还是旧的，看着像没保存成功）；并补 .catch 避免静默失败。 */ /* v470 /* v470（老板重新定义：不是台账，是采集工具）：①撤掉「外部链接」页签，改成平台设置里一个按键「外部商品采集」，点出弹窗 ②平台档案精简为：平台名 / 商城地址（抓这个）/ 后台地址（打开平台跳这里）/ 我的说明（轻量富文本，可加粗斜体列表链接），去掉域名和结算说明 ③采集：服务端抓商城页 → 通用解析（围绕商品图找标题+下单链接，不依赖 class 名，适配多种号卡模板）→ 入商品池；抓不到的前端渲染站会明确提示 ④商品池：封面网格 + 勾选 + 批量删 ⑤「上架」= 按需抓该商品详情长图，关掉弹窗并预填进「新增资源」，价格和分类由老板自己补 ⑥不抓价格。 */ /* v465 /* v465：搜索框加 type=search + autocomplete=off —— 浏览器自动填充会把登录用户名灌进搜索框（实测灌成 1747358421），用户一点搜索就搜错东西。 */ /* v464 /* v464：①封面图裂图修复——号卡图床有防盗链，带本站 Referer 会被拒，img 加 referrerpolicy=no-referrer ②只有 1 个平台时即使停在「全部」也显示该平台的说明卡（否则新建完看不到自己写的话，以为没保存） */ /* v463 /* v463（实测真实平台后修）：商品页是 hash 路由 https://ck.nxqingxian.cn/shop#/pages/goods/index?goodsId=2163&promoCode=xxx —— pathname 只有 /shop，参数全在 # 后面，原来既读不到 goodsId、又被路径里的 /index 误判成「列表页，结算会对不上」。改为 hash 一起纳入判断、认 goodsId/productId/skuId 这类驼峰参数、并把危险的 /index 从黑名单去掉。 */ /* v462 /* v462：①粘贴提取加「按实际尺寸筛图」——实测号卡商城商品页混着 200x200 的底部 tabbar 图标与 popup-default.png，光过滤 URL 不够 ②新增「巡检」键：把超一天没看的挑出来逐个点开，点开即记巡检时间（一天一次）③新增「导出」：CSV 带 BOM，Excel 直接打开不乱码 */ /* v461 /* v461：粘贴商品页后本地按关键词表自动判定状态（已售出/已下架/待核对/在售），并在弹窗里提示命中了哪个词 —— 老板拍板「已售出全靠页面判断」，不该让他自己选。 */ /* v460 /* v460（外部链接热修）：Cloudflare 把执行偏慢的 POST 重跑一次，而 INSERT 不幂等 —— 实测点一次保存、只发 1 次 fetch，库里出现两条同样的平台/链接。给写操作加请求幂等键 reqId（前端生成、后端唯一索引 + 撞了返回原 id），重复请求不再插第二条。 */ /* v459 /* v459（外部链接台账第一版，老板拍板方案 v3）：后台新增「外部链接」页签 —— 只记标题/封面/描述（文字 + 图或视频链接），不取价格；平台档案可自建（任意平台），每个平台可写自己的说明（可编辑）；登记支持 Ctrl+V 粘贴商品页，从富文本 HTML 里提取标题/封面/描述图与视频；商品链接做详情页形态校验（列表页/搜索页会提示结算对不上）；状态四档（在售/已售出/已下架/链接失效/待核对）按关键词表判定，已售出单列不算异常；权限新增 external.* 一组并接入账号表单。 */ /* v458（老板：信息中心的筛选失效 + 明细时间口径）：①「只看」下拉永远是空的 —— 该 select 被自制下拉包装后，代码用 dataset.sp 判断就跳过重建 options，等于一个具体人都选不了；改为无论是否包装都重建，再刷新下拉面板。②类型筛选越筛越空 —— render 把 d.recent 覆盖成已筛选结果又存回 __lastInfo，下次从这份被截断的数据再筛，实测 100 条→选浏览资源 2 条→改咨询客服 0 条→切回全部仍 0 条；改为把原始全量存 d.__ctRaw，任何切换都从它筛。③明细窗口 7 天 → 24 小时（老板：一天内的可以了），顶部显示「数据截至 HH:MM」。 */ /* v457（xlsx 解析热修）：解析器用一条正则卡死了 rels 里 Id 必须在 Target 之前 —— 而 WPS/openpyxl 存出来的文件是 Type/Target/Id 顺序，于是一张工作表都匹配不到，上传自己下载的模板反而解析出 0 条。改为逐标签整段取 Id 与 Target（与属性顺序无关），并把 target 路径归一（/xl/...、worksheets/...、../worksheets/... 都能定位）。 */ /* v456（老板两条反馈）：①电脑端设置页部分弹窗鼠标滚轮完全滑不动 —— 弹窗内 .form 自带 overflow:auto 与 overscroll-behavior:contain，但内容往往不溢出，滚轮既滚不动它、又被 contain 掐断了向 .modal-box 的传递；改为弹窗内表单容器 overscroll-behavior:auto，并让 PC 滚轮不再被全局拦截（body/html 已锁，拦 wheel 属多余）。②批量导入模板改真 .xlsx —— 老 SpreadsheetML 的 DataValidation 在 Excel/WPS 里下拉箭头根本出不来；现在手写 OOXML（store zip + dataValidations），7 处下拉（所属分类/显示状态/分类级别/所属一级分类），列序对齐编辑窗口、表头冻结、列宽与边框；上传解析同时支持 xlsx（store 与 deflate 两种压缩）和老 .xls。历史迭代说明见 HANDOVER.md。 */
/* wnzyq-v439 台账 */ /* v439（总账定夺大批次 21 项）：#57 详情图懒加载 #58 核实SW已覆盖（维持 no-cache 即时生效拍板）#59 v436 已覆盖（画布保底+元信息）#61 上传提示语统一 #63 新设备登录记录（admin_logins 表+设备描述解析，信息中心「设备登录」条目）#64 变更留痕 audit_log（资源增删改/分类/设置/回收站，60 天清扫覆盖）#66 核实已存在（复制按钮）#67 筛选记忆（会话级保存恢复）#68 数据缓存（复检定名「数据缓存」：资源/分类/公告软删除保 60 天，删除改软删+全部查询排除+恢复/彻底删+平台设置「数据缓存」入口+60 天日清扫接线）#69 导入实时回显（逐条状态即时追加）#72 分享卡动态化（og 换当页封面标题）#79 超大图检测+压缩替换（原图保留可恢复，本地映射）#80 每日静默体检（复检改版：异常写提醒进信息中心置顶条+去查看直达体检，不再挂按钮红点）#82 动态弹窗 aria+对话框语义 #83 全站 tabular-nums #84 弹窗打开聚焦关闭键 #89 添加到桌面 C 方案拍板版（每 10 次访问提示一次，已安装不提示，复用顶部 .ui-toast 统一样式可点击直达安装，文案「添加到桌面-点击可直达」）#90 离线横幅 #91 滑切成功触感 #97 统计转化漏斗（浏览→解锁→绑定）#98 资源码爆破防护（同设备连错 10 次锁 15 分钟）+上传防刷 30→60 次分 #106 智能搜索（拼音首字母 localeCompare 分带+子序列容错）#110 /rss 订阅源+页头声明 #115 体检健康诊断分组（SW/后端/存储）#118 公告阅读统计（track ann_read+信息中心条目）#119 核实 sitemap 为纯静态页无需自动化 #116 多管理员设计方案已成文档待拍板 #74 回头客专题 8 方案入总集 */
// wnzyq-v438：红点修正+系统体检 */ /* v438（老板复检 3 条）：①红点位置修复——.tab 公共样式无 position:relative，红点 absolute 飞到页面右上角（截图实锤），topbar-actions .tab/.ann-tab/.ann-title 补宿主定位 ②公告项级红点——已读集合口径（wnzyq_ann_read 数组+旧 seen 兼容）：公告弹窗内每个未读页签带红点（复用 .dot-badge 全站唯一款），点开该页签看过即消，标题页签同理；顶栏红点=存在未读公告，不再打开弹窗一键全读 ③图片体检升级为「系统体检」三合一：失效图片（缩略图+「去处理」一键定位到资源编辑弹窗）+重复图片引用（同 URL 多处使用分组列出）+外链可达性检测（no-cors 测域名可达性，跨域限制如实标注）④#7 死链检测合并入系统体检 */
// wnzyq-v437：副标题/绿键/红点/模板专业化 */ /* v437（老板 6 条复检）：①导航页副标题「共 个资源」四字跟按键同帧出现（数字留位，接口回来 countUp 填入，不闪动）②咨询客服跳转键绿=本地实测 rgb(0,168,40) 正确（老板看到的蓝=线上旧版），兜底弹窗 kfFallback 的键也补 green 全路径统一③公告红点三处半成品修复（__mkDot 未定义/静态红点缺失/版本号与时间戳口径互斥）——topAnn 静态 dot-badge+公告最大 id 版本号口径+点开记版本，dot-badge 基础样式上移 motion.css 全页共享；信息键红点 infoDot 早已在（delta.bind/contact>0 亮）④三角全系统核查：七个切换点动画全覆盖（信息弹窗/信息中心/edContact=.info-panel 0.18s、统计折叠=grid-rows、shop 分类栏/recent-bar 0.18s、箭头 rotate），空内容回退 v413/v416/v421 已覆盖可空场景⑤批量导入模板大改：列名专业化无括号描述（资源标题/所属分类/资源简介/资源价格/封面图片链接/资源码/显示状态等）、真下拉（分类选项/级别/显示状态三列下拉源+DataValidation）、全单元格居中、每表首行冻结、新增使用说明页、文件名与统计导出同规格「年月日-时分」⑥统计导出同步：文件名改 YYYYMMDD-HHMM-数据统计.xls+每表首行冻结 */
// wnzyq-v436：错误页首载闪深色修复 */ /* v436（老板复检：错误页首载偶发深色，刷新恢复）：根因=外层 CSS 到位前浏览器画布跟随系统/浏览器深浅色（error 页唯一样式层 motion.css 的 :root 连 color-scheme:light 都没有，深色 UA 环境画布即黑）。修复：①motion.css :root 补 color-scheme:light（dark 块已有 dark 对应）②四页头部主题脚本后加「首屏画布保底」内联样式——html 画布深浅两态直接钉死（浅=#f2f7fd/深=#0e1621，error 亮态含渐变 background-image），CSS 慢一拍也不闪。实测：外层 CSS 延迟 2.5s，四页×深浅两态首帧画布 16/16 全对且 CSS 到位后零跳变 */
// wnzyq-v435：批量工具按键照修改密码组同款 */ /* v435（老板截图复检）：平台设置「批量导入/图片体检」照「修改密码」组同款——独立白色 setting-group 卡片内、标签+按钮各占一行堆叠、btn-blue btn-inline-pd 自适应键宽（撤 flex 半屏拉满与卡片外游离） */
// wnzyq-v434：#45回退/专属内容点击解锁/批量工具行/信息中心3bug/#32空态合并 */ /* v434（老板复检 5 条）：①#45 大字模式整体回退（老板未要求过，三处全撤）②资源专属内容撤「打开弹窗静默解锁」+撤缓存自动展开——一律点击后才获取展示（有码=点解锁，已绑定设备免输码服务端放行；无码=点直接获取）③平台设置「批量导入/图片体检」独立批量工具行（不再挤进设置信息行）+向导内上传 label 键补垂直居中④信息中心修复：lsGet 无限递归 bug（键缺失时自调自身=RangeError 迁移永不生效）、markSeen 存带 Z 的 ISO 服务端不认（改为同系 UTC 秒格式）、服务端正则接受 Z 归一化、30 天下限 +8h 偏移修正、全 0 时空态补说明（管理员自己浏览不计入统计=R168-② 拍板口径）⑤#32 空态组件合并：wn-empty 从 motion.css 并入 ui-common.css 空态族单一来源 */
// wnzyq-v433：#38魔数#39防刷#40图片体检#8第一批52处 */ /* v433（总账续）：#38 上传文件头魔数校验（png/jpg/gif/webp/mp4/webm，伪装即拒，image/video 双接口）#39 上传接口防刷 30 次/分钟（内存滑动窗，429 提示）#40 平台设置新增「图片体检」——巡检全部资源封面/封面组/详情图，失效列清单弹窗（按需触发）#45 资源页顶栏新增「大字」开关——内容区 zoom 1.15 顶栏不挤，localStorage 记忆；#55 跳过（__fmtDateTime 统一格式化器已存在，唯一变体是 v386 拍板的紧凑显示）#8 第一批：admin.html 52 处字体/字号选项内联收编为 ff 与 fs 前缀工具类（114→62，display:none 切换类按『不改原理逻辑』保留） */
// wnzyq-v432：批量导入全链路收口 */ /* v432（批量导入收口）：#29 全链路打通——preview 键名未同步 pv.res→TypeError 吞预览（真凶）修复；实测预览纠错（资源2/分类1/公告1+缺标题抓准）→确认导入→分类/资源/公告 3 请求按序入库全 ✓ */
// wnzyq-v431：批量导入第一版向导 */ /* v431（#29 批量导入第一版）：平台设置新增「批量导入」向导（assets/admin-import.js）——模板现场生成含分类下拉（SpreadsheetML 同导出格式）/上传解析/预览纠错/按 分类→资源→公告 顺序入库/导入前自动提示；复用现有 api() 与弹窗骨架 */
// wnzyq-v430：og分享卡/公告红点/同名查重/快捷键 */ /* v430（总账续）：#46+#51 四页补 og 分享卡+description #48 公告未读红点（复用 dot-badge，看过消失，localStorage 记已读）#53 资源标题同名失焦提醒 #56 管理页快捷键 N=新增 /=搜索 */
// wnzyq-v427：总账定夺执行（红绿统一/白底变量/格式/台账/aria/死代码） */ /* v427（总账定夺执行）：#2 红统一#ff4444→#c62828（9处）#6 绿统一#2e7d32→#01c000 #3 白底写死换var(--card-bg)（25处，仅background属性）#16 格式统一（60处冒号空格）#14 层级台账注释表（ui-common顶部）#12 shop.js _okf 死变量清 #4 导航4键+错误页4链接补aria-label（8处）；#17-21 自查消化：删除已改乐观删本就不弹框/解锁实测通过/其余为探针时序；#25 导出已存在跳过 #33 视图记忆已存在跳过 #15 --radius为小件档合理跳过 #5 确认仅标题默认词免改 */
// wnzyq-v422：滑动三层合成层加固 */ /* v422（老板复检：滑动切换卡顿专项）：__fs 舞台/轨道/邻居面板三处合成层加固——track 加 backface-visibility+contain:layout style+pointer-events:none（拖拽中屏蔽子元素命中），stage 加 contain:layout paint，pB 独立合成层——拖拽全程单层 transform 走合成器，杜绝真机拖拽帧布局抖动与悬停干扰 */
// wnzyq-v421（老板部署后复检 8 条）：输入框只显保存值/折线图矢量锁/信息弹窗空内容自收/滑动分层(内层auto→弹窗跟滚,主滚区contain)/公告行nowrap/分组口径(主组=拖柄名称排序三角,操作组=显示删除) */ /* v421（老板部署后复检 8 条）：①设置信息输入框只显保存值（出厂默认回显=莫名链接，跳转兜底保留在跳转逻辑）②折线图 vector-effect 锁描边/圆点物理尺寸治拉伸变形 ③信息弹窗三角展开内容为空自动收起（与资源页空分类同口径）④滑动分层修正 v418：内层(公告列表/编辑器/选择面板)到头→弹窗跟滚(auto)，弹窗主滚区(.modal-box/.form)到头→不带动整页(contain) ⑤公告行 flex-wrap:nowrap 强制一组一行+名称框缩约1/3 */
// wnzyq-v418（老板4条）：部署诊断+举一反三9处contain漏网+5处picker钳制巡检 /* v418（老板 4 条：为何没生效+举一反三+逐点证据）：【部署诊断】线上 wnzyq.pages.dev 实测 sw.js=wnzyq-v415——v416(11条)+v417(7条)共 18 条修复从未部署上线，老板测线上看到的全是旧文件（已出对照证据）【举一反三实锤】v416 条④的弹窗 contain 被 9 处 v375 旧 auto 规则覆盖：admin.css 三档弹窗 .form（ID 特异性压过 ui-common）、.modal-box、.ann-list、cat-picker-panel、rte-editor !important 组；shop.css 公告弹窗 .ann-box/.ann-body；ui-common 命令面板 .cp-list——全部统一改 contain（实测编辑弹窗 form auto→contain、详情弹窗滑到底页面位移 0px）【全系统巡检】picker 面板钳制 5 处（编辑分类/新增父分类/批量改分类/公告频率/页面筛选）全过；三角动画 admin 96 颗+shop 2 颗零缺失；首滑详情弹窗 283px 即生效；闪动采样五弹窗稳定 */
// wnzyq-v417（老板 7 条复检）：①弹窗数据加载闪动治理——公告列表渲染改「前量后切」max-height 过渡（实测 583→634 瞬跳→平滑），五大弹窗高度采样全部稳定 ②编辑器放大根治黑幕——body.rte-zooming::after 45% 黑幕有堆叠上下文陷阱（祖弹窗 z2000 困住编辑器 z6000，黑幕反盖放大编辑器=「屏幕变黑、放大像没生效」手机尤甚），两层黑幕全撤（::after + 编辑器 0 0 0 100vw 暗幕铺满），只留柔和投影；手机电脑放大几何实测同步（手机 324×150→374×766 全屏白亮）③表情面板接系统滑动标准 __bindSwipeSwitch——横滑 48px 切上/下一类+拖动跟手 0.3 阻尼+方向滑入动画+滑动落点防误点 ④类型/套餐手机档绑定键「资源码」112→100px 与码键统一（列宽 76→100px），电脑档 112 全员一致本就达标 ⑤弹窗首滑失效根治——__blockTouch/__blockWheel 真正落地「能滚一律放行」（v336 注释许诺未实现），白名单漏网容器/遮罩留白带首滑不再被吞 ⑥封面图区 justify-content:center（有图/空态+占位都居中，实测偏移 0px）⑦cat-picker 面板钳制在所属弹窗盒内——原 264px 定高在弹窗下半部冲出底缘 45~53px 悬在遮罩上，改弹窗盒为界+下方不足自动上翻+高度自适应（保底 96px） */ /* v417（老板 7 条复检）：①弹窗数据加载闪动治理——公告列表渲染改「前量后切」max-height 过渡（实测 583→634 瞬跳→平滑），五大弹窗高度采样全部稳定 ②编辑器放大根治黑幕——body.rte-zooming::after 45% 黑幕有堆叠上下文陷阱（祖弹窗 z2000 困住编辑器 z6000，黑幕反盖放大编辑器=「屏幕变黑、放大像没生效」手机尤甚），两层黑幕全撤（::after + 编辑器 0 0 0 100vw 暗幕铺满），只留柔和投影；手机电脑放大几何实测同步（手机 324×150→374×766 全屏白亮）③表情面板接系统滑动标准 __bindSwipeSwitch——横滑 48px 切上/下一类+拖动跟手 0.3 阻尼+方向滑入动画+滑动落点防误点 ④类型/套餐手机档绑定键「资源码」112→100px 与码键统一（列宽 76→100px），电脑档 112 全员一致本就达标 ⑤弹窗首滑失效根治——__blockTouch/__blockWheel 真正落地「能滚一律放行」（v336 注释许诺未实现），白名单漏网容器/遮罩留白带首滑不再被吞 ⑥封面图区 justify-content:center（有图/空态+占位都居中，实测偏移 0px）⑦cat-picker 面板钳制在所属弹窗盒内——原 264px 定高在弹窗下半部冲出底缘 45~53px 悬在遮罩上，改弹窗盒为界+下方不足自动上翻+高度自适应（保底 96px） */
// wnzyq-v416（老板 11 条大单）：①设置信息输入框显示生效值——保存值||出厂默认（不再空框猜状态）②设置信息弹窗点遮罩关闭统一（与全系统弹窗口径一致）③三角展开收起动画全系统统一（分类筛选/状态筛选/分类管理 cp-children max-height 双向过渡）+空分类自动收起+编辑器收起闪动修复（rte 工具栏先量后切）④弹窗内滑到顶/底 overscroll:contain 分层——弹窗内不带动整页，页面级保持 auto（ui-common.css 六处+shop.css 详情弹窗）⑤导航页副标题防闪动——btn-sub min-height 占位+填充后 visible（还有 v402 悬空 .btn-item{ 括号吞手机档一并修复）⑥网格资源卡显示检查通过 ⑦滑动过程中跟手过渡——__swipeOnMove 宿主回调+__fs-track 单轨化（与轮播 cc-track 同构），不再只成功后才动 ⑧公告拖柄/名称/排序一行化（sortEl 56→40px，不换行不遮挡）⑨折线图手机/电脑高度统一——lineSvg preserveAspectRatio=none height:200px（修掉 admin.html thead 损坏）⑩底部留白统一 ⑪加载截断防御——首屏 total>0 但 list 空&&已有旧数据时保留旧数据+toast 提示（fetchRemote/分类空响应双防御） */ /* v416（老板 11 条大单）：①设置信息输入框显示生效值——保存值||出厂默认（不再空框猜状态）②设置信息弹窗点遮罩关闭统一（与全系统弹窗口径一致）③三角展开收起动画全系统统一（分类筛选/状态筛选/分类管理 cp-children max-height 双向过渡）+空分类自动收起+编辑器收起闪动修复（rte 工具栏先量后切）④弹窗内滑到顶/底 overscroll:contain 分层——弹窗内不带动整页，页面级保持 auto（ui-common.css 六处+shop.css 详情弹窗）⑤导航页副标题防闪动——btn-sub min-height 占位+填充后 visible（还有 v402 悬空 .btn-item{ 括号吞手机档一并修复）⑥网格资源卡显示检查通过 ⑦滑动过程中跟手过渡——__swipeOnMove 宿主回调+__fs-track 单轨化（与轮播 cc-track 同构），不再只成功后才动 ⑧公告拖柄/名称/排序一行化（sortEl 56→40px，不换行不遮挡）⑨折线图手机/电脑高度统一——lineSvg preserveAspectRatio=none height:200px（修掉 admin.html thead 损坏）⑩底部留白统一 ⑪加载截断防御——首屏 total>0 但 list 空&&已有旧数据时保留旧数据+toast 提示（fetchRemote/分类空响应双防御） */
// wnzyq-v415（老板 5 条复检）：①跳转键分色——kf-jump 基础改蓝（与交流群聊/公众号讯入口键一致），仅咨询客服传 opts.green 走 .kf-jump-green 绿变体（导航页三键/资源页客服/管理端客服/预览 contact 全部接线）②资源页公告键常亮——MutationObserver 监听 annModal 开合驱动 topAnn.active（v409 漏了资源页这颗）③滑动首滑体验：空闲预取 1500→500ms（第一次甩就有邻居缓存）+分类表空响应防御（后端偶发空分类不得清空 DATA.categories=滑切序列只剩全部的隐患）；连甩 4 连实测全通 ④设置信息链接真修——跳转链接输入框回填键名 qrKey→urlKey（写错键=链接永远显示不出来的根因）；kf 弹窗链接显示行整体撤除（老板澄清诉求在输入框不在弹窗）⑤三角内容动画全面统一：分类/状态筛选下拉面板 display 瞬切→双向滑动淡入淡出（0.18s，参考分类管理口径，v413 面板归属防御保证 .open 同步）；编辑器工具栏展开/收起补 max-height 双向滑动
// v321 及更早版本改动记录已归档 .workbuddy/交互方案/ 与历次对账文档（本文件只保留运行所需代码）

/* v336 条8：预缓存只留访客必需——admin.js/admin.css/qrcode 改为运行时按需入缓存（普通访客省约 700KB） */
/* v349 调整：
   ① 去掉 './admin.html' —— 后台页面约 125KB，却被写进"访客必需"清单，
      等于每个访客第一次进站都要白下载一遍后台页面。后台本来就是运行时按需入缓存。
   ② 补上三个图标（192/512/苹果）——manifest 和四页都引用，之前没预缓存，
      断网或"装到桌面"时图标会裂。
   ③ 路径写法统一成 './'（原来 /config.js 与 /favicon.ico 用绝对路径，可能缓存成两份）。 */
const STATIC_ASSETS = [
  './index.html', /* v356 条24：去掉 './'——与 index.html 同一文件，原清单会拉两遍存两份 */
  './shop.html',
  './error.html',
  './manifest.json',
  './config.js',
  './favicon.ico',
  './assets/ui-common.css',
  './assets/ui-common.js',
  './assets/motion.css',
  './assets/motion.js',
  './assets/shop.css',
  './assets/shop.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/images/logo.png?v=330'
  /* v383：kefu/qun/gzh.png 三张二维码移出预缓存并删除文件——二维码改走后台「设置信息」（/img/ 动态地址，访客端按需加载） */
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

  // 一致性保障：SW 版本升级时 activate 会清掉旧缓存，缓存里的 HTML 始终与当前 js/css 同代，不混搭。
  // 页面导航：R215（老板 09-21 实测反馈：加载瞬间闪旧图标，历史复发）根治改版——
  // R34 的「网络竞速 400ms」在弱网/部署冷启动时会让旧缓存 HTML 先赢一帧：整页旧版渲染
  // （含旧 logo/旧图标），网络返回后再由后台更新缓存，下一次刷新才正常——即"旧图标闪现"的根因。
  // 改为严格网络优先：导航永远等网络最新版；仅网络彻底失败（离线）才回缓存秒回（不白屏）。
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) event.waitUntil(putCache(req, res));
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./error.html').then(function (e) { return e || Response.error(); });
        });
      })
    );
    return;
  }

  // R298：JS / CSS / 图片 / 其它静态资源 → 缓存优先 + 后台更新
  // 缓存命中直接返回，不发网络请求；后台静默 fetch 并更新缓存。
  // SW 版本升级时 activate 清旧缓存 + install 重新预缓存，确保代码/图片更新必生效。
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (isCacheable(req, res)) event.waitUntil(putCache(req, res));
        return res;
      }).catch(function () { return cached || Response.error(); });
      return cached || network;
    })
  );
});
