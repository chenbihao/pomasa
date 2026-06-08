# 用户输入

请填写以下信息。生成器（Generator）将利用这些信息为你创建研究导向型多智能体系统。

对于不确定的选项，你可以填写"由 AI 建议（to be suggested by AI）"，生成器会根据模式目录（pattern catalog）提供合理的默认方案。

---

## 语言设置

**智能体蓝图语言，默认中文**：

{{BLUEPRINT_LANGUAGE}}

**报告输出语言，默认中文**：

{{REPORT_LANGUAGE}}

---

## 研究项目基本信息

**项目标识符**：

{{PROJECT_IDENTIFIER}}

**研究主题与核心问题**：

{{RESEARCH_TOPIC}}

**初步想法与洞察**：

{{INITIAL_IDEAS}}

---

## 数据收集

**数据来源**：

{{DATA_SOURCES}}

**现有参考资料**：

请在下方列出你的参考资料（文件路径或 URL）。生成器会根据 [STR-01 参考数据配置](./pattern-catalog/STR-01-reference-data-configuration.md) 将所有资料转换为 Markdown 格式。

{{EXISTING_REFERENCES}}

---

## 分析方法

**分析方法**：

{{ANALYSIS_METHODS}}

---

## 输出格式

**报告格式**：

{{REPORT_FORMAT}}

**报告结构**：

{{REPORT_STRUCTURE}}

**交付文件格式**：

{{DELIVERABLE_FORMATS}}

如果勾选了 DOCX/PDF，生成器将配置带有模板的导出流水线（STR-09）。
如果勾选了 Wiki，生成器将创建一个 Wiki 整合智能体以及 `wiki/` 目录结构（BHV-08）。

---

## 模式选择

完整模式列表请参阅 [pattern-catalog/README.md](./pattern-catalog/README.md)

**质量保证级别**：

{{QUALITY_LEVEL}}

**可观测性级别（Observability Level）**（QUA-04 可观测执行日志 —— 独立于上面的质量保证级别）：

{{OBSERVABILITY_LEVEL}}

生成器会创建 `config.yml`（保存该级别）与 `_observation/manager.sh`（统一的日志+状态记录器），并在每个 Blueprint 中加入观测小节。观测数据集中在 `_observation/` 下，含执行日志与各 agent 的状态快照。

**需要启用或禁用的其他模式**：

{{PATTERN_OVERRIDES}}

---

## 其他要求

*高级用户：如需覆盖默认的网络工具优先级，请参阅 [BHV-06 可配置工具绑定](./pattern-catalog/BHV-06-configurable-tool-binding.md)。*

{{OTHER_REQUIREMENTS}}

---

## 输出形式预设（参考）

以下不是需要填写的字段。当输出形式隐含某种写作风格时，生成器会在 Phase 0 进料阶段套用对应预设。请将其视为起点，并根据具体选题调整。

### 预设：研究报告 / 技术分析

无固定风格预设——在 Phase 0 头脑风暴阶段根据选题和受众确定写作风格。

### 预设：公众号文章

除非用户特别强调，默认采用以下写作风格配置：

**语言**:
- 标准中文，技术术语保留英文
- 专业但不晦涩，有锐度但不偏激
- 短句为主，保持节奏感

**基调**:
- 理性解构，不贩卖焦虑，不说假大空，不神神叨叨
- 数据优先，通过各种论证方式来论证，讲事实，举例子
- 语言以随机性短句式为主，不要长期用同一种语法，风格犀利

**绝对避免**:
- 不写成八卦文
- 不写成科教入门文
- 不用 bullet points 堆砌，用通顺的段落组织（仅在对比数据时可用列表）
- 不反复重复同一观点
- 不用"首先、其次、最后"的机械结构
- 不用夸张修辞和感叹号
- 不贩卖焦虑，不鼓吹末日论

---

## Selected Patterns

{{SELECTED_PATTERNS}}
