# Bing' Works

一个用于展示 Bing 与阿罗德斯作品的静态作品目录站点。

## 项目简介

这个仓库承载的是作品集首页本身，不负责集中维护每个子项目的源码。

站点当前提供：
- 作品卡片展示
- 标签筛选
- `large / small / list` 三种视图切换
- 浅色 / 深色主题切换
- 移动端大图标轮播浏览

## 技术栈

- 原生 HTML / CSS / JavaScript
- 静态 JSON 数据驱动渲染
- 无构建步骤，无框架依赖

## 目录结构

```text
bing-works/
├── index.html
├── favicon.svg
├── README.md
├── assets/
│   └── thumbs/
├── css/
│   ├── style.css
│   ├── variables.css
│   ├── base.css
│   ├── animations.css
│   ├── components.css
│   ├── layout.css
│   └── mobile.css
├── data/
│   └── works.json
└── js/
    ├── app.js
    ├── data.js
    ├── filters.js
    ├── view.js
    ├── theme.js
    ├── tooltip.js
    └── carousel.js
```

## 本地运行

这是一个纯静态项目，直接起一个本地 HTTP 服务即可：

```bash
cd bing-works
python -m http.server 8080
```

然后打开：

- <http://localhost:8080>

## 数据维护

作品数据维护在 [data/works.json](/e:/Projects/bing-works/data/works.json)。

主要字段说明：
- `filters`: 顶部筛选标签
- `works`: 按作者分组的作品列表
- `thumb`: 卡片缩略图路径
- `tags`: 作品所属标签，用于筛选
- `links.demo`: 在线地址
- `links.source`: 源码地址

新增作品时，通常只需要：
1. 在 `assets/thumbs/` 添加缩略图
2. 在 `data/works.json` 补充作品信息
3. 如有新分类，再同步补充 `filters`

## 开发说明

- 页面入口：`js/app.js`
- 数据渲染：`js/data.js`
- 筛选逻辑：`js/filters.js`
- 视图切换：`js/view.js`
- 主题切换：`js/theme.js`
- 提示浮层：`js/tooltip.js`
- 移动端轮播：`js/carousel.js`

样式按职责拆分在 `css/` 目录中：
- `variables.css`: 主题变量
- `base.css`: 基础样式
- `components.css`: 组件样式
- `layout.css`: 桌面布局
- `mobile.css`: 移动端适配
- `animations.css`: 动画效果

## 部署

项目可以直接部署到任意静态托管平台，例如：

- GitHub Pages
- Vercel
- Netlify
- Cloudflare Pages

## 备注

如果页面无法加载作品数据，通常是因为直接双击打开了 `index.html`。  
请通过本地服务器或静态托管方式访问页面。
