# MCP 协议详解：让 AI 与万物互联的标准接口


2024 年 11 月，Anthropic 发布了 Model Context Protocol（MCP），当时没引起太大轰动。但到了 2025 年，MCP 已经成了 AI 工具集成的事实标准——OpenAI、Google、DeepMind 全部加入。大家管它叫"AI 界的 USB-C"。

这篇文章从协议设计到代码实践，完整拆解 MCP。

## MCP 解决了什么问题

在 MCP 出现之前，让 LLM 使用工具是这样的：

```
让 LLM 查数据库：
  → 我在代码里写一个 SQL 查询函数
  → 包装成 OpenAI Function Calling 的格式
  → 注册到 LLM 调用中

让 LLM 查 Slack：
  → 我再用 Slack SDK 写一个消息查询函数
  → 又包装成 Function Calling 格式
  → 再注册一遍

让 LLM 发邮件：
  → 一模一样的过程再重复一次
```

每个工具都要单独写集成代码，工具一多，集成工作变成了无底洞。

MCP 的思路很直观：**工具提供方按标准格式暴露接口，LLM 按标准格式调用，中间的适配层只需要一次。**

```
没有 MCP：
  LLM ←→ 自定义集成 A ←→ 工具 A
  LLM ←→ 自定义集成 B ←→ 工具 B
  LLM ←→ 自定义集成 C ←→ 工具 C
  （N 个工具 = N 套集成代码）

有 MCP：
  LLM ←→ MCP Client ←→ MCP Server A（暴露工具 A）
                      ←→ MCP Server B（暴露工具 B）
                      ←→ MCP Server C（暴露工具 C）
  （N 个工具 = 1 个 MCP Client + N 个 MCP Server）
```

## MCP 架构设计

MCP 的核心架构只有三个角色：

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  MCP Host   │       │  MCP Client │       │  MCP Server │
│             │       │             │       │             │
│ (LLM 应用)  │──────→│ (连接管理)  │──────→│ (工具提供方) │
│ Claude Code │       │ 会话管理     │       │ 暴露工具     │
│ VS Code     │       │ 请求路由     │       │ 处理请求     │
│ 自定义应用   │       │ 传输管理     │       │ 资源推送     │
└─────────────┘       └─────────────┘       └─────────────┘
```

**MCP Host**：用户直接面对的 LLM 应用。比如 Claude Code、Claude Desktop、VS Code 扩展。Host 负责启动 MCP Client，用它来与各种工具通信。

**MCP Client**：与 MCP Server 建立一对一连接。Host 内部通常有一个或多个 Client 实例，每个 Client 连接到一个 Server。

**MCP Server**：每个 Server 暴露一组工具（Tools）、资源（Resources）和提示词（Prompts）。Server 是轻量级的程序，专注做一件事——把后端服务包装成 MCP 协议。

## 传输层

MCP 支持两种传输方式：

```
stdio 传输（本地）：
  MCP Server 作为子进程运行
  Host 通过 stdin/stdout 与它通信
  适用：本地工具、CLI 工具、文件系统工具

HTTP SSE 传输（远程）：
  MCP Server 作为 HTTP 服务运行
  Host 通过 Server-Sent Events 接收流式数据
  适用：远程 API、数据库、第三方服务
```

**stdio 传输的典型场景**：

```
Claude Code 配置本地 MCP：
  {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
      },
      "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"]
      }
    }
  }
```

每个 MCP Server 就是一个子进程。Host 通过 stdin 发送 JSON-RPC 请求，Server 通过 stdout 返回响应。简单、可靠。

**SSE 传输的典型场景**：

```
远程 MCP Server（HTTP）：
  Host → HTTP POST /messages → Server
  Host ← SSE /events ← Server（流式推送）
```

远程传输让 MCP 不限于本地——你可以把内部 API 包装成 MCP Server 部署在服务器上，让 LLM 应用远程调用。

## 核心概念：Tools、Resources、Prompts

MCP 定义了三种能力，类比到人类的"工具"、"文件"和"模板"：

### Tools（工具）

Tools 就是让 LLM 可以调用的函数。与 Function Calling 的 tools 概念等价。

```
Tool 定义示例（通过 MCP 协议暴露）：
  {
    "name": "get_weather",
    "description": "查询指定城市的天气",
    "inputSchema": {
      "type": "object",
      "properties": {
        "city": { "type": "string", "description": "城市名" }
      },
      "required": ["city"]
    }
  }
```

调用时，MCP Client 发送 JSON-RPC 请求给 Server，Server 执行后返回结果。

关键区别：**在 MCP 之前，Function Calling 的工具定义是由 LLM 提供商（OpenAI/Anthropic）的 API 来管理的。** 每个提供商的格式略有不同，切换提供商时需要重新格式化工具定义。MCP 把工具定义标准化了——不管用哪个 LLM，工具定义格式一致。

### Resources（资源）

Resources 是 MCP 独有的概念，相当于让 Server 暴露"可读的静态内容"给 LLM。

```
Resources 示例：
  file:///logs/app.log           → 应用日志文件
  database://customers/schema    → 数据库表结构
  git://current-branch/diff      → 当前 Git diff
  docs://api-reference           → API 文档
```

Resources 可以理解为**只读的文件系统**。LLM 不需要调用工具就可以读取这些资源。

**Resources 的应用场景**：

- 自动把项目文档暴露给 LLM，不需要手动粘贴
- 把数据库 schema 暴露给 LLM，让它自己写 SQL
- 把当前代码 diff 暴露给 LLM，让它理解正在改什么

### Prompts（提示词模板）

Prompts 是预定义的、可复用的 prompt 模板。

```
Prompt 模板示例：
  name: "code-review"
  arguments: ["diff"]
  模板内容：
    "请对以下代码变更做 Code Review：
    {diff}
    
    请从以下维度评审：正确性、代码风格、安全性、可维护性"
```

直接通过 MCP 协议把这个模板"推"给 LLM，省去在应用层拼 prompt 的工作。

## 通信协议

MCP 底层使用 JSON-RPC 2.0。这是一个很轻量的 RPC 协议。

```
请求格式：
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {
      "city": "北京"
    }
  }
}

响应格式：
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "北京今天晴天，气温 18-28°C"
      }
    ]
  }
}
```

MCP 定义的核心方法：

```
初始化
  initialize             → 双方交换能力声明

生命周期
  tools/list             → 列出所有可用工具
  resources/list         → 列出所有可用资源
  prompts/list           → 列出所有 prompt 模板

工具调用
  tools/call             → 调用指定工具

资源操作
  resources/read         → 读取资源内容

通知（Server → Client）
  notifications/tools/list_changed
  notifications/resources/list_changed
```

注意 MCP 使用了额外的**能力协商**机制。在初始化阶段，Client 和 Server 交换各自支持的能力：

```
Client 通知 Server：我支持叫工具、读资源
Server 回复 Client：我支持暴露工具、支持资源订阅通知
```

协商后，双方只使用对方支持的能力。这保证了协议的向前兼容——旧的 Host 可以连接新 Server，反之亦然。

## 动手写一个 MCP Server

以 Node.js 为例，写一个最简单的 MCP Server：

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// 1. 创建 Server
const server = new Server({
  name: "my-tools-server",
  version: "1.0.0",
}, {
  capabilities: { tools: {} },
});

// 2. 定义 Tool
server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "greet",
    description: "向指定用户打招呼",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "用户名" },
        language: { type: "string", enum: ["zh", "en"], description: "语言" },
      },
      required: ["name"],
    },
  }],
}));

// 3. 实现 Tool 调用
server.setRequestHandler("tools/call", async (request) => {
  if (request.params.name === "greet") {
    const { name, language = "zh" } = request.params.arguments;
    return {
      content: [{
        type: "text",
        text: language === "zh" ? `你好，${name}！` : `Hello, ${name}!`,
      }],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// 4. 启动（stdio 传输）
const transport = new StdioServerTransport();
await server.connect(transport);
```

这个 Server 编译运行后，通过 stdin/stdout 与 Host 通信。Host（比如 Claude Code）通过配置找到它：

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["path/to/my-server.mjs"]
    }
  }
}
```

**用 Python 写也差不多：**

```python
from mcp.server import Server, stdio_server
from mcp.types import Tool, TextContent

server = Server("my-tools-python")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="greet",
            description="向指定用户打招呼",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "language": {"type": "string", "enum": ["zh", "en"]},
                },
                "required": ["name"],
            },
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "greet":
        text = f"你好，{arguments['name']}！" if arguments.get("language", "zh") == "zh" else f"Hello, {arguments['name']}!"
        return [TextContent(type="text", text=text)]
    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream)
```

不需要理解底层的 JSON-RPC 协议，SDK 帮你处理了所有底层细节。

## MCP vs A2A

MCP 常被拿来和 Google 的 A2A（Agent-to-Agent）协议对比。

```
MCP（模型上下文协议）             A2A（Agent 间协议）
─────                            ─────
连接 LLM 和工具                  连接 Agent 和 Agent
Client-Server 模式               Agent 对等模式
工具 / 资源 / Prompt             Agent 能力发现与协作
由 Anthropic 发起               由 Google 发起
2024年11月发布                   2025年4月发布
现在是 AI 工具集成标准           还在快速演进
```

两个协议关系互补：

```
MCP = LLM 的工具接口
  └─ LLM ←→ MCP Server ←→ 工具/数据/API

A2A = Agent 之间的通信协议
  └─ Agent A ←→ A2A ←→ Agent B
```

一个典型的场景：Agent A 通过 MCP 调用数据库工具做分析，通过 A2A 把结果传给 Agent B 生成报告。

## MCP 的适用场景

```
适合用 MCP 的场景                不适合的场景
─────────────────                ────────────────
工具数量多（10+）                只有 1-2 个简单工具
工具需要跨 LLM 迁移              固定用同一个 LLM
工具需要共享给多个应用            工具不会变
需要标准和规范                   能接受自定义集成
团队有多个 LLM 项目              单项目一次性
```

是否上 MCP，本质上是**标准化带来的维护成本降低 vs 引入 MCP 的学习成本**之间的权衡。如果工具少于 5 个而且不会增加，自己写集成可能更快。如果工具超过 10 个、团队在持续增加工具，MCP 的优势就非常明显。

## MCP 的安全性

MCP 把工具暴露给 LLM，安全是需要重点考虑的：

```
工具级别的安全风险：
  - Server 暴露了不应该给 LLM 调用的工具
  - LLM 被诱导调用了破坏性的工具
  
传输安全：
  - stdio 传输在本地，相对安全
  - SSE 传输需要认证和授权

数据安全：
  - 工具调用携带的数据可能包含敏感信息
  - Server 需要做好输入验证
```

MCP 协议本身不提供安全机制——认证、授权、审计这些需要在应用层实现。一个实践建议：

```
开发 MCP Server 的规则：
  1. 最小权限：Server 只暴露必要的工具
  2. 输入验证：所有的工具参数都要校验
  3. 操作确认：删除/修改等操作需要二次确认
  4. 审计日志：记录所有的工具调用
```

## 总结

MCP 在 2025 年已经成了 AI 工具集成的标准——就像 USB-C 统一了接口一样，MCP 统一了 LLM 和工具之间的通信。它不复杂：JSON-RPC + 三个概念（工具、资源、提示词）+ 两种传输方式。

对于开发者，MCP 的价值是：

1. **一次开发，到处使用**——写一个 MCP Server，所有支持 MCP 的 LLM 应用都能用
2. **标准化集成**——不用再为不同 LLM 适配多套工具格式
3. **生态丰富**——官方和社区已经提供了几十种现成的 MCP Server（GitHub、Slack、数据库、文件系统……）

如果你在搭建新的 LLM 应用，值得从第一天就把工具集成为 MCP，而不是自定义 Function Calling 格式。
