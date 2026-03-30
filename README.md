# mini-works

三个风格各异、可直接静态部署的小作品合集。

## Projects

### 1. Memory Garden / 记忆花园
把一句话种进夜里，长成一株会发光的小植物。

- Path: `memory-garden/`
- Type: 情绪互动装置 / 沉浸式网页

### 2. Zen Stones / 禅石排布
在电子白砂上拖动石头，让纹路围绕石头缓慢流动。

- Path: `zen-stones/`
- Type: 构图玩具 / 解压网页

### 3. Signal Museum / 旧信号博物馆
收集拨号音、CRT 扫描线、磁带峰值、科幻雷达等旧信号视觉。

- Path: `signal-museum/`
- Type: 复古媒体展馆 / 互动视觉页

## Deploy

This repo is static-only. You can deploy it with Vercel, Netlify, GitHub Pages, or any static hosting.

## Local Preview

```bash
cd mini-works
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080/memory-garden/`
- `http://localhost:8080/zen-stones/`
- `http://localhost:8080/signal-museum/`
