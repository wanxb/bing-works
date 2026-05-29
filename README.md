# Bing' Works

个人作品目录 & 技术博客，零依赖纯静态站点。

## 功能

- 作品卡片展示，标签筛选
- `large / small / list` 三种视图切换
- 浅色 / 深色主题切换
- 技术博客：Markdown 渲染、代码高亮、目录导航、搜索、Giscus 评论
- 35 篇文章，覆盖 Redis / Java / .NET / TypeScript / Docker / MQ / Python / Rust / 区块链 / 系统架构 / AI/ML

## 技术栈

- 原生 HTML / CSS / JavaScript（ES Modules）
- 静态 JSON 数据驱动
- highlight.js CDN 代码高亮（190+ 语言）
- Giscus 评论系统（GitHub Discussions）
- 无构建工具、无框架依赖

## 目录结构

```text
bing-works/
├── index.html
├── favicon.svg
├── README.md
├── .gitignore
├── assets/
│   └── thumbs/
├── css/
│   ├── style.css
│   ├── variables.css
│   ├── base.css
│   ├── animations.css
│   ├── components.css
│   ├── layout.css
│   ├── mobile.css
│   └── blog.css
├── data/
│   ├── works.json
│   └── posts.json
├── js/
│   ├── app.js
│   ├── data.js
│   ├── filters.js
│   ├── view.js
│   ├── theme.js
│   ├── tooltip.js
│   ├── carousel.js
│   ├── router.js
│   ├── blog.js
│   ├── blog-data.js
│   ├── blog-search.js
│   ├── comments.js
│   ├── markdown.js
│   └── highlight.js
└── posts/
    └── images/
```

## 本地运行

纯静态项目，起本地 HTTP 服务即可：

```bash
cd bing-works
python -m http.server 8080
```

访问 <http://localhost:8080>

## 博客数据维护

文章元数据在 `data/posts.json`，正文在 `posts/*.md`。

新增文章：
1. 在 `posts/` 创建 `.md` 文件
2. 在 `data/posts.json` 的 `posts` 数组添加条目（slug、title、date、tags、excerpt、filename）
3. 如有新分类，在 `tags` 数组补充标签

## 部署

可直接部署到任意静态托管平台：GitHub Pages / Vercel / Netlify / Cloudflare Pages

如果页面无法加载数据，通常是因为双击打开了 `index.html`。请通过本地服务器访问。
