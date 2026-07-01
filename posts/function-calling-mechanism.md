# Function Calling 机制：LLM 如何学会用工具

> 写作日期：2025-04-10

在 AI Agent 的体系里，Function Calling 是最底层、最关键的能力之一。没有它，LLM 就是个"只会说话的聊天机器人"；有了它，LLM 可以查数据库、调 API、发邮件、控制设备。

这篇文章彻底拆解 Function Calling 的原理、设计和生产级实践。

## 什么是 Function Calling

Function Calling 是让 LLM 输出结构化工具调用指令的能力。**注意措辞**——不是 LLM 真的"调用"了函数，而是 LLM 输出了一个结构化的指令（通常是一个 JSON），由外部代码来执行实际的调用。

```
用户说："帮我查一下北京明天的天气"

LLM → 输出 Function Call:
  {
    "name": "get_weather",
    "arguments": {
      "city": "北京",
      "date": "2026-04-11"
    }
  }

你的代码 → 执行 get_weather("北京", "2026-04-11")
  → 拿到结果后回传给 LLM

LLM → 输出自然语言:
  "北京明天（4月11日）晴，12-24°C，适合出门。"
```

这个循环就是 Agent 的根基——**理解意图 → 调用工具 → 处理结果 → 生成回复**。

## 底层原理

Function Calling 不是什么神奇的"Agent 能力"，它的本质是两条技术路线的结合：

### 技术路线一：工具描述注入 System Prompt

当你注册函数时，LLM 提供商会把函数定义翻译成一段描述文本，拼入 System Prompt。

```
系统提示词（实际内容）：
你现在是一个 AI 助手，你可以使用以下工具：
- get_weather(city, date): 查询某城市某日的天气
  参数: city (string, 必填，城市名), date (string, 可选，日期)
- send_email(to, subject, body): 发送邮件
  参数: to (string, 必填), subject (string, 必填), body (string, 必填)
```

LLM 在理解用户请求时，看到"天气"这个词就关联到 `get_weather` 工具，看到"发邮件"就关联到 `send_email`。

不同厂商对这个注入的实现方式不同，但本质上都是**在 prompt 中描述工具接口**。这也是为什么 OpenAI 的 `tools` 参数本质上等价于在 System Prompt 里写一段工具描述。

### 技术路线二：结构化输出约束

除了描述，系统还会约束输出格式。LLM 的推理过程会偏向输出符合特定 schema 的 token 序列。

```
模型在生成 token 时：
  当模型预测到需要调用工具 →
  它生成的不是自然语言，而是:
  {"name": "get_we
    
  后面的 token 被约束为 JSON 结构:
  ather", "arguments": {"city": "北京", ...
```

这本质上是 **guided generation / constrained decoding**——模型在生成时，每一步的 token 概率分布被 bias 到符合 JSON schema 的方向。

两路线结合，才有了 Function Calling 的稳定性。单靠 prompt 描述（路线一）不约束输出格式，模型可能会生成格式错误的调用。单靠输出约束（路线二）不给上下文，模型不知道什么时候该调用哪个函数。

## 工具描述设计

描述的质量直接决定 LLM 能不能正确调用。一个优化前后的对比：

```
❌ 差的工具描述：
{
  "name": "search",
  "description": "搜索",
  "parameters": {
    "q": { "type": "string" }
  }
}

✅ 好的工具描述：
{
  "name": "search_documents",
  "description": "在知识库中搜索与用户问题相关的文档片段。当用户询问产品信息、技术文档、FAQ 相关内容时使用此工具。",
  "parameters": {
    "query": {
      "type": "string",
      "description": "搜索关键词，应该从用户问题中提取核心概念，通常 2-5 个词。例如用户问'支付接口超时怎么办'，提取为'支付接口 超时'"
    },
    "top_k": {
      "type": "integer",
      "description": "返回结果数量，默认为 3",
      "default": 3
    }
  }
}
```

**工具描述设计原则：**

**原则 1：名字要自解释**

`search` 太笼统，`search_documents` 好一些，`search_knowledge_base` 更明确。名字是 LLM 匹配意图的第一线索。

**原则 2：描述要说明"什么时候用"**

不只是"这个工具做什么"，还要说清楚"什么场景下该用它"。这相当于给 LLM 一个分类判断的依据。

**原则 3：参数描述要给出提取指南**

告诉 LLM 怎么从用户输入中提取参数。上面例子中直接示范了"支付接口超时"→"支付接口 超时"的转换，LLM 看到后提取准确率大幅提升。

## 并行调用

Function Calling 的一个"隐藏技能"是**一次返回多个工具调用**。

```
用户说："北京明天天气怎么样？顺便帮我订两个座位的餐厅"

LLM 一次返回：
  → get_weather("北京", "2026-04-11")
  → search_restaurant("北京", "晚餐")
```

为什么能一次返回？因为工具之间通常**没有数据依赖**。天气和餐厅互不依赖，没必要先查天气再查餐厅。让它们并行执行，整体延迟减半。

**什么时候不适合并行？**

当工具调用之间有数据依赖时：

```
用户说："帮我找一下张三的客户信息，然后给他发一封邮件"

错误的做法（一次返回两个调用）：
  → lookup_contact("张三")
  → send_email(to: ???)    // 还不知道 email 地址！

正确的做法（分两轮）：
  第一轮：lookup_contact("张三") → 拿到 zhang@example.com
  第二轮：send_email("zhang@example.com", ...)
```

好一些的 Agent 框架会在工具描述里注明"本工具依赖 XX 工具的输出"，让 LLM 知道调用顺序。但最可靠的方式还是 Agent Loop 中的多轮交互。

## 错误处理

Function Calling 的生产环境稳定性和 LLM 本身一样——**不完美，需要防御性编程**。

### 错误类型 1：参数缺失

LLM 偶尔会漏掉必填参数。

```
调用 get_weather，但只传了 city，没传 date
```

防御：所有参数校验走 schema（JSON Schema 的 `required` 字段），校验失败时把错误信息返回给 LLM 让它补全。

```
系统返回：
{"error": "缺少必填参数: date。请提供日期，格式为 YYYY-MM-DD"}
```

LLM 看到后会重新生成完整的调用。这本质上是用 Agent Loop 的重试来处理 LLM 的不完美。

### 错误类型 2：幻觉工具名

LLM 有时会编造一个不存在的工具名。

```
{
  "name": "get_weather_data",   // 实际注册的是 "get_weather"
  "arguments": { ... }
}
```

防御：执行前做白名单校验。不在注册表中的工具直接报错。

### 错误类型 3：参数值幻觉

用户提到一个 ID，LLM 可能"猜"出一个看似合理但错误的值。

```
用户："帮我查一下订单 12345"
LLM 可能调用 get_order("12345")
但这个订单其实不存在
```

防御：在工具执行后，把执行结果原样返回给 LLM。让 LLM 自己根据结果决定下一步——查到就说查到，查不到就说没有这个订单。

## 多工具调度

当工具数量增多（超过 10 个），LLM 的调用准确率会明显下降。这时需要做工具分层。

### 分层设计

```
┌─────────────────────────┐
│  第一层：路由器           │
│  分析用户意图，分派任务   │
│  ┌───────────────────┐  │
│  │ 工具组 A：数据查询  │  │
│  │  搜索 / 报表 / SQL │  │
│  ├───────────────────┤  │
│  │ 工具组 B：业务操作  │  │
│  │  下单 / 审批 / 发信 │  │
│  ├───────────────────┤  │
│  │ 工具组 C：系统管理  │  │
│  │  配置 / 日志 / 监控 │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

第一层只输出意图分类和工具组选择，第二层在对应工具组内做具体的 Function Calling。这样可以避免把 50 个工具定义全部塞进 LLM 的上下文窗口。

### 工具数量的影响

| 工具数量 | 调用准确率 | 延迟 |
|---------|-----------|------|
| 1-5     | ~98%      | 低 |
| 5-15    | ~93%      | 中 |
| 15-30   | ~85%      | 中 |
| 30+     | ~75%      | 高（上下文膨胀） |

超过 15 个工具强烈建议分层。这不只是因为准确率下降，还因为每个工具的描述都会占用上下文窗口，30 个工具的描述加起来可能超过 3000 tokens。

## Function Calling vs Tool Use vs MCP

这几个概念经常被混用，梳理一下关系：

```
Function Calling：LLM 输出结构化工具调用的能力
  └─ 底层机制，由 LLM 提供商实现（OpenAI / Anthropic / 等）

Tool Use：在 Agent 中调用工具的完整流程
  └─ 包含：定义工具 → LLM 选择工具 → 执行工具 → 反馈结果
  └─ 基于 Function Calling 能力构建

MCP：工具的标准化接口协议
  └─ 定义工具怎么"注册"和"被发现"
  └─ 跨平台跨语言的工具描述标准
```

三者的关系可以类比为：

```
Function Calling = CPU 指令集
Tool Use = 操作系统
MCP = USB 接口标准
```

Function Calling 让你能调用工具，Tool Use 是调用的流程和框架，MCP 让工具的描述和执行标准化。

## 不同厂商的 Function Calling 实现

### OpenAI

```
// Chat Completion API
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [...],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "...",
        parameters: { ... }
      }
    }
  ],
  tool_choice: "auto"  // auto / required / none
})
```

OpenAI 的 Function Calling 最成熟，支持最丰富的参数约束。`tool_choice` 参数可以控制 LLM 是否必须调用工具——设置为 `required` 时，每一次请求都返回工具调用，不输出自然语言。

### Anthropic

```
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  messages: [...],
  tools: [
    {
      name: "get_weather",
      description: "...",
      input_schema: { ... }
    }
  ]
})
```

Anthropic 叫 Tool Use 不叫 Function Calling。参数叫 `input_schema` 而不是 `parameters`。支持并行调用，但总体上工具描述的字段比 OpenAI 少一些。一个差异：Anthropic 默认会在输出工具调用前先有一段"思考文本"，OpenAI 不会。

### DeepSeek

DeepSeek 的 Function Calling 兼容 OpenAI 的格式，可以直接用 OpenAI SDK 调用。在实际项目（比如我的弼马温项目）中使用，稳定性在 V4 版本后明显提升，但偶尔会有参数缺失的情况。

## 生产级实践清单

```
设计阶段：
  □ 工具名符合命名规范（动词_名词）
  □ 工具描述包含"什么场景下使用"
  □ 参数描述包含提取指南
  □ 超过 15 个工具考虑分层

开发阶段：
  □ 所有参数有 JSON Schema 校验
  □ 并行调用做好数据依赖检查
  □ 2-3 个关键测试用例覆盖常见调用路径

测试阶段：
  □ 参数缺失测试
  □ 幻觉工具名测试
  □ 并行调用测试
  □ 长时间多轮会话测试

监控阶段：
  □ 记录所有 Function Call 的请求/响应
  □ 跟踪工具调用成功率
  □ 监控平均每次请求的工具调用次数
  □ 记录 LLM 返回了非法工具名的频率
```

## 总结

Function Calling 是 AI Agent 的"肢体"——没有它，LLM 只有大脑却无法行动。它看起来只是 LLM 的一个 API 参数，但实际上决定了你的 Agent 能力的上限、稳定性和扩展性。

好的 Function Calling 设计 = 清晰的工具语义 + 严格的参数校验 + 优雅的错误处理 + 适当的分层策略。这些做好了，Agent 的上限取决于你的工具集的广度，而不是 LLM 能力。
