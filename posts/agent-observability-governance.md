# 微服务架构下的 Agent 可观测性与治理


把 Agent 当微服务一样治理——这句话说起来简单，做起来难。

Agent 和传统微服务的本质差异在于：**微服务的输出是可预测的，Agent 的输出是概率性的。** 用传统 APM 的思路监控 Agent，只能看到"它有没有响应"，看不到"它有没有答对"。

这篇文章讲微服务架构下的 Agent 怎么监控、怎么治理。

## Agent 调用链追踪

传统微服务的追踪已经很成熟了：请求进来 → 经过几个服务 → 返回。每个环节的耗时、状态都能追踪。

Agent 的追踪要复杂得多：

```
用户请求 "帮我查一下订单 12345 的状态"
    │
    ▼
┌──────────────────────────────────────┐
│ Step 1: 意图识别                      │
│  耗时: 0.3s                          │
│  结果: { intent: "query_order" }     │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ Step 2: 工具选择                      │
│  耗时: 0.2s                          │
│  选择: search_order                  │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ Step 3: 调用微服务                    │
│  service: order-service              │
│  方法: GET /api/v2/orders/12345      │
│  耗时: 0.15s                         │
│  结果: { status: "shipped" }         │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ Step 4: 生成回复                      │
│  输入 tokens: 1520                   │
│  输出 tokens: 85                     │
│  耗时: 1.2s                          │
│  总延迟: 1.85s                       │
│  总成本: $0.003                      │
└──────────────────────────────────────┘
```

一个 Agent trace 需要记录：

```
Agent Trace（完整的一轮对话）:
    ├─ Turn 1（第一轮交互）
    │   ├─ LLM Call（模型调用）
    │   │   ├─ Request tokens
    │   │   ├─ Response tokens
    │   │   ├─ Tool calls（如果有）
    │   │   ├─ Latency
    │   │   └── Cost
    │   ├─ Tool Call 1（工具调用）
    │   │   ├─ Tool name
    │   │   ├─ Parameters
    │   │   ├─ Result (truncated)
    │   │   └── Latency
    │   └─ Tool Call 2（如果需要并行）
    ├─ Turn 2（如果需要多轮交互）
    ...
    └─ Final Response（最终回复）
```

Agent trace 与微服务 trace 打通的方法：

```python
class AgentTrace:
    def __init__(self, session_id: str, trace_id: str):
        self.session_id = session_id
        self.trace_id = trace_id  # 与微服务 trace 共享
        self.spans = []
    
    def start_turn(self, turn_type: str):
        span = Span(name=turn_type, trace_id=self.trace_id)
        self.spans.append(span)
        return span
    
    def inject_to_api_call(self, headers: dict):
        """把 trace ID 注入到微服务调用，实现跨系统追踪"""
        headers["x-trace-id"] = self.trace_id
        headers["x-span-id"] = self.spans[-1].id if self.spans else ""
```

这样在 Grafana 或 Datadog 中可以看到完整的调用路径：用户 → Agent → 具体微服务。

## 质量指标

Agent 专属的 SLI（Service Level Indicator）：

```
可用性指标：
  ├─ 工具调用成功率（LLM 正确识别并调用工具的比例）
  ├─ 参数提取准确率（LLM 从用户输入中提取的参数是否正确）
  └─ 多轮完成率（多轮交互中 Agent 是否成功完成目标）

质量指标：
  ├─ 忠实度（Faithfulness）
  ├─ 回答相关性（Relevance）
  ├─ 幻觉率（Hallucination Rate）
  └─ 用户满意度（CSAT / 点赞/踩）

效率指标：
  ├─ 平均处理时间
  ├─ 每请求 Token 用量
  ├─ 每请求成本
  └─ 平均工具调用次数

安全指标：
  ├─ 拒绝不当请求的准确率
  ├─ PII 意外输出次数
  └─ Prompt Injection 尝试次数
```

其中幻觉率是最重要的指标。每次 Agent 输出后的自动化评估：

```python
async def evaluate_for_hallucination(
    question: str,
    retrieved_context: list[str],
    response: str
) -> EvaluationResult:
    """用 LLM-as-Judge 评估输出是否基于上下文"""
    eval_prompt = f"""评估以下回答是否基于提供的上下文。

上下文：{retrieved_context}
回答：{response}

请检查：
1. 回答中的每个事实是否都能在上下文中找到支持？
2. 回答是否添加了上下文之外的信息？
3. 如果上下文不够，回答是否诚实地说明了？

输出 JSON：
{{"faithfulness": 0.9, "has_hallucination": false, "issues": []}}
"""
    result = await judge_llm.chat(eval_prompt)
    return EvaluationResult(judge_output=result)
```

自动化评估不能覆盖所有 case，但可以覆盖 70-80%。剩下的高风险的 case 设置人工抽检。

## 告警配置

Agent 的告警和传统告警不同——不能只配 5xx 错误率。

```
P0 告警（立即处理）：
  ├─ Agent 完全不可用（LLM 服务挂了，没有任何响应）
  ├─ 幻觉率 > 20%（模型正在大规模输出有害或错误内容）
  └─ 成本环比飙升 > 200%（代码 bug 导致无限循环）

P1 告警（当日处理）：
  ├─ 工具调用成功率 < 80%
  ├─ 用户满意度下降 > 10%
  └─ Agent 响应延迟 P99 > 15s

P2 告警（本周处理）：
  ├─ 特定类型的请求忠实度下降
  ├─ Agent 多轮交互平均轮数上升
  └─ 用户反馈量增加
```

关键告警——**响应延迟 P99**——需要在不同 Latency 级别做不同的处理：

```python
class LatencyAlertHandler:
    def analyze_latency(self, p99: float, traces: list[Trace]):
        """分析 P99 延迟的根因"""
        slow_traces = [t for t in traces if t.total_duration > p99 * 0.9]
        
        # 分析慢在哪里
        llm_calls = sum(t.llm_time for t in slow_traces) / len(slow_traces)
        tool_calls = sum(t.tool_time for t in slow_traces) / len(slow_traces)
        network = sum(t.network_time for t in slow_traces) / len(slow_traces)
        
        if llm_calls / total > 0.7:
            return "LLM_backend_slow"
        elif tool_calls / total > 0.5:
            return "downstream_service"
        elif network / total > 0.3:
            return "network_bottleneck"
        return "other"
```

## 灰度发布

Agent 的灰度发布和微服务灰度有相似之处，但有额外的复杂性：

```
微服务灰度：
  版本 A → 5% 流量 → 10% → 50% → 100%
  检查：错误率、延迟

Agent 灰度：
  版本 A（新 Prompt / 新工具定义 / 新模型）
  → 5% 用户 → 10% → 50% → 100%
  检查：错误率、延迟、忠诚度、幻觉率、用户反馈
```

Agent 灰度发布需要额外关注的几个点：

**行为一致性检查**：新旧版本在处理同一批测试集时，输出是否语义一致？如果新版 Agent 在 10% 的问题上改变了输出行为，可能是预期内的优化，也可能是非预期的退化。每次灰度前应该自动对比新旧版本在固定测试集上的输出差异。

**回滚机制**：Agent 回滚不只是回滚代码版本，还可能需要回滚 Prompt 版本。确保每次 Agent 的发布包包含完整的配置清单（代码版本 + Prompt 版本 + 模型配置），一键回滚到上一个组合。

**渐进式切换**：发布的顺序应该和风险等级匹配——先将新 Agent 用于只读查询，稳定后再开放到写操作。

```python
class AgentRollout:
    """Agent 灰度发布管理器"""
    def __init__(self, new_version_id: str):
        self.new_version = new_version_id
        self.phases = [
            {"percent": 5,  "duration_days": 1, "risk": "read_only"},
            {"percent": 20, "duration_days": 3, "risk": "read_only"},
            {"percent": 50, "duration_days": 7, "risk": "read_only"},
            {"percent": 100, "duration_days": 14, "risk": "read_only"},
            {"percent": 20, "duration_days": 3, "risk": "write", "confirm": True},
            {"percent": 50, "duration_days": 7, "risk": "write", "confirm": True},
            {"percent": 100, "duration_days": 0, "risk": "write"},
        ]
    
    async def promote(self):
        current_phase = self.get_current_phase()
        if not current_phase:
            return
        
        # 检查当前阶段的指标是否合格
        metrics = await self.get_phase_metrics(current_phase)
        if not self.pass_gate(metrics, current_phase):
            log.warning(f"灰度卡在阶段 {current_phase.percent}%")
            return
        
        # 进入下一阶段
        await self.move_to_next_phase()
```

灰度发布中最容易翻车的不是技术问题，而是**评审门禁设置不合理**——要么检查太严格导致灰度永远推不动，要么太宽松放过了有问题的版本。每个团队应该根据自己的业务容忍度调整门禁的宽松度。

## 成本治理

Agent 的成本和传统微服务不同。微服务的成本主要来自服务器，Agent 的成本主要来自 LLM API 调用。

```
Agent 成本结构：
  ┌─ LLM API：80-90%（通常按 token 计费）
  ├─ 基础设施：5-10%（GPU / 服务器）
  └─ 工具调用：5-10%（第三方 API 费用）
```

成本控制手段：

**按用户/按功能拆分成本**：

```python
class CostTracker:
    def __init__(self):
        self.costs = defaultdict(lambda: {"total": 0, "by_user": defaultdict(float)})
    
    def record(self, user_id: str, function: str, cost: float):
        self.costs[function]["total"] += cost
        self.costs[function]["by_user"][user_id] += cost
    
    def top_spenders(self, function: str, top_n: int = 10):
        """找出某个功能上的 Top N 高消耗用户"""
        users = self.costs[function]["by_user"]
        return sorted(users.items(), key=lambda x: x[1], reverse=True)[:top_n]
```

**Token 用量预警**：设置每个用户/每次对话的 Token 用量上限。如果单次对话超过上限（比如 100K tokens），触发告警检查是否进入了无限循环。

**模型分级调用**：低成本模型能满足的请求用低成本模型，只有关键推理才用高端模型。这在前面的文章里已经详细说过了。

**定期成本审计**：每周检查成本趋势，看是否有异常增长。常见的异常原因包括：Agent 进入无限循环（重复调用工具）、用户刷 API（恶意大量请求）、Prompt 设计变化导致 token 用量增加。

## 总结

把 Agent 当微服务治理的核心理念：

1. **Trace 是基础**——没有和微服务 trace 打通的 agent trace 是不完整的
2. **质量指标比可用性指标重要**——工具调用的正确率比 API 的错误率更值得关注
3. **灰度发布是多维度的**——不只是流量比例，还包括操作权限的渐进式开放
4. **成本是工程问题**——Agent 的成本结构不同，需要新的监控和管理手段

Agent 的治理还在快速演进中，但这些基本原则——可观测、可灰度、可回滚、可审计——和微服务治理是一致的。只不过在 Agent 场景下，它们需要适配 Agent 的概率性本质。
