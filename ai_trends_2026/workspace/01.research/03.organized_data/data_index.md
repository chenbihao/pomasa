# 数据索引

## 数据源概览

本研究收集了来自8个主要数据源的原始内容，覆盖AI Agent生态系统的核心技术架构。

## 数据源分类统计

### 1. 主要AI公司官方发布（5个）

| 编号 | 来源 | 关键主题 | 可信度 |
|------|------|----------|--------|
| SRC-001 | OpenAI Agents SDK | Agent定义、运行时循环、编排、工具生态、MCP支持 | 高 |
| SRC-002 | Anthropic Claude平台 | 模型能力、工具系统、上下文管理、MCP连接器 | 高 |
| SRC-003 | Anthropic工具使用 | 工具调用机制、客户端/服务端工具、严格工具使用 | 高 |
| SRC-004 | Google ADK | 多语言支持、图工作流、上下文管理、A2A协议 | 高 |
| SRC-005 | MCP协议 | 开放标准、生态支持、USB-C类比 | 高 |

### 2. AI Agent框架官方文档（3个）

| 编号 | 来源 | 关键主题 | 可信度 |
|------|------|----------|--------|
| SRC-006 | LangGraph | 图架构、持久化、人机协作、双层记忆 | 高 |
| SRC-007 | AutoGen | 四层架构、事件驱动、分布式运行时 | 高 |
| SRC-008 | CrewAI | Crew/Flow架构、企业功能、触发器集成 | 高 |

## 核心技术主题映射

### 架构模式
- **图架构**: LangGraph (SRC-006), Google ADK 2.0 (SRC-004)
- **分层架构**: AutoGen (SRC-007), Anthropic (SRC-002)
- **Crew/Flow架构**: CrewAI (SRC-008)

### 工具使用机制
- **MCP协议**: OpenAI (SRC-001), Anthropic (SRC-002), Google (SRC-004), MCP官网 (SRC-005)
- **客户端/服务端工具**: Anthropic (SRC-003)
- **工具搜索**: Anthropic (SRC-002)

### 多Agent协作
- **编排与交接**: OpenAI (SRC-001)
- **图工作流**: Google ADK (SRC-004)
- **事件驱动**: AutoGen (SRC-007)
- **Crew协作**: CrewAI (SRC-008)

### 记忆与状态管理
- **双层记忆**: LangGraph (SRC-006)
- **会话与状态**: Google ADK (SRC-004)
- **上下文压缩**: Anthropic (SRC-002)

### 可观测性
- **追踪与评估**: OpenAI (SRC-001), Anthropic (SRC-002)
- **日志/指标/追踪**: Google ADK (SRC-004)
- **LangSmith**: LangGraph (SRC-006)

## 数据缺口

以下数据源类型尚未覆盖：
- 行业分析报告（Gartner、McKinsey等）
- 技术会议论文（NeurIPS、ICML等）
- 开源社区趋势（GitHub Trending）

## 下一步

数据已整理完成，可进入分析阶段。分析师Agent应基于以上数据进行：
1. 架构模式识别与对比
2. 技术栈演进趋势分析
3. 关键技术组件演进分析
4. 开发框架对比分析
