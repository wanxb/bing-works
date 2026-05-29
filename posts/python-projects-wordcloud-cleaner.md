# Python 小项目实战：词云生成器与 C 盘清理脚本

学了 Python 基础之后，最好的巩固方式就是写点能用的东西。这篇记录两个练手项目：一个是从 GitHub 上翻出来的词云生成器，另一个是帮自己清理 C 盘的脚本。

## 项目一：词云生成器

词云是文本可视化的经典玩法——把一篇文章中出现频率高的词放大显示，一目了然。核心流程不复杂：

```
文本输入 → 分词 → 统计词频 → 生成图片
```

### 分词

英文天然空格分隔，中文则需要分词工具。`jieba` 是目前最常用的中文分词库：

```python
import jieba

text = "南京市长江大桥迎来了新的一天的第一缕阳光"
words = jieba.lcut(text)
# ['南京市', '长江大桥', '迎来', '了', '新', '的', '一天', '的', '第一缕', '阳光']
```

`lcut` 返回列表模式，比生成器模式更直观。jieba 自带词典能覆盖大部分场景，特殊词汇可以手动添加：

```python
jieba.add_word("南京市长江大桥")
```

### 过滤与统计

分词之后要去掉标点和"的、了、是、在"这类停用词：

```python
from collections import Counter

stopwords = {"的", "了", "是", "在", "和", "就", "也", "都", "不", "要", "很"}
filtered = [w for w in words if len(w) > 1 and w not in stopwords]
freq = Counter(filtered)
# Counter({'南京市': 1, '长江大桥': 1, '第一缕': 1, '阳光': 1, ...})
```

### 生成词云

`wordcloud` 库封装好了样式和布局：

```python
from wordcloud import WordCloud
import matplotlib.pyplot as plt

wc = WordCloud(
    font_path="C:/Windows/Fonts/msyh.ttc",  # 中文字体
    width=800,
    height=600,
    background_color="white",
    max_words=200,
    collocations=False
)
wc.generate_from_frequencies(freq)
wc.to_file("wordcloud.png")
```

`font_path` 是关键——不指定中文字体的话所有中文都是方框。`collocations=False` 防止词云库自动组合双词。

### 命令行封装

用 `argparse` 把脚本变成命令行工具：

```python
import argparse

parser = argparse.ArgumentParser(description="生成词云图")
parser.add_argument("input", help="输入文本文件路径")
parser.add_argument("-o", "--output", default="wordcloud.png", help="输出图片路径")
parser.add_argument("--mask", help="遮罩图片路径（控制词云形状）")
args = parser.parse_args()
```

支持遮罩（mask）可以让词云呈现特定形状——比如用一个心形图片做遮罩，词云就填充成心形。

## 项目二：C 盘清理脚本

Windows 的 C 盘经常莫名其妙满了。Python 可以写个脚本定期清理临时文件和缓存。

### 扫描大文件

先找出哪些目录最占空间：

```python
from pathlib import Path

def scan_directory(path, top_n=10):
    sizes = {}
    for item in Path(path).iterdir():
        if item.is_file():
            sizes[str(item)] = item.stat().st_size
        elif item.is_dir():
            total = sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
            sizes[str(item)] = total
    return sorted(sizes.items(), key=lambda x: x[1], reverse=True)[:top_n]
```

`rglob("*")` 递归遍历所有文件，类似 `**/*` 通配符。这个方法扫描 C 盘可能会有点慢，实际使用可以限定几个常见目录。

### 清理目标

Windows 下值得清理的几个位置：

```python
CLEANUP_PATHS = [
    Path.home() / "AppData/Local/Temp",          # 临时文件
    Path.home() / "AppData/Local/Microsoft/Windows/INetCache",  # IE 缓存
    Path(os.environ["SystemRoot"]) / "Temp",      # 系统临时文件
    Path.home() / "AppData/Local/Google/Chrome/User Data/Default/Cache",  # Chrome 缓存
    Path.home() / "Downloads",                    # 下载目录（手动确认）
]
```

### 安全清理

清理文件不是直接 `rm -rf`，需要一些保护措施：

```python
import shutil
from datetime import datetime, timedelta

def safe_cleanup(directory, days_old=7, dry_run=True):
    cutoff = datetime.now() - timedelta(days=days_old)
    removed_size = 0
    
    for path in Path(directory).rglob("*"):
        if not path.is_file():
            continue
        try:
            mtime = datetime.fromtimestamp(path.stat().st_mtime)
            if mtime < cutoff:  # 只清理 N 天前的文件
                size = path.stat().st_size
                if dry_run:
                    print(f"[预览] 删除: {path} ({size/1024:.0f} KB)")
                else:
                    path.unlink()
                removed_size += size
        except (PermissionError, OSError):
            continue
    
    return removed_size
```

三个安全措施：只清理老于 N 天的文件、先 dry_run 预览、捕获权限错误不中断。在自己电脑上跑这种脚本，谨慎一点没坏处。

## 两个项目的共同体会

这两个项目加起来不到 300 行代码，但覆盖了 Python 开发的很多实用技能：文件 IO、中文处理、命令行参数、异常处理、第三方库调用。Python 开发效率确实高——花一个下午就能写出两个真正能用的工具，这在 Java 世界里不太现实。

不过在打包分发上 Python 不如 Go/Rust 方便。给没有 Python 环境的人用，需要打包成 exe（PyInstaller），体积动不动就几十 MB。这是后话了。
