# Microsoft Agent Framework 企业级实战：构建安全、可审计的查询 Agent 系统

如果只是学习 Agent Framework，写一个天气查询 Demo 并不难：注册一个函数，把它交给模型，等待 Function Calling 返回结果。

但企业项目真正困难的部分，通常不在“模型会不会调用函数”，而在另外一些问题：模型能不能调用不该调用的接口？手机号是用户提供的，还是模型猜出来的？外部接口返回的文本会不会反过来注入模型？审计库不可用时，还要不要继续查询？回答是依据真实证据，还是模型把“查不到”说成了“未认证”？

我最近用 `.NET 10 + Microsoft Agent Framework` 完成了一个法大大认证信息只读查询 Agent。用户可以用自然语言查询个人认证、企业认证、企业管理员关系和印章授权信息，系统负责选择受控工具、编排只读接口、组织证据并生成回答。项目最后不仅跑通了模型和真实只读链路，还补齐了会话、账号、安全、审计、可观测性、离线评测、SQL Server 持久化与 IIS 部署。

这篇文章不从 Hello World 开始，而是围绕这个实战工程回答一个问题：**Microsoft Agent Framework 放进企业系统后，应该负责什么，又绝不能负责什么？**

## 一、先看项目最终形态

这个项目不是通用聊天机器人，也不是让模型自由探索业务系统。它的定位很窄：面向企业内部人员，提供法大大认证与授权信息的只读查询。

用户可以这样问：

```text
查询手机号 138****0000 对应人员是否已认证。

查询星河测试有限公司是否完成企业认证，管理员是谁。

手机号 138****0000 是不是星河测试有限公司的管理员？

查询星河测试有限公司有哪些印章，以及该手机号是否有授权。
```

背后涉及的却不是一次简单 HTTP 请求。以“某人是不是某企业管理员”为例，系统需要取得人员账号与认证证据、企业账号与认证证据，再比较企业管理员账号和人员账号。这里既有多接口依赖，也有短路、状态归一化、部分失败和证据合并。

最终架构如下：

```text
Blazor Server / Minimal API
            |
       Application Ports
            |
 Microsoft Agent Framework
   ChatClientAgent + Function Calling
            |
 ownership -> provenance -> schema -> budget -> audit -> sanitize
            |
 query_person | query_company | query_relationship | query_seals
            |
   确定性的 C# 领域编排与证据规则
            |
       法大大固定只读端点

SQL Server      账号、会话、Turn、证据和结构化审计
OpenTelemetry   非敏感 Trace、指标、Token 与成本
Eval Harness    离线回归、安全用例和发布门禁
```

工程按边界拆成 6 个生产项目：

```text
src/
  Fadada.CertificationQueryAgent.Domain
  Fadada.CertificationQueryAgent.Application
  Fadada.CertificationQueryAgent.AgentHost
  Fadada.CertificationQueryAgent.Infrastructure
  Fadada.CertificationQueryAgent.Infrastructure.SqlServer2012
  Fadada.CertificationQueryAgent.Web
```

`Domain` 只保存值对象、证据和确定性规则；`Application` 定义端口与契约；`AgentHost` 承载 Agent、Prompt、Function Tools 和策略管线；`Infrastructure` 对接模型网关与法大大；SQL Server 2012 因为兼容性要求被隔离成单独适配器；`Web` 负责登录、会话和工作台。

这里第一条重要经验是：**Agent 应该是应用层的一种编排入口，而不是吞掉整个系统分层的新架构。**

## 二、架构不是一步到位的：从自研意图解析到 MAF

项目第一版没有真正使用 Agent Runtime，而是采用了更传统的 AI 增强架构：

```text
用户输入
  -> 模型输出 QueryIntent JSON
  -> Grounding Validator 校验字段来源
  -> Deterministic Planner 生成查询计划
  -> QueryOrchestrator 调用法大大
  -> ResultEvaluator 形成结论
  -> SummaryRenderer 输出文本
```

这个方案安全、确定，也能工作。但继续开发后问题很明显：我实际上正在手写一个不完整的 Agent Runtime。

模型调用、结构化输出、工具选择、循环调用、上下文传递、流式事件都要自己维护；同时 `IntentParser`、`Planner`、`Orchestrator` 之间存在大量中间模型。每增加一种查询，既要改意图 Schema，又要改 Planner 和编排器。模型明明已经具备 Function Calling 能力，系统却先让它生成一份“调用计划的 JSON”，再由代码把 JSON 翻译成函数调用。

重构后的思路是：

```text
保留：领域值对象、证据规则、固定端点、审计、安全策略
替换：自研 Intent JSON + Planner + Agent 循环
引入：ChatClientAgent + FunctionInvokingChatClient + AIAgentBuilder
```

这里不是从“确定性”走向“全交给模型”，而是重新划分确定性的边界：

- 自然语言理解、缺参澄清、领域工具选择交给 Agent。
- URL、HTTP 方法、SQL、身份、参数来源、外部调用顺序和业务结论仍由 C# 控制。
- Prompt 负责表达策略，但安全规则必须在 Prompt 之外再次执行。

这也是我对 Agent Framework 最重要的理解：**框架帮我们管理模型与工具之间的循环，但它不替业务系统承担授权和正确性责任。**

## 三、Microsoft Agent Framework 在项目里到底做了什么

项目锁定的核心版本是：

```xml
<!-- 集中锁定 Agent 与模型抽象版本，避免不同项目发生协议漂移。 -->
<PackageVersion Include="Microsoft.Agents.AI" Version="1.19.0" />
<PackageVersion Include="Microsoft.Extensions.AI" Version="10.9.0" />
<PackageVersion Include="Microsoft.Extensions.AI.Evaluation" Version="10.9.0" />
```

### 1. `IChatClient` 是模型边界

`Microsoft.Extensions.AI.IChatClient` 把 Agent Runtime 与具体模型 Provider 隔开。`AgentHost` 只认识 `IChatClient`，不知道请求最终发往 OpenAI、Azure OpenAI，还是公司内部的 Responses 兼容网关。

这使模型适配器只承担协议职责：

- 把 `ChatMessage`、Instructions 和 `AIFunction` 转成 `/v1/responses` 请求。
- 解析文本、Function Call、Function Result 和 Usage。
- 处理取消、超时、重试和安全错误映射。
- 固定 `store=false`，不依赖 Provider 保存会话。

项目没有直接依赖仍带实验诊断的官方 Responses 适配器，而是实现了一个很窄的 `ResponsesChatClient`。原因不是为了重复造轮子，而是内部网关只兼容 Responses API 的一个子集，且不同模型路由的 SSE 行为不稳定。

最终策略是：模型侧先取得完整的无状态响应，再映射为 `IChatClient` 的 streaming 接口；Web 层仍然使用统一的 Agent 事件流。这个取舍牺牲了逐 Token 的真实流式体验，却换来了 Function Calling、取消、Usage 和错误语义的一致性。

适配器的重试也很克制：只对 `502/503/504` 做一次有界重试，认证失败和其他 `4xx` 不重试。生产系统里的重试不是“多试几次”，而是必须明确哪些操作可重放、最多重放几次，以及如何进入审计。

### 2. `ChatClientAgent` 是 Agent 抽象

运行时核心可以简化为下面这段：

```csharp
// 预算客户端在每次模型请求前计数，防止 Function Calling 循环失控。
IChatClient governedClient = new ModelCallBudgetChatClient(modelClient);

var functionClient = new FunctionInvokingChatClient(governedClient)
{
    AllowConcurrentInvocation = false,
    IncludeDetailedErrors = false,
    MaximumConsecutiveErrorsPerRequest = 0,
    MaximumIterationsPerRequest = 4,
    TerminateOnUnknownCalls = true
};

var agent = new ChatClientAgent(
    functionClient,
    new ChatClientAgentOptions
    {
        Id = "fdd-domain-query-agent",
        Name = "FddDomainQueryAgent",
        ChatOptions = new ChatOptions
        {
            Instructions = prompt,
            Tools = tools,
            AllowMultipleToolCalls = true
        },
        // 已经显式组装过 FunctionInvokingChatClient，框架不再重复包装。
        UseProvidedChatClientAsIs = true
    });
```

`FunctionInvokingChatClient` 负责最核心的 Tool Loop：

```text
模型判断需要工具
  -> 返回 FunctionCallContent
  -> 框架执行 AIFunction
  -> 把 FunctionResult 追加到上下文
  -> 再次调用模型生成回答或继续选工具
```

`ChatClientAgent` 则提供统一的 Agent 身份、会话和运行接口。它既可以 `RunAsync` 一次返回完整结果，也可以 `RunStreamingAsync` 产出更新。

### 3. `AIAgentBuilder` 用来插入运行期治理

框架的中间件能力很关键。项目在 Agent 外层增加两类拦截：

```csharp
var builder = new AIAgentBuilder(chatClientAgent);

// 运行前验证当前 Turn 上下文和 Provider Session，拒绝隐式远端会话。
builder.Use(ValidateAgentRunAsync);

// 每个 Function 调用前后分配 ToolCallId、检查预算并发布安全事件。
FunctionInvocationDelegatingAgentBuilderExtensions.Use(builder, InvokeFunctionAsync);

var agentPipeline = builder.Build(services: null);
```

这层中间件并不代替后面的 Tool Policy。它解决的是 Agent 运行期问题：当前调用属于哪个 Turn、已经用了几次模型和工具、事件应该归属到哪个 ToolCall、Provider 是否偷偷引入了远端会话状态。

项目每回合最多 4 次模型调用、3 次领域工具调用，而且配置只能收紧，不能突破已经过发布测试的上限。一个典型单工具回合通常是 2 次模型调用：第一次选择工具，第二次基于证据回答。

## 四、为什么只有一个 Agent，而且工具必须粗粒度

看到“人员、企业、印章”几个领域，很容易下意识拆成多个 Agent，再加一个 Supervisor。这个项目刻意没有这样做。

原因很简单：四类查询共享同一组用户、会话、安全规则和外部系统，差别主要在确定性的接口组合。强行拆成多 Agent 会引入新的路由、消息传递、状态同步和失败恢复成本，却没有换来真正独立的自治边界。

因此核心只保留一个 Agent，向模型暴露四个粗粒度工具：

| 工具 | 用户意图 | 内部可能执行的动作 |
|---|---|---|
| `query_person` | 查询个人账户与认证 | 账号查询 -> 个人认证查询 |
| `query_company` | 查询企业与认证 | 企业查询 -> 企业认证查询 |
| `query_relationship` | 查询个人、企业和管理员关系 | 并行取得个人/企业证据 -> 确定性比较 |
| `query_seals` | 查询印章与可选的个人授权 | 企业、印章列表、印章详情与授权证据 |

模型看不到 `getAccessToken`、`getAccount`、`getCompany` 这样的 Provider 细节，更看不到 URL、HTTP Method 和凭据。底层端点目录是一个冻结的 7 项集合，其中业务查询全部为 GET，只有获取访问令牌是固定 POST。

工具 Schema 同样采用封闭世界设计：

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "mobile": { "type": "string", "minLength": 1 },
    "companyFullName": { "type": "string", "minLength": 1 },
    "claimedName": { "type": ["string", "null"], "minLength": 1 }
  },
  "required": ["mobile", "companyFullName", "claimedName"]
}
```

这里有一个 Responses strict schema 的实战细节：所有属性都要出现在 `required` 中，业务上的可选值使用 `string | null` 表达，同时禁止额外属性。这样既满足网关的 strict contract，也不会让模型塞进 `url`、`sql` 或未知参数。

粗粒度工具还有一个很实际的好处。最初复合问题可能先调用 `query_person`，再调用 `query_company`，最后才发现还要判断关系，不仅多耗模型轮次，还容易得到部分结论。加入 `query_relationship` 后，Prompt 明确要求：只要同时出现手机号、企业全称和关系问题，就优先一次取得完整关系证据。

所以工具粒度不应机械地对应底层 API，而应对应**用户要完成的领域任务和审计边界**。

## 五、一次查询如何穿过系统

假设用户已经登录，并在当前会话输入：

```text
张三，手机号 138****0000，是不是星河测试有限公司的管理员？
```

完整链路如下：

```text
1. Web 校验 Cookie 身份、CSRF、消息长度和 Turn 限流
2. SQL 按 UserId 读取会话，确认会话处于 Active 状态
3. 持久化 User Message，并记录 Prompt/模型/工具契约版本与 SHA-256
4. DomainAgentRuntime 从数据库重新加载规范会话历史
5. ChatClientAgent 调用模型，模型选择 query_relationship
6. AIAgentBuilder 中间件分配 ToolCallId 并占用工具预算
7. ToolPolicyPipeline 依次执行 10 道策略
8. C# 领域服务调用固定法大大只读端点并构造 EvidenceEnvelope
9. 清洗后的证据回到模型，模型生成中文业务回答
10. Web 累积 SSE 文本，先持久化 Turn 与 Assistant Message
11. 持久化成功后，才发送 turn.completed 终止事件
```

第 10、11 步很容易被忽略。很多流式聊天实现先向浏览器发送“完成”，再异步保存消息。一旦保存失败，用户看到成功，刷新页面却丢失回答。

这个项目反过来做：文本增量可以先发，但终止事件必须等持久化成功后再发。如果完成写入失败，客户端得到的是 `STORE_TURN_COMPLETION_FAILED`，而不是一个虚假的成功状态。**流式协议的终止事件，本质上也是一致性契约。**

## 六、最关键的安全设计：参数来源证明

只在 Prompt 里写“不要编造手机号”是不够的。模型可能误抄、补全，甚至从工具结果里拿到另一个手机号后继续查询。

项目为此实现了参数来源证明（provenance）：每个工具参数不仅要格式正确，还必须能追溯到同一用户、同一活动会话中的用户原文。

具体过程是：

```text
模型提出参数：mobile = 13800000000
        |
        v
按字段类型规范化：空格、连字符等被统一
        |
        v
只搜索当前会话里的 User Message
        |
        v
找到相同规范值，并记录 MessageId / UserId / ConversationId
        |
        v
标记为 UserExplicit，工具才允许执行
```

手机号允许用户写成带空格或连字符的形式，但规范化后必须还是同一个 11 位值；姓名和企业全称需要出现在规范化后的用户文本里。Assistant Message、模型推断和外部工具返回都不能建立新的 provenance。

这解决了一个典型的间接越权场景：

```text
用户只授权查询企业 A
  -> 企业接口返回管理员手机号 B
  -> 模型试图继续调用 query_person(B)
  -> B 没有出现在用户原文中
  -> argument-provenance 拒绝调用
```

换句话说，**数据可以成为回答证据，但不能自动升级为下一次查询的授权。**

## 七、Tool Policy 不是一个 if，而是一条有顺序的管线

每次 Function Calling 都要经过固定顺序的 10 道策略：

```text
authenticated-principal
  -> conversation-ownership
  -> registered-tool
  -> tool-schema
  -> argument-provenance
  -> turn-budget
  -> tool-audit-gate
  -> tool-execution
  -> tool-result-sanitization
  -> post-response-evidence
```

顺序本身就是安全设计。例如，必须先校验会话所有权，再解析工具；必须先完成审计预写，再访问外部系统；必须先清洗结果并确认它具备证据结构，才能交还给模型。

几个值得展开的点：

### 1. 工具和参数都采用 allowlist

工具名只能来自不可变注册表。`delete_company` 之类的未知工具会在执行前被拒绝。每个工具的参数名、必填性和类型同样固定，出现额外的 `url` 字段也会失败。

### 2. 重复调用和预算同时控制

管线对“工具名 + 规范化参数”计算 SHA-256 指纹。同一回合重复调用相同工具和参数，会收到 `POLICY_DUPLICATE_TOOL_CALL`；第四个不同工具则触发预算上限。

仅限制调用次数还不够，因为模型可能用同一个查询反复消耗外部资源。仅去重也不够，因为模型可以不断改变参数。二者要同时存在。

### 3. 审计是硬门禁，不是旁路日志

OpenTelemetry 适合看延迟、错误率和 Token，但 Collector 不可用时，不应该决定业务是否可执行。反过来，涉及人员认证信息的外部查询如果无法留下审计，就不应该继续。

因此项目把二者分开：

- OpenTelemetry 是 best effort，不保存 Prompt、参数、原始结果和高基数业务标识。
- SQL 结构化审计是系统记录，工具和外部调用都必须先 `Prewrite`。
- 审计预写失败时 fail closed，外部请求根本不会发出。

### 4. 外部结果永远是不可信输入

法大大返回的名称、状态文本甚至异常消息，都可能包含意外内容。工具结果在进入模型前会移除 Provider 原始载荷、内部错误码和敏感字段，并检测类似“ignore previous instructions”的间接 Prompt Injection 文本。

净化后的结果还必须具有统一 `EvidenceEnvelope` 结构，否则以 `POLICY_EVIDENCE_INVALID` 拒绝。模型从来不会直接看到原始 Provider JSON。

## 八、不要让模型计算业务事实，要让它解释证据

模型适合把结构化证据解释成自然语言，但不适合决定“管理员是否匹配”“认证是否完成”这类可由代码精确计算的事实。

领域服务返回的不是随意 JSON，而是证据信封：

```text
EvidenceEnvelope<T>
  status             Succeeded / Partial / NotFound / Failed
  data               规范化后的人员、企业、关系或印章数据
  facts              可引用的证据事实及可靠性
  conclusion         确定性代码计算的结论
  missingEvidence    缺失了哪些证据
  safeErrors         可公开的安全错误
  metadata           Trace 与来源端点，不含秘密
```

外部系统的各种状态先映射为内部有限枚举，未知值就是 `Unknown`，不能擅自当作“未认证”。多个接口的状态再由 `EvidenceRules` 聚合：成功、部分成功、未找到和失败有明确区别。

以关系查询为例，C# 会完成这些判断：

- 人员账号是否存在。
- 人员认证是否有可靠证据。
- 企业是否存在并完成认证。
- 企业管理员账号是否与人员账号一致。
- 用户声称的姓名与认证姓名是否一致。
- 哪个环节缺失或失败，结论是否只能是部分结果。

模型最后做的是“翻译”：把 `Confirmed`、`MissingEvidence` 和对应事实表达成普通业务语言。Prompt 还要求不能暴露内部结论码和枚举名。

这条边界值得反复强调：**LLM 负责语言，代码负责事实。**

## 九、会话记忆也必须以服务端事实为准

Agent Framework 提供 Session 抽象，但项目没有把 Provider 的 Conversation ID 当成权威状态。每次 Turn 都从 SQL Server 按 `ConversationId + UserId` 重新读取历史消息，再转换成 `ChatMessage`。

这样做有三个原因：

1. 会话所有权由应用数据库控制，不依赖模型 Provider。
2. Prompt 和工具参数来源检查需要一份可审计的用户原文。
3. Provider 存储关闭后，迁移模型或网关不会丢掉业务会话。

运行前中间件还会拒绝带有远端 Conversation ID 的 Provider Session，避免系统在不知情的情况下形成第二份会话事实源。

会话支持创建、历史查看、归档和恢复。归档会话可以只读查看，但不能继续执行 Turn；恢复后才重新进入活动状态。SQL 使用 8 字节 `rowversion` 做乐观并发控制，避免同一会话的两个并发请求写乱消息序号。

## 十、Web 层不是附属品，它也是 Agent 边界

最终交付不是一个控制台 Demo，而是 Blazor Interactive Server 工作台和 `/api/v1` 接口。

Web 安全包含：

- 本地账号与 Cookie 登录，IP 只用于限流和审计，不作为用户身份。
- `HttpOnly + SameSite=Strict + Secure` 的生产 Cookie。
- 所有写状态请求执行 Antiforgery 校验。
- 登录和 Agent Turn 分别限流。
- 每个会话操作都按当前 `UserId` 隔离。
- Markdown 先经 Markdig 渲染，再由 HtmlSanitizer 清洗。
- `/health/live` 可公开探活，`/health/ready` 只允许回环地址访问。
- 统一安全错误码与 TraceId，不向浏览器泄漏异常详情。

这里还有一个部署中真实踩到的问题：生产 Cookie 被强制设为 Secure 后，如果 IIS 只有 HTTP 绑定，访问登录页时 Antiforgery 无法签发安全 Cookie，最终只会得到一个通用服务错误。正确修复是补齐 HTTPS 绑定和证书，而不是关闭 CSRF 或降低 Cookie 策略。

这类问题提醒我：Agent 的生产可靠性，至少一半仍然是普通 Web 工程和运维工程。

## 十一、如何评测一个 Agent，而不是只测试几个类

传统单元测试可以验证工具 Schema、值对象和证据规则，但不能回答“Prompt 改了一句后，Agent 是否还会选对工具”。所以项目建立了分层测试：

```text
Unit
  值对象、证据规则、provenance、预算与结果净化

Contract
  IChatClient 请求/响应、Function Call、Usage、取消与错误映射

Integration
  DomainAgentRuntime + ChatClientAgent + 工具策略 + 合成 Provider

Architecture / Security
  项目依赖方向、四工具精确集合、七端点精确集合、无动态 URL/SQL

Web
  登录、CSRF、所有权、SSE 完成顺序、Markdown XSS

Agent Eval
  澄清、工具序列、参数、证据状态、安全决策和框架评估
```

离线 Eval 数据集包含 36 个合成或去标识案例，发布门禁要求：

- 36/36 全部通过。
- 工具选择和参数准确率 100%。
- 安全违规为 0，未知或禁止工具调用为 0。
- 澄清行为、证据状态和框架检查精确匹配。
- 人为注入的工具选择与安全回归必须能被测试捕获。

离线 Target 仍然运行真实的 `DomainAgentRuntime`、`ChatClientAgent`、Function Calling 路径和 Tool Policy，只把模型与法大大替换为确定性的内存 Fixture。这样门禁可重复、不会访问真实数据，也不会因为模型随机性让 CI 偶发失败。

但报告明确设置 `supportsModelQualityClaims=false`。它能证明架构与策略没有回归，不能证明真实模型的自然语言泛化能力、输出质量、延迟或成本。要做这些声明，必须建立单独启用、锁定模型版本的在线评测。

这个区分非常重要：**确定性安全门禁和概率性模型质量评估，不应该混成一个分数。**

项目验收快照中，默认离线测试共 124 项全部通过，Agent Eval 为 36/36；真实复合查询使用 `query_relationship`，一次工具调用内部完成 5 次只读外部调用，并形成完整审计链。这些数字的意义不是“测试很多”，而是从模型选择工具一直覆盖到持久化和 Web 安全。

## 十二、数据库与部署：为 Agent 行为留下可恢复状态

SQL Schema V2 有 12 张 `FddAgent*` 表和 19 个二级索引，保存账号、会话、消息、Turn、模型调用、工具调用、外部调用、状态和可选诊断载荷。

应用启动时不会自动建库或迁移。数据库脚本需要人工确认目标库后按顺序执行，最后由 readiness 脚本验证 `SchemaVersion = 2`。这是为了避免应用身份意外获得 DDL 权限，也防止连接串配错时在业务库创建对象。

项目保留了 SQL Server 2012 Lab 适配器，但它被隔离在独立 Infrastructure 项目中，只代表实验环境兼容，不代表生产推荐。正式环境仍然要求受支持的数据库版本、加密连接和服务端证书。

本地可以先用完全合成数据的 UI Demo 体验：

```powershell
# UiDemo 仅允许 Development，避免演示适配器进入生产依赖图。
dotnet restore FadadaCertificationQueryAgent.slnx --locked-mode
.\scripts\Start-CertificationQueryAgent.ps1 -UiDemo
```

真实链路的秘密放在 Git 忽略的 `appsettings.Local.json` 或服务器秘密系统中，发布包不会复制该文件。模型 API Key、法大大 AppSecret、数据库连接串、Prompt 和原始证据都不能进入日志、Trace、截图或构建产物。

IIS 部署还需要注意：安装匹配的 .NET 10 Hosting Bundle、独立应用池、单工作进程、HTTPS、发布目录外的 Data Protection 密钥，以及应用池身份对密钥目录的 ACL。

## 十三、这次实战对 MAF 的几点认识

### 1. Agent Framework 不是业务框架

MAF 很适合管理 Agent、模型、Session、Function Calling 和中间件，但不会替你定义业务证据、权限模型和失败语义。越是高风险领域，越要把这些规则放在框架外的普通代码中。

### 2. 不要为了使用框架而使用 Multi-Agent 或 Workflow

人员、企业和印章查询虽然有多个分支，但本质是一个 Agent 面向一个封闭领域。Provider API 的调用顺序是稳定业务规则，用 C# 编排比让多个 Agent 协商更可靠、更便宜，也更容易审计。

只有当任务真的存在独立角色、长时间运行、检查点恢复或跨团队自治边界时，才值得引入 Workflow 或 Multi-Agent。

### 3. Function Tool 是安全 API，不是普通方法包装

一个生产工具至少需要：稳定名称、清晰描述、strict schema、最小参数、来源校验、调用预算、审计、结果净化和版本化。直接把 Repository 或 HttpClient 方法批量暴露给模型，几乎一定会把内部实现细节和权限一起暴露出去。

### 4. Prompt 版本要和代码版本一样被管理

项目在每个 Turn 记录 Prompt 版本与 SHA-256，同时记录模型名和工具契约版本。这样某次回答出现问题时，可以知道它到底运行在哪一份 Prompt 和 Schema 上，而不是只看到“模型回答错了”。

### 5. Fail closed 会降低可用性，但这是有意识的取舍

审计库不可用就不查、参数来源不明就澄清、证据不完整就只返回部分结论。这些策略会让系统比普通聊天机器人更“保守”，却更符合企业查询系统的责任边界。

### 6. 真实网关兼容性必须用契约验证

“兼容 OpenAI API”不等于每个细节都兼容。Base URL、strict tools、Function Result continuation、SSE、Usage、错误码和存储选项都可能不同。用 `IChatClient` 隔离变化，再通过契约测试和显式真实探针验证，比在业务层到处写 Provider 分支更稳妥。

## 结语

做完这个项目后，我对 Microsoft Agent Framework 的评价是：它真正有价值的地方，不是让一个 Demo 少写几十行 Function Calling 循环，而是提供了一个足够清晰的 Agent 抽象和扩展点，让模型编排可以嵌入现有 .NET 工程。

但框架只解决了一部分问题。一个能进入企业环境的 Agent，还需要回答身份从哪里来、参数为什么被授权、工具为什么可调用、结果依据什么成立、失败如何留下记录、版本变化如何回归，以及部署后如何观察和恢复。

这个实战最终形成的原则可以浓缩成一句话：

> 让模型理解意图、选择领域能力和组织语言；让确定性代码守住身份、权限、调用、证据和审计。

当这条边界足够清楚时，Agent 才不再是“会调用接口的聊天机器人”，而会成为一个可以测试、治理和持续演进的企业应用组件。
