# 企业系统接入 AI Agent 的架构演进路径


把 AI Agent 接入企业系统，最常见的问题不是"技术做不到"，而是**一上来就搞大了**。

最常见的失败模式：

```
模式：大爆炸改造
  "我们决定用 Agent 重构整个客服系统"
  → 开发 6 个月，投入 5 个后端 2 个 AI 工程师
  → 第 4 个月发现 Agent 在某些场景下不如规则系统
  → 第 6 个月勉强上线，但效果不达预期
  → 后续："AI Agent 不成熟"
```

问题在方法不在技术。这篇文章讲一种更务实的路径——**渐进式演进**：从旁路开始，边走边验证，不搞大爆炸。

## 渐进式接入的三个阶段

```
阶段一：旁路 Agent（Sidecar）
  Agent 作为独立系统，不侵入核心业务
  验证 Agent 能否处理真实场景

阶段二：嵌入 Agent（Embedded）
  Agent 注入核心业务流程
  部分自动决策，人类兜底

阶段三：协同 Agent（Collaborative）
  Agent 与系统深度集成
  Multi-Agent 协作，人类只做关键决策
```

### 阶段一：旁路 Agent（Sidecar）

旁路 Agent 是最安全的接入方式。Agent 不直接操作核心系统，而是作为"副驾驶"存在。

```
核心业务系统                     旁路 Agent
┌────────────────┐              ┌──────────────────┐
│ 客服人员处理工单  │              │ Agent 实时分析工单  │
│                │     ←同个→     │ 推荐回复、标记风险  │
│ 人工决策流程    │     数据源     │ 但不出现在执行路径  │
└────────────────┘              └──────────────────┘
```

**典型场景：客服辅助**

```
旁路 Agent（工单处理）：
  - 读取工单内容
  - 搜索知识库找出相关解决方案
  - 推荐给客服人员
  - 客服决定是否采纳
  - Agent 不自动回复，只建议
  
衡量指标：
  采纳率：客服采用了 Agent 的建议的比例
  处理时间：使用 Agent 后，平均处理时间变化
```

**旁路模式的价值**：
- 零风险——Agent 不参与执行路径
- 收集真实数据——Agent 的建议在真实场景中表现如何
- 建立信任——团队先相信 Agent 的判断，再开放执行权限

旁路时间不要太短。建议至少跑 1-2 个月，收集足够多的数据判断 Agent 的准确率和覆盖率。

### 阶段二：嵌入 Agent（Embedded）

当 Agent 的准确率在旁路阶段得到验证后（通常建议采纳率 > 80%），可以开始嵌入核心流程。

Agent 进入执行路径，但人类兜底。

```
核心业务系统
┌────────────────┐
│ 用户请求        │
│    ↓            │
│ Agent 自动处理   │
│    ↓            │
│ 如果置信度 < 90% │  → 转人工
│ 如果置信度 ≥ 90% │  → 自动执行
│    ↓            │
│ 人工审核日志     │
└────────────────┘
```

**关键设计：置信度阈值**

```python
class ConfidenceGate:
    """置信度门控——Agent 在满足条件时自动执行，否则转人工"""
    def __init__(self, threshold: float = 0.9):
        self.threshold = threshold
    
    async def process(self, request: Request, agent: Agent) -> Response:
        response = await agent.process(request)
        
        if response.confidence >= self.threshold:
            # 高置信度：自动执行
            result = await self.execute(request, response)
            return AutoResult(result, auto_executed=True)
        else:
            # 低置信度：排队转人工
            ticket = await self.create_ticket(request, response)
            return PendingResult(ticket.id, "已转人工处理")
```

置信度阈值可以动态调整：

```python
class DynamicThreshold:
    def __init__(self):
        self.history = []
        self.initial_threshold = 0.9
    
    def adjust(self, weekly_stats: dict) -> float:
        """根据每周的统计动态调整阈值"""
        # 如果自动处理的准确率 > 95%，说明阈值可能太保守
        if weekly_stats["auto_accuracy"] > 0.95:
            return self.current * 0.95  # 适当放宽
        
        # 如果转人工的比例太高，说明阈值太严
        if weekly_stats["human_ratio"] > 0.4:
            return self.current * 1.05  # 收紧阈值
        
        return self.current
```

这个设计的好处：**阈值是系统级的控制旋钮，不用修改 Agent 的逻辑。** 想保守就调高阈值（更多转人工），想激进就调低。

### 阶段三：协同 Agent（Collaborative）

当嵌入 Agent 在大部分场景下稳定后，进入协同阶段。这个阶段的特点：

1. **Multi-Agent**：不同场景用不同的专业 Agent
2. **人类只在关键节点介入**：异常处理、策略变更、高风险操作
3. **Agent 之间有标准的通信协议**：MCP + A2A

```
多 Agent 协助客服系统
                          ┌─────────────────┐
                          │ 工单分类 Agent    │
                          │ 意图分析、优先级   │
                          └────────┬────────┘
                                   │
用户请求 → ┌──────────────────┐    │
           │ 对话 Agent        │    │ → 如果超 7 天 → 升级 Agent
           │ 标准回复、FAQ      │    │ → 如果重复投诉 → 关注 Agent
           └──────────────────┘    │
                                   │
                          ┌─────────────────┐
                          │ 数据分析 Agent  │
                          │ 趋势、异常检测     │
                          └─────────────────┘
```

**协同阶段的 Agent 治理**：

每个 Agent 都有自己的：
- 明确的职责边界（什么能做、什么不能做）
- 工具白名单
- 质量指标和监控
- 人工回滚机制

Agent 之间不直接通信，通过**事件总线**交换信息。这样可以独立升级 Agent，不影响其他 Agent。

## 成本与收益评估

渐进式的每一步，都需要评估成本与收益，决定是否进入下一步。

| 阶段 | 成本 | 收益 | 风险 |
|------|------|------|------|
| 旁路 | 低（1 个 AI 工程师 + 1 台机器） | 中（效率提升 10-20%） | 极低 |
| 嵌入 | 中（3-5 人团队 + 基础设施） | 高（效率提升 30-50%） | 中 |
| 协同 | 高（10+ 人团队 + 专用 infra） | 极高（效率提升 50%+） | 中高 |

**旁路做多久可以进嵌入？**

决策指标：

```
✅ 可以进嵌入的信号：
  - Agent 建议采纳率 > 80%
  - Agent 回复的客户满意度 >= 人工回复
  - 用户反馈 Agent 有帮助的比例 > 70%
  - Agent 处理相同工单的时间为人工的 50% 以下

❌ 停留在旁路的信号：
  - 采纳率 < 60%
  - Agent 产生了较多幻觉（被人工修正比例高）
  - 用户抱怨"回复太机械"
```

## 企业接入 Agent 的常见陷阱

**陷阱 1：选错了切入点**

```
❌ 选：核心交易系统（高价值、高复杂度）
    "让 Agent 处理退款审批"
    → 失败原因：容错率为零，Agent 一次出错就失去信任

✅ 选：辅助任务（低风险、高重复）
    "让 Agent 帮查订单状态"
    → 成功原因：容错空间大，效果可量化
```

正确的切入点选择：**高重复、低风险、信息密集**的任务。典型的"低垂果实"。

**陷阱 2：忽略了数据质量**

Agent 的回复质量高度依赖于它看到的数据。企业数据常见问题：

```
- CRM 数据过时（客户电话已经换了）
- 产品目录不完整（存量系统的 SKU 信息缺字段）
- 知识库文档几个月没更新（流程变了文档没变）
- 权限配置混乱（A 能看到的 B 看不到）
```

用一句话说：**Agent 不是来修复数据质量的，Agent 是来暴露数据质量问题的。** 接入 Agent 后，如果经常给出不准确的回复，可能是因为数据层已经很久没有维护了。

**陷阱 3：没有失败预案**

```
问题：Agent 忽然开始乱说话（因为 LLM 更新了）
应对：立即回滚到旁路模式 + 切换到备用模型
预案：每个 Agent 都应该有「降级策略」
```

降级策略示例：

```python
class DegradationStrategy:
    def __init__(self, agent, fallback_mode: str):
        self.modes = {
            "full": agent,              # 完全体 Agent
            "suggest_only": SuggestOnlyAgent(agent),  # 只建议不执行
            "rule_based": RuleEngine(),  # 回退到规则引擎
            "human_only": TicketSystem(), # 全部转人工
        }
        self.current_mode = "full"
    
    async def degrade(self, reason: str):
        """按优先级逐级降级"""
        order = ["suggest_only", "rule_based", "human_only"]
        for mode in order:
            if mode in self.modes:
                self.current_mode = mode
                log.warning(f"降级到 {mode}，原因: {reason}")
                break
```

## 总结

企业接入 AI Agent 的核心原则：**先在旁路证明自己，再嵌入到流程中。**

不要急着让 Agent 做决策，先让它做建议。建议做得好，信任积累够了，再逐步放开到自动决策。如果建议做得不好，你在旁路阶段就发现了问题，不会影响到核心业务。

流程上是三步走：旁路 → 嵌入 → 协同。每一步之间都要有数据和指标证明它值得进入下一步。保守不是慢，而是快的最短路径。
