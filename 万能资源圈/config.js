/**
 * ============================================
 *  万能资源圈 · 商品小店【本地预览数据】
 * ============================================
 *  【作用】
 *  1. 本地预览：双击打开 shop.html 时，页面用它展示数据
 *  2. 部署兜底：万一后端数据没拉到，前台自动用这里的数据
 *
 *  部署到 Cloudflare 并完成"后台初始化"后，商品和分类以管理后台为准，
 *  在 admin.html 后台里增删改/上下架即可，这个文件就不需要再改了。
 *
 *  【图片说明】
 *  - 仅 logo 用本地图片：assets/images/logo.png（替换这个文件即可）
 *  - 商品封面、详情图、类型图、视频都用网络 URL（https://...）
 *  - 下面示例商品暂时用了本地 assets 里的占位图，部署后请在后台换成你的网络图片 URL
 *
 *  【价格说明】
 *  - price 字段：写了价格则显示，不写或 0 = 免费（免费不显示价格）
 *  - 类型也有 price：选中类型时显示类型价格，类型价格优先于商品价格
 *
 *  【描述超链接】
 *  - detail 和类型 desc 支持 HTML 超链接：<a href="https://...">文字</a>
 *  - 后台编辑时可点"插入超链接"按钮自动生成
 * ============================================
 */

const SHOP_CONFIG = {
  // —— 店铺信息 ——
  shopName: "万能资源圈",
  shopLogo: "assets/images/logo.png",
  // 全局默认客服链接（商品或类型没单独设置时，联系客服按钮跳这里）
  defaultContactUrl: "https://work.weixin.qq.com/kfid/kfc39748ad948e8b691",

  // —— 分类列表（支持两级：parent_id=0 为一级分类，否则为某一级分类的子分类） ——
  categories: [
    { id: 0, name: "全部", parent_id: 0 },
    { id: 1, name: "学习资源", parent_id: 0 },
    { id: 11, name: "医学考试", parent_id: 1 },
    { id: 12, name: "职业资格", parent_id: 1 },
    { id: 2, name: "软件工具", parent_id: 0 },
    { id: 3, name: "设计素材", parent_id: 0 },
  ],

  // —— 示例商品（测试用，部署后在后台替换为你的真实商品） ——
  productList: [

    // 商品1：商品有价格 + 类型也有价格（类型价格优先）+ 描述含超链接 + 资源码区分类型
    {
      id: 1,
      cid: 11,
      title: "执业医师考试精品课程合集",
      desc: "涵盖内外妇儿全科目，名师精讲+真题解析",
      detail: "本课程包含 2026 年最新考试大纲全部考点\n名师团队逐章精讲，配套思维导图\n历年真题解析 + 模拟题库，助你一次通过\n<a href=\"https://example.com/syllabus\">点击查看完整课程大纲</a>",
      img: "https://picsum.photos/seed/course/400/300",
      detailImages: ["https://picsum.photos/seed/design/600/400", "https://picsum.photos/seed/vip/600/400"],
      detailVideos: [],
      contactUrl: "",
      price: 199,
      // 资源码说明：在每个类型（variant）里单独配置，不同类型资源码不同；不配置则该类型不显示资源码输入框
      variants: [
        { id: 1, name: "基础班", desc: "基础班内容：\n- 全部考点精讲视频\n- 配套电子讲义\n- 在线题库", img: "https://picsum.photos/seed/exam/400/300", video: "", contactUrl: "", price: 99, sort: 0,
          resourceCode: "JC2026",
          resourceContent: "<h4>🎁 基础班资源已解锁</h4><p>✅ 全部考点精讲视频（百度网盘）</p><p>✅ 配套电子讲义（PDF）</p><p>✅ 在线题库账号</p><p>🔗 <a href=\"https://pan.baidu.com/s/jichu\" target=\"_blank\">点击下载基础班资源</a>（提取码：jc88）</p><p style=\"color:#999;font-size:12px;margin-top:10px;\">基础班资源，永久有效。</p>"
        },
        { id: 2, name: "VIP班", desc: "VIP班内容：\n- 基础班全部内容\n- 一对一答疑辅导\n- 考前押题卷\n- 不过免费重学", img: "https://picsum.photos/seed/software/400/300", video: "", contactUrl: "", price: 299, sort: 1,
          resourceCode: "VIP2026",
          resourceContent: "<h4>👑 VIP班专属资源已解锁</h4><p>✅ 基础班全部资源</p><p>✅ 一对一答疑辅导（微信）</p><p>✅ 考前押题卷（3套）</p><p>✅ 不过免费重学保障</p><p>✅ VIP专属学习群</p><p>🔗 <a href=\"https://pan.baidu.com/s/vip\" target=\"_blank\">点击下载VIP班资源</a>（提取码：vip66）</p><p style=\"color:#ff6b35;font-size:12px;margin-top:10px;\">VIP专属服务，添加客服微信开通答疑。</p>"
        },
      ],
      is_online: true,
    },

    // 商品2：商品有价格，无类型 + 带详情视频
    {
      id: 2,
      cid: 2,
      title: "医疗项目全栈开发源码（SpringBoot+Vue）",
      desc: "完整可运行项目，含后端+前端+数据库+部署文档",
      detail: "项目特点：\n- 后端：SpringBoot + MyBatis + MySQL 8.0\n- 前端：Vue + ElementUI\n- 含完整 SQL 脚本和部署文档\n- 支持硬件 SDK 对接示例\n- 视频演示见下方",
      img: "https://picsum.photos/seed/software/400/300",
      detailImages: ["https://picsum.photos/seed/card/600/400"],
      detailVideos: ["https://www.w3schools.com/html/mov_bbb.mp4"],
      contactUrl: "",
      price: 299,
      variants: [],
      is_online: true,
    },

    // 商品3：免费商品（price=0，不显示价格）+ 无资源码直接查看专属内容
    {
      id: 3,
      cid: 3,
      title: "电商主图设计模板包（100套）",
      desc: "PSD源文件，直接替换文字和图片即可使用",
      detail: "包含 100 套电商主图模板：\n- 涵盖服饰、美妆、3C、食品等类目\n- 全部 PSD 分层源文件\n- 尺寸：800x800 主图 + 750x1000 详情页\n- 附赠字体包",
      img: "https://picsum.photos/seed/design/400/300",
      detailImages: [],
      detailVideos: [],
      contactUrl: "",
      price: 0,
      variants: [
        {
          id: 1, name: "标准版", desc: "100套PSD模板 + 字体包",
          img: "", video: "", contactUrl: "", price: 0, sort: 0,
          resourceCode: "",
          resourceContent: "<h4>🎁 专属内容已解锁</h4><p>✅ 100套电商主图PSD模板（百度网盘）</p><p>✅ 附赠字体包（可商用）</p><p>✅ 使用教程视频</p><p>🔗 <a href='https://pan.baidu.com/s/moban' target='_blank'>点击下载模板包</a>（提取码：mb88）</p><p style='color:#999;font-size:12px;margin-top:10px;'>免费资源，欢迎分享给需要的朋友。</p>"
        }
      ],
      is_online: true,
    },

    // 商品4：商品免费，但类型有价格（显示类型价格）
    {
      id: 4,
      cid: 11,
      title: "护士资格证考试冲刺题库",
      desc: "5000+道精选题，错题本+收藏+模拟考试",
      detail: "题库内容：\n- 专业实务 + 实践能力 两大科目\n- 5000+ 道精选习题\n- 章节练习 + 模拟考试 + 历年真题\n- 错题自动收录，支持收藏\n- 每题附详细解析",
      img: "https://picsum.photos/seed/exam/400/300",
      detailImages: [],
      detailVideos: [],
      contactUrl: "",
      price: 0,
      variants: [
        { id: 1, name: "月卡", desc: "30天题库使用权\n全部功能解锁", img: "", video: "", contactUrl: "", price: 19, sort: 0 },
        { id: 2, name: "季卡", desc: "90天题库使用权\n全部功能解锁\n比月卡省30%", img: "", video: "", contactUrl: "", price: 49, sort: 1 },
        { id: 3, name: "年卡", desc: "365天题库使用权\n全部功能解锁\n考前押题免费送", img: "", video: "", contactUrl: "", price: 99, sort: 2 },
      ],
      is_online: true,
    },

    // 商品5：职业资格考试资料（有类型）
    {
      id: 5,
      cid: 12,
      title: "教师资格证考试全套资料",
      desc: "笔试+面试全覆盖，历年真题+押题卷",
      detail: "资料包含：\n- 综合素质（中学）精讲视频\n- 教育知识与能力精讲视频\n- 学科知识与教学能力\n- 历年真题解析（2018-2025）\n- 面试技巧与示范视频\n- 考前押题卷3套",
      img: "https://picsum.photos/seed/teacher/400/300",
      detailImages: ["https://picsum.photos/seed/teacher2/600/400"],
      detailVideos: [],
      contactUrl: "",
      price: 0,
      variants: [
        { id: 1, name: "笔试班", desc: "笔试全部科目精讲\n历年真题解析", img: "", video: "", contactUrl: "", price: 49, sort: 0 },
        { id: 2, name: "笔试+面试班", desc: "笔试全部内容\n面试技巧与示范\n不过免费重学", img: "", video: "", contactUrl: "", price: 99, sort: 1 },
      ],
      is_online: true,
    },

    // 商品6：办公软件合集
    {
      id: 6,
      cid: 2,
      title: "Office办公软件全家桶",
      desc: "Word/Excel/PPT全套教程+模板+插件",
      detail: "包含内容：\n- Word 高级排版教程\n- Excel 函数与数据透视表\n- PPT 设计与动画教程\n- 500+ 精品 PPT 模板\n- 100+ Excel 实用模板\n- 常用办公插件合集\n- 快捷键速查表",
      img: "https://picsum.photos/seed/office/400/300",
      detailImages: [],
      detailVideos: [],
      contactUrl: "",
      price: 29,
      variants: [],
      is_online: true,
    },

    // 商品7：UI设计素材包
    {
      id: 7,
      cid: 3,
      title: "移动端UI设计素材包",
      desc: "50+套APP界面设计源文件，Figma/Sketch格式",
      detail: "素材包含：\n- 50+ 套完整 APP 界面设计\n- 涵盖社交、电商、金融、教育等类目\n- Figma 和 Sketch 双格式\n- 可编辑矢量图层\n- 配套图标库 2000+\n- 设计规范文档",
      img: "https://picsum.photos/seed/ui/400/300",
      detailImages: ["https://picsum.photos/seed/ui2/600/400", "https://picsum.photos/seed/ui3/600/400"],
      detailVideos: [],
      contactUrl: "",
      price: 59,
      variants: [],
      is_online: true,
    },

    // 商品8：编程视频教程（免费）
    {
      id: 8,
      cid: 2,
      title: "Python零基础入门教程",
      desc: "100集精讲视频，从入门到实战",
      detail: "教程内容：\n- Python 基础语法\n- 数据结构与算法\n- 面向对象编程\n- 文件操作与异常处理\n- 爬虫入门\n- 数据分析基础\n- 3个实战项目\n- 配套源码和讲义",
      img: "https://picsum.photos/seed/python/400/300",
      detailImages: [],
      detailVideos: ["https://www.w3schools.com/html/mov_bbb.mp4"],
      contactUrl: "",
      price: 0,
      variants: [],
      is_online: true,
    },

    // 商品9：PPT模板合集
    {
      id: 9,
      cid: 3,
      title: "高端商务PPT模板合集",
      desc: "200+套精美模板，工作总结/汇报/路演通用",
      detail: "模板包含：\n- 200+ 套高端商务 PPT 模板\n- 工作总结、工作汇报、项目路演\n- 企业宣传、培训课件、毕业答辩\n- 全部可编辑，一键换色\n- 配套图标和图片素材\n- 字体安装包",
      img: "https://picsum.photos/seed/ppt/400/300",
      detailImages: [],
      detailVideos: [],
      contactUrl: "",
      price: 19,
      variants: [
        { id: 1, name: "基础版", desc: "100套模板\n基础分类", img: "", video: "", contactUrl: "", price: 9, sort: 0 },
        { id: 2, name: "完整版", desc: "200套模板\n全部素材\n字体包", img: "", video: "", contactUrl: "", price: 19, sort: 1 },
      ],
      is_online: true,
    },

    // 商品10：英语学习资料
    {
      id: 10,
      cid: 1,
      title: "四六级英语备考资料包",
      desc: "词汇+听力+阅读+写作+真题，一次通关",
      detail: "资料包含：\n- 四级/六级核心词汇表\n- 听力专项训练（含音频）\n- 阅读理解技巧与真题\n- 写作模板与高分范文\n- 翻译技巧与练习\n- 历年真题（2015-2025）\n- 模拟试卷10套\n- 备考计划与时间安排",
      img: "https://picsum.photos/seed/english/400/300",
      detailImages: ["https://picsum.photos/seed/english2/600/400"],
      detailVideos: [],
      contactUrl: "",
      price: 39,
      variants: [],
      is_online: true,
    },

  ],
};
