# IssuePilot 实战：多 Agent Workflow 协作的 GitHub Issue 自动化开发流水线

> 写作日期：2026-06-26

弼马温应用是一个单 Agent 系统——一个 LLM 完成所有的理解和执行。IssuePilot 完全不同：它不是"把一个 Agent 做大"，而是**设计了一套多 Agent Workflow，让多个专业 Agent 接力完成从 Issue 发现到 PR 提交的完整流水线**。

这篇文章从 Workflow 编排的视角展开——不是逐个介绍 Agent，而是展示这 5 个 Agent 如何在一套 Workflow 的调度下协作。

## Workflow 总体拓扑

IssuePilot 的 Workflow 不是线性的——它有并发、有条件分支、有循环、有反馈回路：

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        IssuePilot Workflow 总图                          │
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  爬虫    │───→│ Agent A  │───→│  PENDING_    │───→│  Agent B     │  │
│  │  Crawler │    │Evaluator │    │  DECISION    │    │  Developer   │  │
│  │ (定时触发)│    │(单次判断) │    │ (人工门)     │    │ (ReAct 循环) │  │
│  └──────────┘    └──────────┘    └──────┬───────┘    └──────┬───────┘  │
│                                          │                    │         │
│                                     ┌────┴────┐         ┌────┴────┐    │
│                                     │ IGNORED │         │ FAILED  │    │
│                                     │ ARCHIVED│         │ (重试)  │    │
│                                     └─────────┘         └─────────┘    │
│                                                              │         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐           │         │
│  │ Agent D  │───→│ Agent C  │←───│  3 轮循环    │←──────────┘         │
│  │Onboarder │    │ Reviewer │    │ (B→C→B→C→B) │                     │
│  │ (仓库画像)│    │(代码审查) │    └──────────────┘                     │
│  └──────────┘    └────┬─────┘                                          │
│                        │                                               │
│                   ┌────▼────┐    ┌──────────┐                         │
│                   │ PR_SUB- │───→│ GitHub   │                         │
│                   │ MITTED  │    │ Webhook  │                         │
│                   └─────────┘    └────┬─────┘                         │
│                                        │                              │
│                                   ┌────▼────┐    ┌────────────────┐  │
│                                   │ MERGED  │    │ PR_CLOSED      │  │
│                                   │ (成功)   │    │ (失败→分析原因) │  │
│                                   └─────────┘    └───────┬────────┘  │
│                                                            │         │
│                                                     ┌──────▼──────┐ │
│                                                     │ 分类器       │ │
│                                                     │ (反馈回路)   │ │
│                                                     └──────┬──────┘ │
│                                                            │         │
│                              ┌─────────────────────────────┘         │
│                              ▼                                       │
│                        反馈到 Agent A 评分维度/Agent B prompt        │
└──────────────────────────────────────────────────────────────────────┘
```

关键特征：

- **三条主要路径**：评估路径（A）、开发路径（B→C）、反馈路径（Close→分类器→A/B）
- **一个人工门**：PENDING_DECISION 是系统自动化和人工决策的交界
- **两个循环**：B→C Review 循环（最多 3 轮）、PR Closed → Agent 改进循环（持续）
- **一个并行分支**：Agent D（仓库画像）在后台独立运行，不阻塞主流程

## 阶段一：Issue 发现与评估 Workflow

Workflow 的入口有两条路径——定时爬取和手动输入。这个阶段包含以下子 Workflow：

```
发现与评估 Workflow：

           ┌── 定时爬取（APScheduler）
           │    ├─ GitHub Trending
           │    ├─ 配置的 repo 列表
           │    └─ GitHub Search API
 输入 ─────┤
           └── 手动输入（REST API）
                └─ 用户粘贴 repo URL / Issue URL
                        │
                        ▼
                ┌────────────────┐
                │ 去重检查        │
                │ (DB upsert)    │
                └────────┬───────┘
                         │
                         ▼
                ┌────────────────┐
                │ 新仓库检查      │
                │ 是 → 入队      │
                │ Agent D 并行   │
                └────────┬───────┘
                         │
                         ▼
                ┌────────────────────┐
                │ 入队 analyze_queue │
                │ (Celery 异步)      │
                └────────┬───────────┘
                         │
                         ▼
               ┌──────────────────────┐
               │ Agent A 评估         │
               │ 5 维度 × 20 分 = 100 │
               │                     │
               │ 分值 ≥ 65?          │
               │  ↓          ↓       │
               │ 是          否      │
               └────┬────────────────┘
                    │                │
                    ▼                ▼
          ┌──────────────┐    ┌──────────┐
          │ PENDING_     │    │ IGNORED  │
          │ DECISION     │    │ (归档)   │
          │ (等待人类选择)│    └──────────┘
          └──────────────┘
```

**为什么 Agent A 用 Single-Shot 而不是 ReAct？** 这是 Workflow 设计中一个重要的决策点——评估是一个**纯判断**，不需要环境交互。把它做成 Single-Shot 意味着这个步骤的耗时和成本是确定的（约 0.05 美元 / 2-3 秒），不会因为 LLM 多轮思考而无限膨胀。

**Agent D（Onboarder）的工作流是并行的：**

```
Agent D Workflow（后台异步）：
  ┌────────────────────────────────┐
  │ 触发：发现新仓库                │
  │                                │
  │ ① 读取仓库 README              │
  │ ② 读取 CONTRIBUTING.md        │
  │ ③ 分析 PR 历史模式             │
  │ ④ 生成仓库画像                 │
  │    ├─ 技术栈                   │
  │    ├─ 代码规范                 │
  │    ├─ 测试要求                 │
  │    └─ 常见 PR 问题             │
  │ ⑤ 缓存（90 天有效）            │
  │                                │
  │ → 后续 Agent B/C 使用仓库画像   │
  └────────────────────────────────┘
```

Agent D 的存在意义：不被主 Workflow 阻塞，提前准备好 Agent B 和 C 需要的上下文。这是一种**预取优化**。

## 阶段二：人工决策 Gate

PENDING_DECISION 状态是 IssuePilot Workflow 中唯一的人工介入点。这是设计上刻意保留的**闸门**——自动化做评估，人类做选择。

```
人工决策 Gate：

          ┌──────────────────────┐
          │ PENDING_DECISION     │
          │                      │
          │ Agent 已评估完毕     │
          │ 等待人类确认         │
          └──────────────────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
   ┌──────────────┐    ┌──────────────┐
   │ 人类点"开始开发"│    │ 人类点"忽略"  │
   │              │    │              │
   │ 状态 →       │    │ 状态 →       │
   │ QUEUED_DEV   │    │ ARCHIVED     │
   └──────┬───────┘    └──────────────┘
          │
          ▼
   ┌──────────────────┐
   │ 入队 dev_queue   │
   │ (Celery 异步)    │
   └──────────────────┘
```

这个 Gate 的设计哲学：**Agent 可以做 90% 的工作，但那 10% 的关键决策必须给人类。** 原因：

1. Agent 的评分可能出错（幻觉、对项目方向判断不准确）
2. 有些 Issue 虽然评分高但开发者不想做（技术债务考虑）
3. 法律/安全/商业上的决策不应该由 Agent 做

## 阶段三：开发与审查循环 Workflow

这是 IssuePilot 最核心的 Workflow——一个**带审查反馈的迭代循环**：

```
开发→审查→合并 Workflow：

          ┌──────────────┐
          │ QUEUED_DEV   │
          │ (等待 Worker) │
          └──────┬───────┘
                 ▼
          ┌──────────────┐
          │ IN_DEV       │
          │ (Agent B)    │
          └──────┬───────┘
                 ▼
          ┌──────────────┐
          │ 开发流程图：   │
          │               │
          │ ① ANALYZE    │
          │ ② PLAN       │
          │ ③ IMPLEMENT  │
          │ ④ TEST       │
          │ ⑤ COMMIT     │
          │               │
          │ 成功?         │
          │  ↓       ↓   │
          │ 是       否  │
          └────┬─────────┘
               │         │
               ▼         ▼
          ┌────────┐ ┌────────┐
          │IN_REVIEW│ │DEV_   │
          │(Agent C)│ │FAILED │
          └───┬────┘ │(重试) │
              │      └────────┘
              │          │
              ▼          │
        ┌──────────┐     │
        │ 审查通过?  │────┘ (回到 IN_DEV，重试计数 +1)
        │  ↓    ↓  │     最多重试 2 次
        │ 是    否 │
        └──┬───────┘
           │      │
           ▼      └──→ IN_DEV (重试 + 审查反馈)
        ┌──────────┐   最多 3 轮 (B→C→B→C→B)
        │PR_SUBMITTED│
        │(GitHub API)│
        └────────────┘
```

这个循环 Workflow 有两条重试路径：

```
重试路径 1：DEV_FAILED → QUEUED_DEV（最多 2 次）
  触发条件：Agent B 开发超时 / 出错 / 卡死
  重试行为：从头开始，换一个 LLM Provider（fallback）
  重试计数存储在 Issue 记录的 retry_count 字段

重试路径 2：IN_REVIEW → IN_DEV（最多 3 轮）
  触发条件：Agent C 审查不通过
  重试行为：Agent C 的审查反馈传给 Agent B，带反馈重新开发
  每次重试 Agent B 的 prompt 会增加一段：
    "前一次审查不通过，反馈如下：[Agent C 的意见]
    请在本次开发中解决这些问题。"
```

**为什么审查不通过要回到开发而不是直接修？**

因为 Agent C 的审查意见是文本描述，不是具体代码修改。Agent B 需要重新理解 Issue + 审查意见 + 已有代码，生成新方案。让 Agent B 带着"前一次的反馈"重试，比让 Agent C "自动修"效果更好——Agent C 是判官，不是作者。

## 阶段四：PR 生命周期追踪 Workflow

PR 提交后，Workflow 从 IssuePilot 内部延伸到了 GitHub 外部：

```
PR 生命周期 Workflow：

          ┌──────────────┐
          │ PR_SUBMITTED │
          │ (GitHub API)  │
          └──────┬───────┘
                 ▼
          ┌─────────────────────┐
          │ GitHub Webhook 监听 │
          │                     │
          │ 事件类型：            │
          │ ├─ pull_request.    │
          │ │  closed           │
          │ ├─ pull_request_re- │
          │ │  view.submitted   │
          │ └─ pull_request.    │
          │    reopened         │
          └─────────┬───────────┘
                    │
          ┌─────────┴──────────┐
          │                    │
          ▼                    ▼
   ┌──────────────┐    ┌──────────────┐
   │ PR_MERGED    │    │ PR_CLOSED    │
   │ (成功：结束)  │    │ (失败：分析)  │
   └──────────────┘    └──────┬───────┘
                              │
                              ▼
                     ┌────────────────────┐
                     │ RejectionClassifier │
                     │ (Haiku, 单次判断)   │
                     │                    │
                     │ 分析关闭原因：       │
                     │ ├─ 代码质量问题      │
                     │ ├─ 不符合项目方向    │
                     │ ├─ 测试没覆盖        │
                     │ ├─ 重复 PR          │
                     │ └─ 其他             │
                     └─────────┬──────────┘
                               │
                               ▼
                     ┌────────────────────┐
                     │ 写入 rejection_    │
                     │ reasons 表         │
                     │ (结构化存储)        │
                     └─────────┬──────────┘
                               │
                               ▼
                     ┌────────────────────┐
                     │ 学习反馈循环        │
                     │ (定时触发)          │
                     │                    │
                     │ 每周聚合失败模式     │
                     │ → 更新 Agent A      │
                     │   评分维度权重       │
                     │ → 更新 Agent B      │
                     │   prompt 约束       │
                     └────────────────────┘
```

**关键设计：Webhook 的 HMAC 验证**

PR 生命周期涉及外部事件，安全验证必不可少：

```python
class GitHubWebhookWorkflow:
    async def validate_webhook(self, payload: bytes, signature: str) -> bool:
        """HMAC-SHA256 验签，确认请求确实来自 GitHub"""
        secret = self.settings.GITHUB_WEBHOOK_SECRET
        expected = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)
```

验证通不过的直接 401 拒绝，不进入任何 Workflow 步骤。

## Workflow 编排 vs 编制

IssuePilot 的 Workflow 设计兼用了**编制（Orchestration）和编排（Choreography）**两种模式：

```
┌────────────────────────────────────────────┐
│  编制（中央控制）                            │
│                                            │
│  Celery Worker 是中央调度器                  │
│  ├─ 状态机由 Issue 表的 status 字段驱动      │
│  ├─ 每一步由 Worker 消费队列触发             │
│  ├─ 重试逻辑由 Worker 管理                  │
│  └─ 中间状态持久化到 PostgreSQL              │
│                                            │
│  适合：核心流程（评估→开发→审查→提交）       │
│  原因：需要审计、需要确定性、需要状态恢复     │
├────────────────────────────────────────────┤
│  编排（事件驱动）                            │
│                                            │
│  Webhook + Redis PubSub                    │
│  ├─ 非核心流程用事件触发                     │
│  ├─ GitHub PR close 事件 → 分析流程启动     │
│  ├─ 学习反馈循环是定时事件，不阻塞主流程      │
│  └─ Agent D 的仓库画像也是独立事件驱动       │
│                                            │
│  适合：外围流程（反馈、学习、画像）           │
│  原因：不干扰主流程、可独立扩缩、松耦合       │
└────────────────────────────────────────────┘
```

分界的依据：**核心价值流程用编制确保确定性，增值流程用编排保持灵活性。**

## 状态机作为 Workflow 的"骨架"

IssuePilot 的 14 个状态构成了 Workflow 的骨架。每个状态转换都是一个 Workflow 步骤：

```
                      DISCOVERED
                          │
                          ▼
                     ANALYZING ←─── Agent A 开始
                          │
                     ┌────┴────┐
                     ▼         ▼
           PENDING_DECISION  IGNORED/ARCHIVED
                     │
                     ▼
                QUEUED_DEV ←─── 人工确认或重试
                     │
                     ▼
                   IN_DEV ←─── Agent B 开始
                     │
                     ▼
                DEV_TESTING
                     │
              ┌──────┴──────┐
              ▼              ▼
         QUEUED_REVIEW    DEV_FAILED → QUEUED_DEV (retry)
              │
              ▼
            IN_REVIEW ←─── Agent C 开始
              │
         ┌────┴────┐
         ▼         ▼
   PR_SUBMITTED  QUEUED_DEV (retry with review feedback)
         │
         ▼
   PR_MERGED / PR_CLOSED
```

**状态机的不可逆规则：**

```
每个状态变化记录：
  {issue_id, from_status, to_status, triggered_by, timestamp, metadata}

如果某个转换出错：
  状态不回滚到上一个状态
  而是进入 "FAILED_状态名" 的特殊状态
  比如 DEV_FAILED，然后人工或重试决定下一步
```

这种设计避免了"状态回滚"的复杂度，同时保留了完整的审计轨迹。

## Docker Sandbox 作为 Workflow 的执行环境

Agent B 的开发 Workflow 运行在 Docker 沙箱中，这是整个 Workflow 中最"重"的步骤：

```
Sandbox Workflow 生命周期：

          ┌────────────────────────────────┐
          │ start_dev_workflow(issue_id)   │
          │                                │
          │ ① 检测仓库语言                 │
          │ ② 选择对应 Docker 镜像         │
          │    (python/node/go/rust/java)  │
          │ ③ Fork 仓库（如果无已存在 fork）│
          │ ④ Clone 到 sandbox 目录       │
          │ ⑤ 启动 Claude Code CLI        │
          │    claude -p "..." --max-turns 25│
          │ ⑥ 流式输出 → Redis PubSub      │
          │    → WebSocket → 前端          │
          │ ⑦ Claude Code 完成 →           │
          │   收集 git diff → 清理容器     │
          │ ⑧ 提交结果到 DB                │
          │    (状态: DEV_COMPLETE / FAILED)│
          └────────────────────────────────┘
```

Sandbox 的执行是**有状态的长运行 Workflow**（4-7 分钟），用 Celery 的异步 Worker 管理。

**卡死检测子 Workflow：**

```python
async def stuck_detection_workflow(tool_history: list[str]) -> str:
    """卡死检测子 Workflow，在 Sandbox Workflow 中并行运行"""
    while workflow_is_running:
        await asyncio.sleep(10)
        recent = tool_history[-12:]
        read_only = {"Read", "Glob", "Grep", "WebSearch"}

        if len(recent) >= 12 and all(t in read_only for t in recent):
            # 连续 12 次只读，判定卡死
            await terminate_workflow("stuck")
            return "STUCK"

    return "NORMAL"
```

## Workflow 的可观测性

每个 Workflow 步骤都产生 trace 数据。关键观测点：

```
Workflow 级别的指标：
  ├─ 各阶段的平均耗时
  ├─ 各阶段的重试率
  ├─ 各阶段的失败率
  ├─ 人工 Gate 的通过率
  └─ 从 DISCOVERED 到 PR_MERGED 的端到端时间

Agent 级别的指标：
  ├─ Agent A 评分与人工决策的一致性
  ├─ Agent B 开发成功率
  ├─ Agent B 平均开发耗时
  ├─ Agent C 审查准确率（与最终 PR 结果对比）
  └─ Agent D 画像的覆盖率

循环级别的指标：
  ├─ B→C 审查循环的平均轮数
  ├─ DEV_FAILED→QUEUED_DEV 的重试次数
  └─ PR Closed 后的分类准确率
```

有了这些指标，就可以精确定位 Workflow 中的瓶颈——如果 Agent B 的平均开发耗时突然从 3 分钟涨到 7 分钟，就知道应该检查最近是否切换了模型或 prompt 变更。

## 一些数字

- Workflow 阶段：4 个（发现、评估、开发、反馈）
- 状态节点：14 个
- 转换路径：约 20 条
- Agent 类型：4 个 + 1 个分类器
- 重试路径：2 条（开发重试、审查重试）
- 人工介入点：1 个（PENDING_DECISION）
- 外部集成点：2 个（GitHub API、GitHub Webhook）
- 端到端耗时：5-15 分钟（视 Issue 复杂度）

## 总结

IssuePilot 教会我的不是"怎么调 LLM 做开发"，而是**"怎么把多个 Agent 编排成一个可靠的生产 Workflow"**。

几个关键经验：

1. **状态机是 Workflow 的骨架**——14 个状态定义清晰，状态变化可追溯，出错时不会丢失上下文
2. **编制 + 编排 混合使用**——核心流程用中央调度保证确定性，外围流程用事件驱动保持灵活性
3. **重试不是失败**——DEV_FAILED 和 REVIEW_REJECTED 是预期的 Workflow 路径，不是 Bug
4. **一个人工 Gate 就够了**——在关键决策点设一个人工门，其余全部自动化，这是成本和可靠性的最佳平衡
5. **可观测性是 Workflow 的生命线**——没有 trace 的多 Agent 系统，出问题时根本无法定位

IssuePilot 的源码在 [github.com/wangxunbing/issuepilot](https://github.com/wangxunbing/issuepilot)，整个项目的文档比代码还多——每个 Workflow 设计决策都有对应的 ADR 和 dry run 报告。
