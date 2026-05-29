# Python 学习笔记：从基础语法到实用工具库

以前主要写 Java 和 C#，一直觉得 Python 是"胶水语言"——粘合各种系统用的。真的沉下心来学才发现，Python 在数据处理和自动化上的体验确实比 Java 舒服很多。这篇是学习过程中的整理。

## 语法初印象

Python 用缩进定义代码块，刚到的时候很不习惯，总觉得少了大括号缺了点"确定性"。写了一周之后就回不去了——代码看起来干净太多。

几个一开始容易搞混的点：

```python
# list vs tuple：一个能改一个不能改
nums = [1, 2, 3]       # list, 可变
point = (10, 20)        # tuple, 不可变，可以做 dict 的 key

# dict 取值
d = {"name": "bing", "age": 26}
d.get("city", "未知")   # 比 d["city"] 安全，不存在不报错

# 推导式：Python 的标志性写法
squares = [x**2 for x in range(10) if x % 2 == 0]
```

推导式刚看觉得像魔法，习惯了再看 Java 的 for 循环格格不入。

## 函数与模块

函数定义很简单，参数可以设默认值。Python 的模块导入机制跟 Node.js 类似，每个 .py 文件就是一个模块：

```python
# utils.py
def clean_text(text):
    return text.strip().lower()

# main.py
from utils import clean_text
```

包管理用 pip + requirements.txt，够用。虚拟环境用 venv 隔离项目依赖——这个和 npm 的本地 node_modules 思路类似，不过 venv 是全局隔离而非目录隔离。

## 常用标准库

Python 最香的是标准库。处理文件、压缩包、CSV、JSON 全内置：

```python
import json
import csv
from pathlib import Path

data = json.loads(Path("config.json").read_text(encoding="utf-8"))

with open("data.csv", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row["name"])
```

`pathlib.Path` 处理文件路径比 `os.path` 优雅得多，拼接路径用 `/` 运算符：

```python
from pathlib import Path

base = Path("/data")
file = base / "downloads" / "report.txt"  # 不需要 os.path.join
content = file.read_text()
```

## 第三方库生态

Python 的强大在于第三方库。学了几个数据处理相关的：

| 库 | 用途 |
|---|---|
| requests | HTTP 请求，比标准库 urllib 好用十倍 |
| Pillow | 图片处理，缩放、裁剪、加文字 |
| matplotlib | 画图，图表可视化 |
| jieba | 中文分词，做词云必需 |
| wordcloud | 生成词云图 |
| rich | 命令行美化输出 |

requests 库的 API 设计堪称典范：

```python
import requests

r = requests.get("https://api.example.com/data", 
                  params={"page": 1}, 
                  headers={"Authorization": "Bearer xxx"})
r.raise_for_status()
data = r.json()
```

不需要手动拼接 URL、不需要编码参数，一切都帮你兜底了。

## 实用脚本思维

Python 特别适合写一次性脚本。学 Python 这段时间经常用到的一个模式：读文件 → 处理 → 输出：

```python
from pathlib import Path

def batch_rename(directory, old_ext, new_ext):
    for f in Path(directory).glob(f"*.{old_ext}"):
        f.rename(f.with_suffix(f".{new_ext}"))

batch_rename("./images", "jpg", "png")
```

十行代码搞定的事，Java 可能要写五十行。不是说 Java 不好——Java 适合大型项目，但快速解决问题时 Python 的优势体现得很明显。

## 小结

Python 学起来比想象中简单，但要写得"Pythonic"不容易。不写 for i in range(len(list)) 而是直接 for item in list，不用 if flag == True 而直接写 if flag——这些习惯需要时间养成。下一步打算写几个完整项目巩固。
