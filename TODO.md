# TODO

本文件记录已识别但尚未落实的架构改进项，避免遗忘。

---

## 将运行时配置（Runtime Configuration）正式化为独立结构模式

**状态**：待办（提出于 2026-06-07，随 QUA-04 设计讨论提出）

**背景**：
当前 POMASA 对"配置"没有统一的运行时配置层：
- **STR-01** 把*知识类*配置（领域知识、方法论）拆分存放在 `references/` 下，遵循"单一职责、按用途分文件"。
- **BHV-06** 把*工具优先级*这类运行时开关**内联进每份 blueprint** 的 `## Tool Priorities` 小节，而非外部文件。
- 二者都不适合承载"项目级、全局、跨模式共享的运行时开关"（如观测等级、工具优先级）。

**QUA-04 的临时处置**：
QUA-04（Observable Execution Logging）引入了 `project/config.yml`（YAML，符合 STR-01 认可的配置格式），当前仅含 `observability` 一个键，并在文档中声明该文件"结构可扩展，未来其他模式的运行时配置可共用"。这是一个**先占位、不越权**的折中——由 QUA-04 引入文件，但不替其他模式做决定。

**待办内容**：
当后续出现 2~3 个模式都需要往 `config.yml` 写运行时配置时（最可能的下一个是把 BHV-06 的工具优先级迁移过来），应：
1. 新增一条结构模式（暂定 **STR-10 Runtime Configuration**），正式确立"项目级运行时配置层"的地位、`config.yml` 的 schema 约定与扩展规则。
2. 将 BHV-06 的工具优先级配置从 blueprint 内联迁移到 `config.yml`（保留 blueprint 只引用、不复述的纪律）。
3. 让 QUA-04 引用 STR-10，而非自行定义 `config.yml`。
4. 按 CLAUDE.md 约定同步四处：pattern-catalog/README.md 的 Pattern Overview 表、关系图、Version History、SKILL.md。

**触发条件**：出现第 2 个需要 `config.yml` 的模式时，即应启动本项。

---

## 新增"运行时状态管理与断点续传"模式

**状态**：待办（提出于 2026-06-07，随 QUA-04 设计讨论延伸提出）

**背景**：
POMASA 寄生在外部智能运行时（COR-02 Intelligent Runtime）之上，自身不拥有可编程的执行引擎。一旦遇到 API 中断 / API 限速 / 网络中断 / 宕机，当前没有任何机制让系统在恢复后"循着持久化的状态接着跑"——只能整轮重来。需要一个模式来定义：

- **进度状态的持久化**：哪些 stage 已被接受、当前推进到哪、各 Agent 实例的行为状态；
- **中断后的恢复推进**：恢复时如何读回状态、跳过已完成 stage、从断点继续。

这本质上是**横切关注点**，不应另立"运行时"分类，而应分别归入：
- 恢复推进逻辑（动态行为）→ **BHV**（暂定新模式，如 BHV-09 Resumable Execution）；
- 状态文件的目录布局/schema（静态结构）→ 复用或扩展 STR-10 Runtime Configuration / STR-02 Filesystem Data Bus。

**与 QUA-04 的咬合（关键）**：
QUA-04 的 `run.jsonl`（journal）是 append-only 事件日志，其中 `stage_verdict` 的 pass/fail 事件**恰好就是断点续传所需的最小进度状态**。而 QUA-04 已特意规定 **verdict 即使在 `observability: none` 下也照写**——这其实已为恢复模式预留了门。

**必须提前想清楚的张力**：
QUA-04 把 journal 定性为 "best-effort observability, **never a control plane**"。一旦恢复模式**依赖** journal 决定"从哪个 stage 续跑"，journal 就从观测升格为**控制平面**，与当前定性直接冲突。落地时须在两条路中择一：
- **(a)** 恢复用独立的、强保证的 state/checkpoint 文件，不复用 journal（干净，但有冗余）；
- **(b)** 把 `verdict` 这类事件从 best-effort 中正式剥离，声明为"必须写、可作为恢复依据"的一等状态——即把 QUA-04 已开的特例显式扶正（INFO/WARN 仍保持 best-effort）。
  倾向 (b)：verdict 本就是 BHV-02 质量门的产物，当作权威进度状态在语义上连贯。

**待办内容**：
1. 设计恢复模式（暂定 **BHV-09 Resumable Execution**）：定义状态的写入时机、读回时机、断点判定（以 verdict 为依据）、以及"恢复 ≠ 重跑已接受 stage"的纪律。
2. 决定 journal 定性取舍（上面的 (a)/(b)），并据此回头修订 QUA-04 中 "never a control plane" 的措辞与 verdict 的地位说明。
3. 与 STR-10（运行时配置层）协调状态文件的归属与目录布局。
4. 按 CLAUDE.md 约定同步四处：pattern-catalog/README.md 的 Pattern Overview 表、关系图、Version History、SKILL.md。

**触发条件**：当出现"长流程频繁因中断而整轮重跑"的实际痛点，或 STR-10 落地后即可一并规划。

---
