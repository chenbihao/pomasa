# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这是什么项目

POMASA（Pattern-Oriented Multi-Agent System Architecture，模式导向的多智能体系统架构）是一个**模式语言 + 生成器**项目，而不是传统的软件代码库。

- 这里没有需要编译、构建、运行测试或 lint 的源代码。"产物"就是文档本身——一套可安装为 Agent Skill 的模式目录（pattern catalog）和生成器提示词。
- 项目的核心价值是：**让 AI 依据模式快速构建出新的声明式多智能体系统（Declarative MAS）**。
- 文档主要以中英双语维护（如 `README.md` / `README.zh-cn.md`）。修改面向用户的文档时，注意保持双语同步。

## 仓库结构（关键部分）

```
skills/pomasa/                 # 可安装的 POMASA Skill（核心交付物）
├── SKILL.md                   # 生成器：指导 AI 如何依据模式生成新 MAS 系统的主提示词
├── user_input_template.md     # 用户填写的项目需求模板（生成系统的输入）
└── pattern-catalog/           # 模式目录（本项目的"知识本体"）
    ├── README.md              # 模式总览、分类、编号规则、关系图——改模式前必读
    ├── COR-*.md               # Core 核心模式
    ├── STR-*.md               # Structure 结构模式
    ├── BHV-*.md               # Behavior 行为模式
    └── QUA-*.md               # Quality 质量模式
references/                    # 背景阅读材料、发表论文、文档模板（latex/docx）
```

## 模式目录（Pattern Catalog）的组织约定

这是本仓库最重要的"架构"，理解它才能正确地新增或修改模式。

**分类前缀**（三字母编号 `XXX-NN-name.md`）：
- `COR` Core — 定义系统根本特性，通常 Required
- `STR` Structure — 组织系统静态结构
- `BHV` Behavior — 定义系统动态行为
- `QUA` Quality — 保障系统质量

**必要性等级（Necessity）**：`Required`（必采）/ `Recommended`（建议采用）/ `Optional`（按需）/ `Deprecated`（仅存档）。

**单个模式文件的固定结构**（新增模式时必须遵循，参见 `pattern-catalog/README.md` 的格式约定）：
`Category` 与 `Necessity` 元信息 → `Problem` → `Context` → `Forces` → `Solution` → `Consequences`（Benefits / Liabilities）→ `Implementation Guidelines` → `Examples` → `Related Patterns`。

**维护一致性时的同步点**：新增/修改/删除模式后，必须同时更新：
1. `pattern-catalog/README.md` 中的 Pattern Overview 表格（含必要性与一句话描述）
2. README 中的 Pattern Relationship Diagram（关系图）
3. README 末尾的 Version History（按现有格式追加版本号 + 日期 + 说明）
4. 涉及生成流程的，还需检查 `skills/pomasa/SKILL.md` 是否需同步（尤其是 Required 模式清单、可选模式的采纳条件如 BHV-06 / BHV-08）

## 生成器（SKILL.md）的工作流

`skills/pomasa/SKILL.md` 是给 AI 读的生成器指令。当被要求"创建一个多智能体系统"时，AI 应遵循其中流程。修改 SKILL.md 时需理解这些关键约束：

- **Step 2.5 是强制的**：生成任何文件前，必须先完整读取所有 Required 模式（COR-01、COR-02、STR-01、STR-06、BHV-02、QUA-03）。
- **BHV-02（Faithful Agent Instantiation）是最易出错、最关键的模式**：它规定 Orchestrator 调用子 Agent 的标准方式——只传参数、绝不转述 Blueprint 内容；一个任务实例 = 一次子 Agent 调用；调用措辞须为"请阅读 `agents/XX.xxx.md` 并严格按该 Blueprint 执行，参数：…"；并需依据 Blueprint 的完成标准校验结果。
- **STR-01 与 STR-06 是强制配对**：domain（领域知识）与 methodology（方法论指导）须一并处理。
- 生成出的系统遵循固定目录布局（`agents/`、`references/{domain,methodology}/`、`scripts/`、`workspace/`、可选的 `library/`、`wiki/`、`_output/` 等），详见 SKILL.md 的 Step 3。

## 提交与文档约定

- `.gitignore` 已排除 `_output`、`.claude`、`.idea`、`wip/` 等——这些是运行时/本地产物，不要提交。
- 仓库根目录的大图片（`pomasa-explained*.jpg/png`）是 README 引用的架构图。
- 改动模式或生成流程时，优先保证**模式文档之间的内部一致性**（编号、关系图、版本历史、SKILL.md 引用），这比任何单个文件的措辞都重要。
