# 弼马温实战：从零构建一个 AI Agent 摩托车油耗管家

前阵子入手了摩托车，每次加油都要掏出手机记里程、算油耗，用了一阵子备忘录和 Excel，烦了。想着反正现在 LLM 这么强，不如写个机器人，发条消息让它自己帮我记。

做着做着就不只是"记油耗"了——最后变成了一个完整的 AI Agent，带多车管理、维保记录、定时提醒、语音输入、Web 仪表盘……名字叫**弼马温**（Bike Moto Agent 的谐音梗，也是孙悟空最早的官职）。

这篇文章完整拆解它的设计和实现，不是什么高大上的框架，就是实实在在从需求到落地的全过程。

## 为什么选 Telegram Bot + Cloudflare Workers

先确定两件事：**交互方式**和**运行环境**。

**交互方式选 Telegram Bot**，原因很简单——骑车的时候打字不方便，Telegram 有语音消息，支持 bot 消息模板，跨平台，而且我和车友群都在 Telegram 上。发一条"加了 10 升 95，98 块，里程 12580"就搞定，不用开任何 App。

**运行环境选 Cloudflare Workers**，理由列表：

```
传统方案                Cloudflare Workers
─────────────           ─────────────────
买服务器、配环境         不需要管理服务器
担心半夜宕机             全球边缘网络
要搞数据库、缓存         D1 + KV 直接提供
SSL、域名、部署          wrangler 一条命令
流量波动要扛扩缩容       按请求计费，自动伸缩
```

零运维、按量计费对于个人项目太合适了。唯一要考虑的是 Workers 的无状态模型——每个请求都是独立运行的，不能假设内存里有全局状态。这实际上倒逼了一个好的架构设计。

## 整体架构

```
Telegram 用户 / PWA 浏览器
        │
        ▼
┌──────────────────────────────────┐
│     Cloudflare Worker 入口       │
│  src/index.ts                    │
│   ├── Telegram webhook handler   │
│   ├── REST API (/api/v1/*)       │
│   ├── PWA Chat API               │
│   └── Cron Triggers              │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│     依赖注入容器 (bootstrap)     │
│  ILLMProvider                   │
│  ISessionStore                  │
│  ITTSProvider                   │
│  IMessenger                     │
│  ToolRegistry                   │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│     消息编排管道 (pipeline)      │
│  1. 语言检测                     │
│  2. 限流                         │
│  3. 频道认证                     │
│  4. 文本提取                     │
│  5. 发送"正在思考..."           │
│  6. 加载会话 + Agent Loop       │
│  7. 历史裁剪 + 持久化           │
│  8. 回复消息                     │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│     AI Agent Loop (agent.ts)    │
│  while round < 8:               │
│    llm.chat(messages, tools)    │
│    if no tool_calls → return    │
│    dispatch(tool_calls)         │
│    push results → messages      │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│   分级模型路由 (RouterLLM)      │
│                                  │
│  简单查询 ─→ DeepSeek Flash      │
│  (问候/确认)    │               │
│                 ├─ 重试 3 次     │
│                 └─ 失败→升 Pro   │
│                                  │
│  复杂查询 ─→ DeepSeek Pro        │
│  (统计/多意图)   │               │
│                 ├─ 重试 3 次     │
│                 └─ 失败→降 Flash │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│      工具层 (20 个 Tool)         │
│  fuel-tools     ─ 加油记录/查询  │
│  vehicle-tools  ─ 车辆管理       │
│  maintenance    ─ 维保记录       │
│  reminder-tools ─ 定时提醒       │
│  mileage-tools  ─ 纯里程记录     │
│  knowledge      ─ RAG 知识库     │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│    Cloudflare 数据层             │
│  D1 (业务数据: 用户/车辆/记录)   │
│  KV (会话/限流/语言偏好)         │
│  Vectorize (知识库向量检索)      │
│  Workers AI (Whisper 语音识别)   │
└──────────────────────────────────┘
```

整个系统可以概括为一句话：**六边形架构 + 自定义 Agent Loop + 分级模型路由**。

## 核心设计一：六边形架构（Ports & Adapters）

这不是为了炫技。Workers 的无状态模型意味着每个请求都可能落在不同的边缘节点上，依赖必须被抽象。

定义接口（Ports）：

```typescript
// src/ports.ts
interface ILLMProvider {
  chat(messages: Message[], tools?: Tool[]): Promise<Response>;
}

interface ISessionStore {
  get(key: string): Promise<Session | null>;
  set(key: string, session: Session): Promise<void>;
}

interface ITTSProvider {
  transcribe(audio: ArrayBuffer): Promise<string>;
}

interface IMessenger {
  send(chatId: string, text: string): Promise<void>;
  replace(chatId: string, messageId: number, text: string): Promise<void>;
}
```

然后为每个接口提供具体实现（Adapters）：

- `DeepSeekLLM` / `AnthropicLLM` 实现 `ILLMProvider`
- `CFKVSession` 实现 `ISessionStore`
- `CFWhisperSTT` 实现 `ITTSProvider`
- `TelegramMessenger` 实现 `IMessenger`

好处是什么？**可以独立测试每一层**。测试 LLM 调用时不需要真的接 Telegram；测试工具逻辑时不需要真的调 LLM。依赖注入在 `bootstrap.ts` 里统一组装，换一个 Provider 改一行配置就行。

## 核心设计二：自定义 Agent Loop

不用 LangChain，不用 Vercel AI SDK，自己写 Agent Loop。理由很简单——对于弼马温这个规模，框架太重了。

```typescript
// src/agent.ts — 精简版
async function agentLoop(
  messages: Message[],
  tools: Tool[],
  llm: ILLMProvider,
) {
  let round = 0;
  const maxRounds = 8;

  while (round < maxRounds) {
    const response = await llm.chat(messages, tools);

    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response.text; // LLM 直接回复，结束
    }

    // 批量执行工具调用
    const results = await Promise.all(
      response.toolCalls.map((call) => dispatchTool(call)),
    );

    // 把工具结果追加到消息历史
    for (const result of results) {
      messages.push(result);
    }

    round++;
  }

  return "我已经思考了足够多轮，暂时无法完成这个请求。";
}
```

核心逻辑只有十几行——while 循环里调 LLM，有 tool_calls 就执行，没 tool_calls 就返回。但这背后有几个关键细节：

**1. 工具注册机制**

所有工具都实现同一个接口，注册到 `ToolRegistry`：

```typescript
interface Tool {
  name: string;
  description: string;
  descriptionEn: string;
  parameters: Record<string, any>;
  execute(args: any, context: ToolContext): Promise<any>;
}

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getToolDefinitions(): ToolDef[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.lang === "zh" ? t.description : t.descriptionEn,
      parameters: t.parameters,
    }));
  }
}
```

这层抽象保证了两件事：LLM 看到的是结构化的工具定义（自动生成 API 描述），实际执行时由注册表分发。加一个新能力 = 写一个 Tool 类 + `registry.register()`。

**2. 语言感知**

因为要支持中英双语，每个工具的 `description` 和 `descriptionEn` 分开存。`getToolDefinitions()` 根据用户的语言偏好返回对应的语言版本。Prompt 也是两套——中文系统提示词和英文的，在管道层根据检测到的语言选择。

## 核心设计三：分级模型路由

LLM API 是要花钱的。如果所有请求都用最强模型，一个月下来账单会哭。但如果都用低成本模型，复杂的查询又处理不好。

解决方案是**分级路由**——先判断消息复杂度，再决定用哪个模型：

```
┌──────────┐
│ 用户消息  │
└─────┬────┘
      ▼
┌──────────────┐
│  复杂度分类器  │  ← 启发式规则
│              │     - 消息长度
│  simple ───┐ │     - 是否含数字、统计关键词
│  complex ─┤ │     - 是否有多意图迹象
└──────────┬─┘ │
           │   │
           ▼   ▼
     ┌──────────────┐
     │  FallbackLLM │
     │              │
     │  Flash × 3   │  ← 重试 3 次
     │    ↓ 都失败   │     指数退避
     │  Pro × 1     │  ← 升一级
     └──────────────┘
```

实际测试下来，约 60% 的消息被归为 simple，只用 Flash 就处理得很好，成本是 Pro 的 1/30。剩下的 40% 走 Pro，其中又有约 5% 在 Pro 重试 3 次失败后降回 Flash——这时 Flash 虽然能力弱一些，但总比直接报错强。

**Fallback 链的实现**：

```typescript
class FallbackLLM implements ILLMProvider {
  constructor(
    private primary: ILLMProvider,
    private secondary: ILLMProvider,
    private maxRetries: number = 3,
  ) {}

  async chat(messages: Message[], tools?: Tool[]) {
    let lastError: Error | null = null;

    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await this.primary.chat(messages, tools);
      } catch (e) {
        lastError = e;
        await sleep(1000 * Math.pow(2, i)); // 指数退避
      }
    }

    // 主 Provider 全部失败，降级到备选
    return this.secondary.chat(messages, tools);
  }
}
```

## 工具系统的实战细节

弼马温目前注册了 **20 个工具**，分布在 6 个文件中。拿加油记录这个核心流程举例：

用户发："刚加了 10 升 95，98 块，里程 12580"

LLM 收到后判断这是 `log_fuel` 调用：

```json
{
  "name": "log_fuel",
  "arguments": {
    "liters": 10,
    "fuel_type": "95",
    "total_cost": 98,
    "odometer": 12580,
    "date": "2026-06-30"
  }
}
```

工具执行后返回：

```json
{
  "success": true,
  "record": {
    "id": 42,
    "liters": 10,
    "consumption": 3.85,
    "prev_odometer": 12320,
    "mileage_since_last": 260
  },
  "stats": {
    "avg_consumption_30d": 3.92,
    "total_cost_ytd": 1280
  }
}
```

LLM 拿到结果后用自然语言回复：

> ⛽ 已记录！10L 95号汽油，98元，9.8元/L
> 本次油耗：3.85 L/100km（跑了 260km）
> 近 30 天平均油耗：3.92 L/100km

这里有个重要的设计原则：**LLM 负责理解和表达，工具负责计算和存储**。油耗是服务器算的，不是 LLM 算的（LLM 算数不靠谱）。LLM 只做它擅长的事——理解自然语言和生成自然语言回复。

## 系统提示词设计

System Prompt 是整个 Agent 行为最关键的文档。它定义了 LLM 在 Agent 中的角色、能力边界和规则。

核心设计原则：

```
你是一个摩托车油耗管理助手（名叫弼马温）。

你的核心能力：
1. 【记录加油】提取日期、油量、价格、里程
    - 如果信息不全，主动追问缺少的字段
    - 注意区分"加满"和"加固定金额"
2. 【查询统计】支持按日期区间、最近 N 条、月统计
3. 【多车管理】知道用户当前用的是哪辆车
    - 所有操作都针对当前默认车辆
    - 用户说"给我的本田加过油了"→切换车辆再记录

重要规则：
- 涉及删除、修改的操作，必须先请求用户确认
- 不知道就直说不知道，不要编造
- 输出纯文本，不要用 Markdown 格式
```

几个设计心法：

**负面约束比正面指导更有效**。"不要用 Markdown 格式"比"请使用纯文本"效果好得多。我试过后者，LLM 偶尔还是会输出 `**加粗**`。

**边界条件要在 Prompt 里明确**。比如"信息不全时追问"——不加这条，LLM 会在里程缺失时自己编一个。

**操作确认是安全底线**。"删除前必须确认"这条规则硬编码在 Prompt 里还不够，工具层也有二次校验——`delete_fuel_record` 需要先调用 `get_last_record` 展示给用户，用户确认了才真的删除。

## 语音输入和知识库

**语音输入**：Telegram 语音消息 → Workers AI Whisper（`@cf/openai/whisper-large-v3-turbo`）→ 转成文字 → 走正常文本管道。全部在 Cloudflare 生态内完成，不需要额外服务。

**RAG 知识库**：我把几本摩托车维修保养手册的 PDF 做了切割（300 tokens/chunk，50 token overlap），用 `@cf/baai/bge-m3` 模型嵌入到 1024 维向量，存到 Cloudflare Vectorize 里。当用户问专业问题（"链条多久保养一次"），触发 `search_knowledge` 工具，检索 Top-3 相关段落拼到上下文里。实测对回答质量提升很明显，尤其是那些模型训练数据里可能没有的细碎知识。

## 前端：PWA 仪表盘

用 Svelte 5 + Vite + Chart.js 写了一个 PWA 仪表盘，直接通过 Worker 的 static assets 托管，没有额外的服务器和域名。

```
┌─────────────────────────────────────┐
│  ⛽ 弼马温  Dashboard              │
│                                     │
│  ┌─────────┐ ┌─────────┐           │
│  │ 总加油次数│ │ 总花费   │           │
│  │   42     │ │ ¥3,280  │           │
│  └─────────┘ └─────────┘           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  油耗趋势 (折线图)           │   │
│  │  ▁▃▂▄▅▆▃▄▂▃▁              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  最近 5 条加油记录           │   │
│  │  06/28  3.85L/100km  260km │   │
│  │  06/15  4.12L/100km  190km │   │
│  │  ...                      │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

PWA 的核心价值不是"好看"，而是让用户可以不打开 Telegram 也能查看统计。通过 Magic Link + Google OAuth 登录，绑定 Telegram 账号后数据互通。

## 测试策略

287 个单元测试，覆盖了从工具逻辑到数据库访问到 LLM 调用的每一层。测试架构分三层：

```
┌─────────────────────────────────┐
│  第一层：纯逻辑单元测试           │
│  测试工具函数、数据格式化、       │
│  路由分类器，不依赖任何外部服务   │
├─────────────────────────────────┤
│  第二层：模拟依赖的集成测试       │
│  用 Miniflare 模拟 D1/KV       │
│  用 mock LLM Provider 测试      │
│  Agent Loop 逻辑               │
├─────────────────────────────────┤
│  第三层：端到端验证（手动触发）    │
│  正式 LLM + Telegram API 的     │
│  真实调用，只在功能验证时执行     │
└─────────────────────────────────┘
```

第二层是最有价值的部分：用 Miniflare 在本地跑 Cloudflare 的模拟环境，D1、KV、Vectorize 都有模拟实现。这样 CI 里也能跑完整的集成测试。

## 实际使用效果与反思

用了两个月，每天发几条消息记录加油，偶尔查查统计。**真实感受：这才是 AI Agent 该有的样子**——不用打开 App、不用点按钮、不用选菜单，发一条消息就完事。

但也有一些值得反思的地方：

**1. 多轮对话的上下文管理**

Telegram Bot 的会话是持续的，用户的查询可能依赖之前的上下文。KV 存储 session 有 1 小时 TTL，过期后会丢失上下文。策略是：短对话（单次查询）完全不受影响，长对话（连续提问）如果超过 1 小时没说话，会让用户重复一下前文。

**2. 成本控制**

分级路由确实省钱，但最花钱的其实不是 LLM 调用——而是**开发调试阶段**。上线后每天几十次调用，月费不到 1 美元。但开发时调试 Agent Loop，每次触发 tool_calls 循环可能一次就消耗 3-5 轮 API 调用，一天下来十几块。建议开发时用低成本模型，上线再切正式的配置。

**3. LLM 的"过度思考"**

有时候用户只是随便说句话（"今天天气真好"），LLM 会尝试把它解析成加油记录或者调用某个工具。解决方式是在 System Prompt 里加了一条：**当用户消息明显与摩托车管理无关时，用闲聊方式回复，不要解释为什么不调用工具。** 这条规则单独写比指望 LLM 自己"理解"上下文边界效果好得多。

**4. 工具调用的可靠性**

DeepSeek 的 function calling 有时候会漏参数（比如记录加油漏了 `fuel_type`）。方案是：工具参数里把所有必填字段标为 `required`，LLM 如果漏了会报参数校验错误，Agent Loop 会把错误信息传回给 LLM 让它在下一轮补上。本质上是用 Agent Loop 的重试机制来处理 LLM 的不稳定性。

## 一些数字

- 代码行数：约 5000 行 TypeScript（不含测试）
- 测试：287 个，覆盖率 ~85%
- 工具：20 个，分布在 6 个文件
- 生产依赖：1 个（`grammy` 框架）
- 数据库迁移：10 次，都是向前兼容的增量变更
- 架构决策记录：10 个 ADR

## 经验总结

弼马温这个项目让我对 AI Agent 有了几个直观的认知：

1. **Agent ≠ 大模型**。Agent 是一个系统设计问题，不是 LLM 能力问题。好的 Agent 设计是把 LLM 放在它擅长的位置（理解、推理、生成），把不擅长的交给确定性的代码。

2. **工具是 Agent 的接口，不是累赘**。很多人觉得写工具定义是额外工作，但这些工具本身就是能力边界——LLM 只能通过工具和外界交互，这意味着你可以精确控制它做什么、不做什么。

3. **Prompts 是代码，不是散文**。每个 prompt 都要版本化、测试、Review。弼马温的 System Prompt 迭代了十几个版本，每次改 Prompt 都和改代码一样走完整的测试流程。

4. **无状态架构对 Agent 开发是好事**。Workers 强制无状态让架构更清晰——session 在 KV 里，业务数据在 D1 里，Agent 状态在消息历史里。每层各自管好自己的存储，出了问题好排查。

弼马温的源码在 [github.com/wangxunbing/moto_agent](https://github.com/wangxunbing/moto_agent)，文档非常详细（PRD、架构设计、20 份 Spec、10 个 ADR），感兴趣的可以看看。
