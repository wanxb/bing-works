# AI Agent 在 ToB SaaS 中的重构实践


传统 ToB SaaS 的交互模式是：**用户操作 UI → 调用 API → 显示结果**。用户需要在复杂的界面中找按钮、翻菜单、填表单。

AI Agent 给了一个新的可能：**用户告诉 Agent 想做什么 → Agent 操作 API → 返回结果**。界面从"操作工具"变成了"对话助手"。

这篇文章讲 ToB SaaS 产品怎么用 Agent 重构交互方式。

## 从"UI 操作"到"意图驱动"

传统 SaaS 产品的使用流程：

```
用户目标：查看上月华东区的销售报表

操作路径：
  1. 登录系统
  2. 点击"报表"菜单
  3. 选择"销售报表"子菜单
  4. 设置时间范围：上月
  5. 设置区域：华东
  6. 点击"生成报表"
  7. 等待页面刷新
  8. 查看数据
  —— 8 步操作，平均需要 2-3 分钟
```

Agent 后的使用流程：

```
用户目标：查看上月华东区的销售报表

Agent 交互：
  用户发消息："帮我看一下上个月华东区的销售情况"

  Agent 自动：
    1. 解析意图 → "查询销售报表"
    2. 提取参数 → {时间: 上月, 区域: 华东}
    3. 调用 API → GET /api/reports/sales?region=east&month=2
    4. 格式化数据为结构化回复

  Agent 回复：
    "华东区 1 月销售数据：
    总销售额：￥2,380,000（环比 +12%）
    订单数：1,250（环比 +8%）
    客单价：￥1,904（环比 +4%）
    
    亮点：A 类产品销售额增长显著（+28%）
    风险：B 类产品退货率上升（5.2%）"
```

用户从 8 步操作、3 分钟 → 1 句话、5 秒。这不是简单的"加了聊天功能"，而是**交互范式的转变**。

## 系统架构：Agent 层如何与 SaaS 后端匹配

```
传统 SaaS 架构：
  UI 组件 → BFF 层 → 微服务 → 数据层

Agent 化后的 SaaS 架构：
  对话界面 → Agent 编排层 → 适配层 → BFF/微服务 → 数据层
                 │
            ┌────┴────┐
            │ 安全管理  │
            │ 权限加固  │
            └─────────┘
```

适配层是 ToB SaaS Agent 架构的关键。SaaS 的 API 是为 UI 设计的，而不是为 Agent 设计的。

```
SaaS 原有的用户列表 API：
  GET /api/v2/users?page=1&size=20&sort=created_at
  返回：分页数据，含 20 个字段（id, name, email, phone, address, ...）

Agent 需要的工具：
  search_users(keyword, limit=5)
  返回：name, email, status 就够了
```

适配层负责压缩和精简：

```python
class SaaSAdapter:
    """把 SaaS API 适配为 Agent 可用工具"""
    
    @tool(
        name="search_users",
        description="搜索用户，支持按姓名、邮箱、手机号模糊查询",
        parameters={
            "keyword": {"type": "string"},
            "limit": {"type": "integer", "default": 5}
        }
    )
    async def search_users(self, keyword: str, limit: int = 5):
        # 调用 SaaS 原有 API
        result = await self.saas_api.get(
            "/api/v2/users",
            params={"search": keyword, "page": 1, "size": limit}
        )
        # 精简输出
        return [
            {
                "id": u["id"],
                "name": u["name"],
                "email": u["email"],
                "status": u["status"]
            }
            for u in result["items"]
        ]
```

适配层的三个职责：

1. **精简参数**——Agent 用 3 个参数就能做的事，API 可能暴露了 10 个
2. **合并调用链**——Agent 一个操作背后可能涉及多次 API 调用
3. **格式化结果**——API 返回的复杂结构转换为 Agent 容易理解的文本

## 配置即产品：让用户自定义 Agent

ToB SaaS 最有意思的地方不是 Agent 能做什么，而是**用户能自己配置 Agent 的行为**。

```
配置面板给用户（而非开发者）：
  ├─ 基础设置
  │   ├─ Agent 名称（对你的 AI 助手想叫什么名字）
  │   ├─ 语言偏好（中文/English）
  │   └─ 回复风格（简洁/详细/正式/友好）
  │
  ├─ 功能开关
  │   ├─ □ 允许 Agent 读取我的订单数据
  │   ├─ □ 允许 Agent 创建新订单（需要确认）
  │   ├─ □ 允许 Agent 查询客户信息
  │   └─ □ 允许 Agent 发送通知
  │
  ├─ 快捷指令
  │   ├─ "+ 添加快捷指令"
  │   │  名称：查库存
  │   │  命令：帮我查一下 {product} 的库存
  │   │  动作：调用 check_inventory(产品=product)
  │   └─ ...
  │
  └─ 数据范围
      ├─ 可见范围：仅显示我创建的数据 / 我所在团队的数据
      └─ 时间范围：最近 7 天 / 30 天 / 90 天
```

用户不需要理解"工具定义"、"Function Calling"、"Schema"——用户只需要打开开关、填写指令。适配层在后台把用户的配置转换为 Agent 的工具定义。

## 权限对齐

SaaS 的权限体系是给 UI 设计的——菜单权限、按钮权限、数据行权限。Agent 需要穿透这些权限层。

```
UI 权限模型：
  用户登录 → 角色 → 菜单可见性 → 按钮可用性

Agent 权限模型：
  用户登录 → 角色 → API 可用性 → 数据范围过滤
```

**Agent 不能跳过权限，必须继承权限。** 如果用户在 UI 上没有"删除订单"的按钮，Agent 也不能删除订单。

```python
class AgentPermissionMiddleware:
    """Agent 的权限控制中间件"""
    def __init__(self, user_id: str):
        self.user_permissions = self.load_permissions(user_id)
    
    def can_execute(self, tool_name: str) -> bool:
        """检查用户是否有权使用该工具"""
        return tool_name in self.user_permissions["allowed_tools"]
    
    def filter_data(self, data: list[dict], data_type: str) -> list[dict]:
        """过滤用户无权查看的数据"""
        data_filter = self.user_permissions["data_filters"].get(data_type)
        if not data_filter:
            return data
        return [d for d in data if self._matches_filter(d, data_filter)]
```

两个核心点：

1. **权限继承**——Agent 看到的 API 和数据取决于用户的权限。管理员登录比普通员工能看到更多
2. **行级数据过滤**——即使访问同一个 API，不同用户看到的数据范围不同

## 自助分析与智能工单

### 自助分析

传统 SaaS 的分析功能有预设的报表模板，用户只能在模板中选择维度和指标。Agent 可以做得更灵活：

```
用户问："对比一下今年每个季度的新客户数，按区域分组"

Agent 分析过程：
  1. 解析：时间 = 2026年，维度 = 季度 + 区域，指标 = 新客户数
  2. 查询数据仓库
  3. 生成对比表
  4. 用自然语言总结趋势
```

用户不需要学 BI 工具的操作，只需要说出想看的维度。

### 智能工单

Agent 可以自动处理标准化的工单流程：

```
用户说："帮我创建一个退款工单，订单号 ORD-2026-0311-0001，
        原因是客户收到了瑕疵品"

Agent 自动：
  1. 查询订单信息（确认订单存在且可退款）
  2. 校验退款政策（是否在退款期内）
  3. 读取历史沟通记录（是否有相关的售后记录）
  4. 创建工单，自动填写 80% 的字段
  5. 提交给相关团队

结果：工单创建时间从 5 分钟降到 10 秒
```

## 异常自愈

SaaS 系统运行中会出现各种异常（依赖的第三方服务超时、数据同步延迟、配置错误）。传统方式是需要运维人工排查。Agent 可以作为"运维助理"：

```
Agent 检测到异常信号：
  → "用户的订单同步延迟超过 5 分钟"
  → 检查：同步队列是否阻塞
  → 发现：第三方物流 API 超时
  → 尝试：切换备用物流通道
  → 成功：切换后队列恢复正常
  → 通知用户："系统曾出现短暂延迟，已自动恢复"
```

异常自愈是 Agent 高价值场景——它不需要人类介入就能解决常见问题，而这些问题通常发生在凌晨或节假日。

## ToB SaaS Agent 的陷阱

**陷阱 1：Agent 暴露了不该暴露的功能**

```
用户问："能把这个账号的密码改了吗？"
Agent 应该拒绝："改密码需要在系统设置的「安全中心」操作。"
而不是直接调用改密码 API。
```

Agent 看到的工具集需要有安全分级。低风险操作用自带工具、高风险操作转人工或跳转 UI。

**陷阱 2：过度承诺**

用户问 Agent "能不能做 x"，Agent 说"可以"但实际上做不到——这是因为 Agent 对自己的能力边界没有清晰认知。需要在 System Prompt 中用负面清单明确声明 Agent 不能做的事。

**陷阱 3：干扰原有 UI 用户**

不是所有用户都喜欢 Agent。有些老用户习惯了 UI 操作，Agent 弹出"我可以帮你"反而造成干扰。Agent 应该是可选的、不侵入的——用户主动打开对话面板时才启动。

## 实施路径

```
第 1 步：查询助手（1-2 个月）
  Agent 只能读不能写
  覆盖 20 个最常用的数据查询场景

第 2 步：简单操作（2-4 个月）
  Agent 可以执行创建工单、发送通知等低风险操作
  所有写操作需用户确认

第 3 步：复杂流程（4-6 个月）
  Agent 可以处理多步骤流程（退款审批、订单修改）
  引入 Multi-Agent 处理不同环节

第 4 步：智能推荐（6-12 个月）
  Agent 根据用户行为提前预测需求
  主动推送分析报告和异常预警
```

ToB SaaS 的 Agent 化不是推倒重来，而是**在现有系统的数据层和 API 层之上构建一个 Agent 适配层**。用户可以用原来的 UI，也可以用新的对话界面——两条路并行，用户自己选择。
