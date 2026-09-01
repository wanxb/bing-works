# Bing's Works

Bing 的个人品牌、项目档案与技术写作网站。内容围绕 AI Agent、大模型应用架构、生产工程与技术领导力，使用 Astro 生成纯静态 HTML。

## 页面

- `/`：个人品牌、核心能力、精选项目与精选文章
- `/works/`：25 个项目的完整档案与分类筛选
- `/works/{id}/`：项目详情、架构判断、工程实现与相关写作
- `/blog/`：60 篇文章的专题、搜索与列表
- `/blog/{slug}/`：静态文章正文、目录、相关文章和 Giscus 评论
- `/about/`：专业方向与工作方式
- `/sitemap.xml`、`/rss.xml`、`/robots.txt`：搜索与订阅入口

## 技术栈

- Astro 静态站点生成
- 原生 HTML、CSS 和少量 TypeScript
- JSON + Markdown 内容源
- Marked + highlight.js 构建阶段渲染
- Giscus 评论

核心内容在构建阶段写入 HTML，不依赖客户端 JavaScript 才能显示。客户端脚本只负责主题切换、列表筛选、搜索、旧 hash URL 迁移和延迟加载评论。

## 本地开发

建议使用 Node.js 20.19 或更高版本。

```bash
npm install
npm run dev
```

默认访问 <http://localhost:4321>。

## 校验与构建

```bash
npm run validate
npm run build
npm run preview
```

`npm run build` 会先执行内容校验，再生成 `dist/`：

- 项目数量必须为 25，文章数量必须为 60
- Work ID 和文章 slug 不可重复
- Markdown、缩略图和文章图片必须存在
- 首页精选项目、精选文章和项目关联文章必须有效
- 项目外链必须使用 HTTPS

部署时发布 `dist/`，不要直接发布仓库源码目录。

## 正式域名

站点 URL 由 `SITE_URL` 单一配置控制，用于 canonical、Open Graph、JSON-LD、sitemap、RSS 和 robots。

默认值为：

```text
https://bbing.xyz
```

如果正式域名不同，在项目根目录创建 `.env`：

```dotenv
SITE_URL=https://your-domain.example
```

修改域名后重新执行 `npm run build`。

## 内容维护

### 个人品牌

个人定位、能力、原则、精选项目和精选文章维护在：

```text
data/profile.json
```

### Works

项目数据维护在：

```text
data/works.json
```

基础字段：

```json
{
  "id": "work-id",
  "title": "项目名称",
  "subtitle": "英文或补充名称",
  "description": "项目定位与价值",
  "thumb": "./assets/thumbs/work-id.svg",
  "tags": ["bing", "tool"],
  "links": {
    "demo": "https://demo.example.com/",
    "source": "https://github.com/user/repo"
  }
}
```

重点项目可增加 `year`、`focus`、`relatedPosts`、`schemaType` 和 `caseStudy`。案例内容只填写可验证的背景、职责、约束、决策、实现、交付与复盘，不虚构指标。

新增或更新缩略图后同步到：

```text
public/assets/thumbs/
```

### Blog

文章元数据：

```text
data/posts.json
```

Markdown 正文：

```text
posts/*.md
```

文章图片放在：

```text
public/posts/images/
```

Markdown 中使用：

```markdown
![图片说明](posts/images/example.jpg)
```

新增文章后运行 `npm run validate`，确认 slug、文件名、标签和图片引用有效。

## 目录结构

```text
├── data/                 # 品牌、Works、Posts 元数据
├── posts/                # Markdown 正文
├── public/               # 构建时直接复制的静态资源
├── scripts/              # 缩略图生成与内容校验
├── src/
│   ├── components/       # 导航、列表、主题控件
│   ├── config/           # 站点与域名配置
│   ├── layouts/          # 基础页和文章页布局
│   ├── lib/              # 内容读取、Markdown 与结构化数据
│   ├── pages/            # Astro 路由
│   └── styles/           # 全局文字设计系统
└── .claude/blade-spec/   # 本次改版规范与任务状态
```

## 过渡说明

根目录旧 `index.html`、`js/` 和 `css/` 暂时保留，用于改版验收和回退。新版开发、预览和部署均以 Astro 命令及 `dist/` 输出为准；正式切换并确认稳定后再单独清理旧 SPA 文件。
