# 用 Semantic Kernel 给你的应用加上 AI 大脑

现在用 LLM 开发应用一般都直接写 prompt 调 API，能跑，但维护和扩展不太方便。微软的 Semantic Kernel（以下简称 SK）在这之上做了一层抽象，这篇是初步研究笔记。

## 先搞清楚它解决什么问题

直接调 OpenAI / Azure OpenAI 的流程是：拼 prompt string → HTTP 请求 → 解析返回 string → 用 if-else 决定下一步。

这样写一两个功能还行，功能多了你会在代码里看到一堆散落的 prompt 字符串、重复的 API 调用逻辑、各种手写的重试和错误处理。SK 的核心思路是**把 LLM 调用变成一个可编排的插件系统**。

## 核心概念

```
┌──────────────────────────────────────┐
│            Semantic Kernel            │
│                                      │
│  ┌──────────┐  ┌──────────────────┐  │
│  │  Planner  │  │   Native         │  │
│  │ (规划器)  │  │   Functions      │  │
│  └──────────┘  │ (C#/Python 代码)  │  │
│                └──────────────────┘  │
│  ┌──────────────────────────────┐    │
│  │     Semantic Functions       │    │
│  │  (prompt 模板 + 参数绑定)    │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌────────────────────────────────┐  │
│  │         Connectors             │  │
│  │  OpenAI | Azure | HuggingFace  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- **Kernel**：核心引擎，注册插件、调用函数、管理上下文
- **Semantic Function**：用 prompt 模板定义，本质是"让 AI 懂你的意图"
- **Native Function**：C# 或 Python 写的普通函数，注册后 AI 可以**自动决定什么时候调用它**
- **Planner**：AI 自己拆解任务、编排多个函数——"帮我订机票然后加到日历"可以自动规划成两步

## 一个实际的 Demo

用 SK 做一个小功能——用户输入自然语言，系统自动提取关键词并查数据库。

先定义 Native Function：

```csharp
public class SearchPlugin
{
    [KernelFunction, Description("根据关键词搜索文章")]
    public List<Article> SearchArticles(
        [Description("搜索关键词")] string keyword)
    {
        return Db.Query("SELECT * FROM articles WHERE title LIKE @kw",
            new { kw = $"%{keyword}%" });
    }
}
```

注意 `[Description]` 属性很重要——它不是给人看的注释，是**给 AI 看的**。AI 根据描述判断"这个函数能做什么、什么时候调用它"。

注册并调用：

```csharp
var builder = Kernel.CreateBuilder();
builder.AddAzureOpenAIChatCompletion(deploymentName, endpoint, apiKey);
builder.Plugins.AddFromType<SearchPlugin>();

var kernel = builder.Build();

var result = await kernel.InvokePromptAsync(
    "帮我找所有关于 Redis 的文章，需要最近发布的。");
```

AI 拿到这句话，自己理解"关于 Redis"→ 提取关键词 → 调用 SearchPlugin.SearchArticles("Redis")，不需要你手写 if "Redis" in input → call function。

## Planner：AI 自己编排流程

单个 function 是"你问 AI 答"，Planner 是"你问 AI 做一整套事"：

```
用户: "给所有订阅用户发一封本周技术文章的摘要邮件"

Planner 解析:
  Step 1: 调用 SearchArticles 获取本周文章
  Step 2: 调用 SummarizeArticle (semantic function) 生成摘要
  Step 3: 调用 GetSubscribers 获取订阅列表
  Step 4: 调用 SendEmail (native function) 发送邮件
```

但实际用下来 Planner 对复杂任务的成功率还不稳定——有时候会漏步骤，或者参数传递出错。目前更适合把 Planner 用于辅助开发阶段快速验证想法，生产环境还是建议在代码中显式编排关键链路。

## 和 LangChain 的区别

简单说：LangChain 是 Python 生态的 LLM 编排工具链，社区大、集成多；SK 是微软的 .NET 生态方案，对 C# 开发者友好，而且 Enterprise 场景下的合规、可观测性做得更好。选哪个主要看团队技术栈。

## 一些想法

SK 的设计哲学是把 AI 当成一个"执行器"而不是"应答器"——它不只回答问题，还能主动调用你的函数、操作你的系统。这个方向是对的，目前工具链还在快速迭代中，API 变化不小。对于生产项目，我的想法是：先只用 SK 的 Semantic Function 做 prompt 管理，等版本稳定后再接入 Planner。
