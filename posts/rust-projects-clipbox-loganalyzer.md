# Rust 练手项目：ClipBox 剪贴板与日志分析器

学 Rust 语法只是一个开始，真正理解它是在写项目的过程中。这篇记录两个练手项目：ClipBox 是从 GitHub 上挖出来的剪贴板工具，日志分析器是自己从头写的。

## 项目一：ClipBox —— 智能剪贴板管理

日常开发中经常遇到这种场景：复制了一段代码、一个链接、一个密码，过了一会儿想复用，剪贴板已经被别的内容覆盖了。ClipBox 解决的就是这个问题——它监听剪贴板变化，把历史记录保存下来。

### 技术架构

```
┌─────────┐    ┌──────────────┐    ┌──────────┐
│  系统    │    │              │    │          │
│ 剪贴板   │───→│   arboard    │───→│  ClipBox │
│         │    │  (跨平台API)  │    │  核心逻辑 │
└─────────┘    └──────────────┘    └────┬─────┘
                                        │
                               ┌────────┴─────┐
                               │  SQLite 存储  │
                               │  (历史记录)   │
                               └──────────────┘
```

`arboard` 是 Rust 的剪贴板库，跨 Windows/macOS/Linux。每次剪贴板变化，ClipBox 捕捉并存入本地 SQLite。

### 核心监听逻辑

```rust
use arboard::Clipboard;
use std::time::{Duration, Instant};

struct ClipWatcher {
    clipboard: Clipboard,
    last_content: String,
}

impl ClipWatcher {
    fn run(&mut self) {
        loop {
            if let Ok(content) = self.clipboard.get_text() {
                if content != self.last_content {
                    self.last_content = content.clone();
                    self.on_new_clip(content);
                }
            }
            std::thread::sleep(Duration::from_millis(500));
        }
    }

    fn on_new_clip(&self, content: String) {
        // 存储到 SQLite
        // 支持分类：链接、代码、文本
    }
}
```

### 类型识别

ClipBox 对剪贴板内容做自动分类：

```rust
fn classify(text: &str) -> &'static str {
    if text.starts_with("http") {
        "链接"
    } else if text.contains("fn ") || text.contains("let ") {
        "代码"
    } else if text.len() > 200 {
        "长文本"
    } else {
        "文本"
    }
}
```

这个分类逻辑很简单但有扩展空间——可以加正则匹配邮箱、手机号快速提取。

## 项目二：Logalyzer —— 命令行日志分析器

ClipBox 是"拿来就用"的工具，这个日志分析器是自己从零设计的——目的是练习 Rust 的文件处理、并发和 CLI 开发。

### 需求

生产环境经常需要快速分析日志：统计错误数、找出最慢的请求、按时间段过滤。写一个命令行工具来做这些。

```
$ logalyzer access.log --top-slow 10 --from "14:00" --to "15:00"
```

### 数据结构

```rust
use chrono::NaiveDateTime;

struct LogLine {
    timestamp: NaiveDateTime,
    method: String,
    path: String,
    status: u16,
    duration_ms: u64,
}

struct LogStats {
    total: usize,
    status_counts: HashMap<u16, usize>,
    avg_duration: f64,
    slowest: Vec<(u64, String)>,  // (耗时, 路径)
}
```

### 解析与并发

用 `rayon` 并行处理大日志文件：

```rust
use rayon::prelude::*;
use std::fs;

fn parse_log_file(path: &str) -> Result<Vec<LogLine>, Box<dyn Error>> {
    let content = fs::read_to_string(path)?;
    let lines: Vec<&str> = content.lines().collect();

    let entries: Vec<LogLine> = lines
        .par_iter()  // rayon 并行迭代
        .filter_map(|line| parse_line(line))
        .collect();

    Ok(entries)
}

fn parse_line(line: &str) -> Option<LogLine> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 5 { return None; }

    Some(LogLine {
        timestamp: NaiveDateTime::parse_from_str(
            &format!("{} {}", parts[0], parts[1]),
            "%Y-%m-%d %H:%M:%S"
        ).ok()?,
        method: parts[2].to_string(),
        path: parts[3].to_string(),
        status: parts[4].parse().ok()?,
        duration_ms: parts[5].parse().ok()?,
    })
}
```

`rayon` 的 `par_iter()` 一行就完成了并行化，不需要手动管理线程池。Rust 的零成本抽象在这里体现得很直观。

### 命令行定义

用 `clap` 定义 CLI 接口：

```rust
use clap::Parser;

#[derive(Parser)]
#[command(name = "logalyzer")]
struct Cli {
    /// 日志文件路径
    file: String,

    /// 返回最慢的 N 个请求
    #[arg(long, default_value = "10")]
    top_slow: usize,

    /// 过滤开始时间 HH:MM
    #[arg(long)]
    from: Option<String>,

    /// 过滤结束时间 HH:MM
    #[arg(long)]
    to: Option<String>,
}
```

`clap` 的 derive 模式用宏自动生成参数解析——比手写 match 优雅很多。

### 输出结果

```
Logalyzer Report
────────────────────────────────
总请求数:     45,231
平均耗时:     127ms
最慢请求:
  1.  GET /api/report/export  2,847ms
  2.  POST /api/order/batch   1,932ms
  3.  GET /api/search?q=xxx   1,204ms
  ...
状态码分布:
  200: 42,103 (93.1%)
  404:  1,892  (4.2%)
  500:    623  (1.4%)
```

## 两个项目的对比

| 维度 | ClipBox | Logalyzer |
|------|---------|-----------|
| 场景 | 桌面工具 | 命令行工具 |
| 存储 | SQLite | 纯内存统计 |
| 并发 | 单线程事件循环 | rayon 数据并行 |
| 关键 crate | arboard, rusqlite | rayon, clap, chrono |

用 Rust 写这两个项目的共同感受：编译慢（尤其第一遍），但运行快且有安全感。写 ClipBox 时调用系统剪贴板 API 也没遇到内存问题——这在 C/C++ 里是常见坑。Rust 的编译速度是个槽点（`cargo build` 比 `go build` 慢好几倍），但编译器提供的安全保证确实让调试时间减少了很多。
