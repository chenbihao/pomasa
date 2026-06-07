# AI Agent生态系统技术架构研究项目

## 项目概述

本项目是一个基于POMASA（Pattern-Oriented Multi-Agent System Architecture）模式语言构建的多智能体研究系统，用于分析2026年6月AI Agent生态系统的技术架构发展趋势。

## 研究目标

### 核心研究问题
1. Agent架构设计模式有哪些新演进？（如ReAct、Tool-use、Memory机制等）
2. 多Agent协作的技术实现方式有何变化？
3. Agent开发框架和平台的技术栈如何演变？
4. Agent的可观测性、调试和评估技术有何新进展？

### 研究范围
- 包括：AI Agent的技术架构、开发框架、工具使用、记忆机制、评估方法
- 不包括：商业应用案例、市场分析、投资建议

## 系统架构

### 采用的模式

#### 必需模式
- **COR-01**: Prompt-Defined Agent - 使用自然语言Blueprint定义Agent行为
- **COR-02**: Intelligent Runtime - 具有理解和决策能力的运行时环境
- **STR-01**: Reference Data Configuration - 将领域知识外部化为独立配置
- **STR-06**: Methodological Guidance - 方法论指导：数据源、分析方法、输出模板
- **BHV-02**: Faithful Agent Instantiation - 调用Agent时必须让其读取完整Blueprint
- **QUA-03**: Verifiable Data Lineage - 端到端可验证的数据血缘

#### 推荐模式
- **QUA-01**: Embedded Quality Standards - 在Blueprint中嵌入质量标准
- **BHV-05**: Grounded Web Research - 获取原始网页内容而非使用搜索摘要
- **QUA-04**: Observable Execution Logging - 可观测执行日志
- **STR-09**: Deliverable Export Pipeline - 交付物导出流水线

#### 可选模式
- **BHV-06**: Configurable Tool Binding - 可配置工具绑定（根据需要）

### Agent角色

1. **编排者（00.orchestrator.md）**
   - 协调整个研究流程
   - 验证每个阶段的输出质量
   - 管理Agent调用和任务分配

2. **研究者（01.researcher.md）**
   - 收集AI Agent技术架构相关数据
   - 从官方发布、技术文档、行业报告等获取信息
   - 保持完整的原始内容，不进行总结

3. **分析师（02.analyst.md）**
   - 分析研究者收集的数据
   - 识别技术架构的发展趋势
   - 提炼关键洞察和发现

4. **报告撰写者（03.reporter.md）**
   - 基于分析师的分析结果撰写报告
   - 使用公众号文章风格
   - 保持语言犀利、数据驱动

## 目录结构

```
ai_trends_2026/
├── agents/                      # Agent Blueprints
│   ├── 00.orchestrator.md       # 编排者
│   ├── 01.researcher.md         # 研究者
│   ├── 02.analyst.md            # 分析师
│   └── 03.reporter.md           # 报告撰写者
├── references/                  # 参考数据
│   ├── domain/                  # 领域知识
│   │   └── ai-agent-architecture-basics.md
│   └── methodology/             # 方法论指导
│       ├── research-overview.md
│       ├── data-sources.md
│       ├── analysis-methods.md
│       └── output-template.md
├── config.yml                   # 项目配置（可观测性级别）
├── _observation/                # 执行观测数据
│   └── manager.sh               # 观测脚本
├── workspace/                   # 运行时工作空间
│   ├── 01.research/             # 研究者工作空间
│   ├── 02.analysis/             # 分析师工作空间
│   └── 03.report/               # 报告撰写者工作空间
├── wip/                         # 工作进行中
│   └── notes.md
├── user_input_template.md       # 用户输入模板
├── .gitignore                   # Git忽略文件
└── README.md                    # 项目说明
```

## 使用方法

### 运行系统

1. **启动编排者**：
   ```
   请读取 agents/00.orchestrator.md 并严格按该Blueprint执行，参数：INSTANCE=ai-trends-2026
   ```

2. **监控执行**：
   - 查看 `_observation/` 目录中的日志和状态文件
   - 使用 `workspace/` 目录中的中间产物

3. **获取结果**：
   - 最终报告位于 `workspace/03.report/` 目录
   - 可以使用 `scripts/export.sh` 导出为DOCX/PDF格式

### 配置选项

#### 可观测性级别
在 `config.yml` 中设置：
- `none`：不产生执行日志（节省token）
- `minimal`：只记录错误（ERROR）
- `normal`：记录错误+警告（默认）
- `detailed`：记录全部（含全链路INFO里程碑）

#### 质量保证级别
在用户输入模板中设置：
- `简单`：仅采用必需的模式
- `标准`：采用QUA-01嵌入式质量标准 + BHV-05基于事实的网络研究
- `严格`：采用QUA-01 + QUA-02多层质量保证 + BHV-05基于事实的网络研究

## 数据源

### 主要数据源类型
1. 主要AI公司的官方发布（OpenAI、Anthropic、Google、Meta等）
2. AI Agent框架官方文档（LangChain、AutoGen、CrewAI等）
3. 行业分析报告（Gartner、McKinsey、IDC等）
4. 技术会议论文（NeurIPS、ICML、ACL等）

### 数据质量要求
- 所有数据必须有可验证的来源
- 优先使用官方发布和权威报告
- 避免使用未经验证的社交媒体信息
- 保持完整的原始内容，不进行总结

## 输出格式

### 最终报告
- 格式：Markdown
- 风格：公众号文章
- 语言：中文，技术术语保留英文

### 交付物
- Markdown文件（始终生成）
- DOCX文件（可选，便于编辑）
- PDF文件（可选，便于分发）

## 质量保证

### 数据质量
- 所有数据必须有可验证的来源
- 使用独立验证Agent检查数据真实性
- 建立完整的数据血缘追踪

### 分析质量
- 每个论点必须有数据支持
- 避免主观臆断，基于事实分析
- 保持客观中立的立场

### 报告质量
- 符合公众号文章风格
- 语言犀利、数据驱动
- 避免使用禁止的表达方式

## 维护指南

### 添加新数据源
1. 在 `references/methodology/data-sources.md` 中添加新数据源类型
2. 更新研究者Agent的数据收集策略
3. 验证新数据源的可信度

### 修改分析方法
1. 在 `references/methodology/analysis-methods.md` 中修改分析框架
2. 更新分析师Agent的分析流程
3. 验证新分析方法的有效性

### 调整输出格式
1. 在 `references/methodology/output-template.md` 中修改输出模板
2. 更新报告撰写者的写作风格
3. 验证新输出格式的适用性

## 版本历史

- **v0.1**（2026-06-08）：初始版本，基于POMASA模式语言构建

## 参考资料

- [POMASA Pattern Catalog](../skills/pomasa/pattern-catalog/README.md)
- [Anatomy of Declarative Multi-Agent System Architecture](../references/declarative-multi-agent-architecture-part1-en.md)

## 许可证

本项目基于Apache-2.0许可证开源。