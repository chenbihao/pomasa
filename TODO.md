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
