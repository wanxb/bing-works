# Bing' Works

Bing' Works 是一个克制、清晰、可直接访问的小作品目录，用来统一展示 Bing 与阿罗德斯的网页作品。

## 项目定位

这个仓库用于承载作品集主页本身，而不是集中维护所有项目源码。

它负责：
- 展示作品目录
- 提供统一访问入口
- 组织作者与作品类型
- 链接到各项目的 GitHub Pages 与源码仓库

## 当前收录项目

### 阿罗德斯
- **记忆花园 / Memory Garden**
  - Live: <https://wanxb.github.io/memory-garden/>
  - Repo: <https://github.com/wanxb/memory-garden>
- **禅石排布 / Zen Stones**
  - Live: <https://wanxb.github.io/zen-stones/>
  - Repo: <https://github.com/wanxb/zen-stones>
- **旧信号博物馆 / Signal Museum**
  - Live: <https://wanxb.github.io/signal-museum/>
  - Repo: <https://github.com/wanxb/signal-museum>

### Bing
- **极简时钟 / Time Clock**
  - Live: <https://wanxb.github.io/time-clock/>
  - Repo: <https://github.com/wanxb/time-clock>
- **皇帝年表 / Chinese Emperors Timeline**
  - Live: <https://wanxb.github.io/chinese-emperors-timeline/>
  - Repo: <https://github.com/wanxb/chinese-emperors-timeline>
- **地图拼块 / China Map Puzzle**
  - Live: <https://wanxb.github.io/china-map-puzzle/>
  - Repo: <https://github.com/wanxb/china-map-puzzle>
- **赛博海洋 / Cyber Ocean**
  - Live: <https://wanxb.github.io/cyber-ocean/>
  - Repo: <https://github.com/wanxb/cyber-ocean>
- **护眼空间 / Eye Spa Pro**
  - Live: <https://wanxb.github.io/eye-spa-pro/>
  - Repo: <https://github.com/wanxb/eye-spa-pro>

## 文件结构

```text
mini-works/
├── index.html
├── README.md
├── favicon.svg
├── vercel.json
└── assets/
    └── thumbs/
```

## 本地预览

```bash
cd mini-works
python3 -m http.server 8080
```

然后打开：

- <http://localhost:8080>

## 部署

这是一个静态站点，可以部署到：

- GitHub Pages
- Vercel
- Netlify
- 任何支持静态文件托管的平台
