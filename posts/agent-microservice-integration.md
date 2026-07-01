# AI Agent 与企业微服务的融合之道

> 写作日期：2025-12-10

前面说了 Agent 系统的各种设计模式。现在的问题来了：**这些 Agent 怎么和现有的企业微服务集成？**

这不是理论问题。如果你在 B 端公司工作，你面对的是一套已经跑了好几年、几十个微服务、几百个 API 的系统。不能推倒重来，但要让 AI Agent 能"理解"和"操作"这套系统。

这篇文章讲的是——**Agent 作为智能编排层，如何与存量微服务体系握手。**

## 核心矛盾

Agent 和微服务的本质差异：

```
微服务：
  ┌─ 确定性：同一个输入永远产生同一个输出
  ├─ 同步/异步：明确的调用模式
  ├─ 强类型：接口契约严格
  └─ 状态：应用层管理状态（分布式缓存/数据库）

AI Agent：
  ┌─ 概率性：同样的问题可能产生不同的工具调用
  ├─ 多轮交互：一个任务可能产生 N 次服务调用
  ├─ 弱类型：输出是自然语言或半结构化 JSON
  └─ 状态：在上下文窗口中管理状态
```

把概率性的 Agent 接入确定性的微服务，这就是最大的挑战。不能简单地"把 Agent 当成另一个微服务"。

## Agent Router vs API Gateway

传统微服务的入口是 API Gateway。Agent 接入后，Agent 的 Router 和原有 Gateway 怎么共存？

```
方案 A：Agent 直接调 Gateway（简单但不灵活）
  Agent → 调 Gateway → 转发到微服务
  问题：Agent 的输出不一定符合 Gateway 的输入格式
  问题：Agent 可能需要在多个服务间协调，Gateway 只管单一请求

方案 B：Agent Router 在 Gateway 之上（推荐）
  Agent Router → 适配层 → Gateway → 微服务
                    ↓
               Agent 直接读数据源（只读查询用直连）

方案 C：Agent Router 取代部分 Gateway 功能
  Agent Router 自带 Service Discovery + 负载均衡
  Agent 直接把工具映射到后端服务
```

方案 B 是现实中最常见的。Agent Router 不取代 Gateway，而是在它之上加一层适配。

```
用户消息
    │
    ▼
┌─────────────────────────┐
│    Agent Router          │
│  意图分析 → 任务分解     │
│                         │
│  ┌───────────────────┐  │
│  │  适配层            │  │
│  │  · 工具 → API 映射 │  │
│  │  · 参数转换         │  │
│  │  · 结果格式化       │  │
│  │  · 鉴权信息注入     │  │
│  └───────────────────┘  │
└──────────┬──────────────┘
           │
           ▼
   ┌───────────────┐
   │  API Gateway  │
   └───────┬───────┘
           │
     ┌─────┼─────┐
     ▼     ▼     ▼
   SvcA   SvcB  SvcC
```

适配层的核心工作是把 Agent 的"工具调用意图"转换为"微服务 API 调用"。

```python
# 适配层示例：把 Agent 工具调用翻译为微服务 API 调用
class AdapterLayer:
    def __init__(self, gateway_url: str, auth_token: str):
        self.gateway = ApiGatewayClient(gateway_url, auth_token)
    
    async def execute(self, tool_call: ToolCall) -> ToolResult:
        """执行 Agent 的工具调用，背后映射到微服务 API"""
        mapping = self.tool_to_api.get(tool_call.name)
        if not mapping:
            return ToolResult.error(f"未找到工具映射: {tool_call.name}")
        
        # 1. 参数映射和转换
        api_params = self.map_params(
            source=tool_call.params,
            mapping=mapping.param_map
        )
        
        # 2. 鉴权信息注入
        api_params["x-auth-context"] = self.auth_token
        
        # 3. 调用微服务 API
        response = await self.gateway.call(
            method=mapping.http_method,
            path=mapping.http_path,
            params=api_params
        )
        
        # 4. 结果格式化为 Agent 可读的格式
        return ToolResult.success(
            self.format_result(response, mapping.format_type)
        )
```

这个适配层解决了三个问题：
1. **参数隔离**——Agent 看到的字段名可以跟微服务 API 的字段名不同
2. **鉴权透明**——Agent 不需要关心怎么鉴权，适配层统一注入
3. **结果格式化**——微服务返回的复杂 JSON 被格式化为 Agent 容易理解的文本

## 身份与权限继承

Agent 调用微服务时，权限怎么处理？**Agent 应该使用用户的身份，而不是一个固定的"机器人账号"。**

```
❌ 坏的实践：Agent 使用统一的机器人账号
  Agent（机器人账号）→ 查数据 → 即使无关也能查到
  → 用户能看到本不属于 TA 的数据
  
✅ 好的实践：Agent 冒充用户身份
  Agent（用户 A 的上下文）→ 携带用户 A 的 token
  → 微服务按用户 A 的权限返回数据
  → 用户只能看到 TA 有权限的数据
```

身份传递的实现：

```python
class AgentIdentity:
    """Agent 调用时的身份上下文"""
    def __init__(self, user_id: str, roles: list[str], token: str):
        self.user_id = user_id
        self.roles = roles
        self.token = token

async def agent_handler(request: Request, user_input: str):
    # 从请求中获取用户身份
    identity = AgentIdentity(
        user_id=request.user.id,
        roles=request.user.roles,
        token=request.headers["authorization"]
    )
    
    # 把身份注入到 Agent 上下文
    agent = SmartAgent(identity=identity)
    response = await agent.chat(user_input)
    return response
```

这样做的好处：所有权限逻辑都在微服务层处理，Agent 不需要理解"这个角色能不能做这个操作"——它只需要在权限不足时，向用户解释为什么不能做。

## 服务的"声明"设计

在 Agent 接入微服务的过程中，最容易出现的问题是**工具定义和实际 API 脱节**——工具描述的"下单"接口和实际的下单接口参数不一样。

解决方案：让微服务**自声明**自己的 Agent 能力。

```yaml
# 在每个微服务中增加一个 agent-manifest.yaml
service: order-service
version: v2

agent_capabilities:
  - name: query_order
    description: "查询订单状态和详情"
    http:
      method: GET
      path: /api/v2/orders/{order_id}
    parameters:
      order_id:
        type: string
        description: "订单号（格式: ORD-xxxxxxxx）"
    authentication: user_token
    risk_level: low

  - name: create_order
    description: "创建新订单"
    http:
      method: POST
      path: /api/v2/orders
    parameters:
      items:
        type: array
        description: "商品列表，每项包含 product_id 和 quantity"
      shipping_address:
        type: string
        description: "收货地址"
    authentication: user_token
    risk_level: high
    confirmation_required: true  # Agent 调用前需要用户确认
```

Agent 启动时扫描所有微服务的 manifest，自动注册工具。新增或修改服务时，不需要改 Agent 代码——改 manifest 就行。

这本质上是把 MCP 的"工具注册"概念应用到微服务治理中。微服务声明 Agent 能力，Agent 自动发现和注册，两边的维护解耦。

## Agent 的事务补偿

Agent 调用多个微服务时，如果中间某个调用失败，需要做事务补偿。

```
Agent 的"事务"：
  1. 创建订单（成功）
  2. 扣减库存（成功）
  3. 发送确认邮件（失败）
  
  恢复：第 3 步失败 → 给用户报错，标记订单为"待确认"
  → 不自动回滚 1 和 2（订单已生成，库存已扣）
  → 把异常留给人工处理
```

Agent 不适合做"强事务"（ACID 级别），因为 Agent 的状态管理基于上下文，而不是数据库事务。但可以通过**可补偿操作**来做"最终一致性"的事务管理：

```python
class CompensationTracker:
    """Agent 调用微服务的补偿管理器"""
    def __init__(self):
        self.operations: list[Operation] = []
        self.compensations: list[Compensation] = []
    
    async def execute_with_compensation(self, tool_call, compensate_func):
        """执行一个可补偿的操作"""
        try:
            result = await tool_call.execute()
            self.operations.append(tool_call)
            self.compensations.append(compensate_func)
            return result
        except Exception as e:
            # 执行失败，回滚已成功的操作
            await self.rollback()
            raise e
    
    async def rollback(self):
        """按逆序执行补偿操作"""
        for comp in reversed(self.compensations):
            try:
                await comp()
            except Exception as e:
                # 补偿也失败了，记录到人工处理队列
                await self.manual_escalation(comp, e)
```

Agent 执行的事务补偿逻辑通常不是两阶段提交（2PC），而是**Saga 模式**——每步操作的补偿逻辑由业务代码定义。Agent 负责编排 Saga，不负责补偿的具体实现。

## 可观测性的打通

Agent 调用微服务后，链路追踪应该能贯穿两者。

```
传统微服务追踪：
  用户请求 → Gateway → SvcA → SvcB → 数据库
               ↑—— trace id: abc-123 ——↑

Agent 调用微服务追踪：
  用户消息 → Agent → 工具调用 → Gateway → SvcA → SvcB
               ↑—— trace id: xyz-789 ——↑
```

关键是把 Agent 的 trace id 传入微服务调用链：

```python
class AgentTraceMiddleware:
    def __init__(self, agent_session_id: str):
        self.trace_id = f"agent_{agent_session_id}"
    
    def inject_to_api_call(self, headers: dict):
        """把 Agent trace id 注入到微服务调用的 header"""
        headers["x-trace-id"] = self.trace_id
        headers["x-caller-type"] = "ai-agent"
        return headers
```

这样当用户在 Agent 中问"昨天的报表怎么还没出来"，如果 Agent 调用了报表服务，运维可以在 tracing 系统中看到完整的调用链路——从 Agent 到 Gateway 到具体哪个微服务。

## 灰度发布与熔断

Agent 调用微服务时，也要对 Agent 做灰度发布。

```
传统灰度：
  5% 的用户切到新版本 → 观察 → 切更多

Agent 灰度：
  5% 的 Agent 查询走新的工具定义 → 观察 → 扩大
```

熔断也类似——如果某个微服务不稳定，Agent 应该知道并切换策略：

```python
class CircuitBreakerForAgent:
    def __init__(self, service_name: str):
        self.failures = 0
        self.threshold = 5
        self.state = "closed"
    
    async def call(self, tool_func):
        if self.state == "open":
            # 熔断已打开，告诉 Agent 换个方式
            return ToolResult.error(
                f"service_{tool_func.service}_unavailable",
                "该服务暂时不可用，请稍后再试或换一种查询方式"
            )
        
        try:
            result = await tool_func()
            self.failures = 0
            return result
        except Exception:
            self.failures += 1
            if self.failures >= self.threshold:
                self.state = "open"
            return ToolResult.error("service_error", "服务调用失败")
```

与传统熔断不同的是：Agent 收到"服务不可用"的错误后，应该尝试用其他工具或方式达成相同目标，而不是简单报错。

## 实施的演进路线

```
阶段 1：旁路（1-2 个月）
  Agent 只读查询微服务的数据
  不改写后端一行代码
  → 验证 Agent 与微服务集成的可行性

阶段 2：轻度集成（2-3 个月）
  Agent 可以调用部分只读接口
  引入适配层，Agent Router 旁路在 Gateway 之外
  → 验证适配层的稳定性和性能

阶段 3：核心操作（3-6 个月）
  Agent 可以调用写操作接口（下单、审批、配置变更）
  高风险操作加用户确认
  引入对应的补偿回滚机制
  → 验证事务一致性和安全性

阶段 4：深度集成（6-12 个月）
  微服务侧增加 agent-manifest.yaml
  自动化的工具注册和发现
  Agent trace 与微服务 trace 打通
  → 从"Agent 调微服务"进化到"Agent 和微服务共生"
```

两个关键点：

1. **不要急着让 Agent 写数据**。先读后写，先低风险后高风险。Agent 在只读模式下运行一个月，积累足够的性能数据和 bad case，再考虑开放写操作。

2. **适配层是关键瓶颈**。适配层做得好，Agent 和微服务各司其职；做得不好，Agent 频繁超时、参数错误、鉴权失败。花足够的时间做适配层的压力测试和边界测试，这个投入值得。

## 总结

Agent 与企业微服务的融合，不是把 Agent 当成"新型微服务"，而是**在 Agent 和微服务之间建立一个可靠的适配层**。适配层负责：格式转换、鉴权传递、事务补偿、链路追踪、熔断降级。

技术本身已经有了——MCP 标准化工具，Agent Router 做路由，适配层做转换。真正的挑战在组织层面：**后端团队需要接受 Agent 的"不确定性"——Agent 调 API 的方式可能不符合"标准用法"，但它仍然需要第一线的支持。**

这才是 AI Agent 落地中最容易被低估的问题。
