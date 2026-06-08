# TODO-DASHBOARD

POMASA 可观测性 Dashboard 的研发规划。基于 main 分支的 QUA-04 模式，参考 master 分支的 web 项目进行构建。

---

## 技术选型

| 层次 | 选择 | 理由 |
|------|------|------|
| 前端框架 | React 19 + TypeScript | 与 master 一致，生态成熟 |
| 构建工具 | Vite 7 | 与 master 一致 |
| CSS 框架 | Tailwind CSS 4 | 与 master 一致 |
| 后端框架 | Express 5 + TypeScript | 与 master 一致 |
| Markdown 渲染 | react-markdown + remark-gfm | 与 master 一致 |
| 图标 | lucide-react | 与 master 一致 |
| DAG 可视化 | reactflow | 流水线 DAG 图渲染 |
| 终端模拟 | xterm.js + node-pty | Page4 命令终端（Phase 5 延后） |
| 实时通信 | ws (WebSocket) | 终端双向流式通信 |
| 状态管理 | React Context / zustand | 工作目录等全局状态 |

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器 (localhost:5173)                                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  React 前端                                             │ │
│  │  ├─ Tab: Dashboard   (项目总览 + 进度)                   │ │
│  │  ├─ Tab: Viewer      (目录树 + 文件预览)                 │ │
│  │  ├─ Tab: Create MAS  (表单 + 模式选择 + 流式创建)        │ │
│  │  └─ Tab: Terminal    (xterm.js 终端)                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                    ↕ HTTP + WebSocket
┌─────────────────────────────────────────────────────────────┐
│  Node.js 后端 (Express + ws)                                │
│  ├─ REST API: 项目扫描、文件读取、MAS 创建                   │
│  ├─ WebSocket: 终端 PTY 会话                                │
│  └─ 文件系统: 读取工作目录下的项目结构与观测数据              │
└─────────────────────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────────────────────┐
│  本地文件系统 (工作目录)                                     │
│  ├─ P1-xxxx/                                                │
│  │   ├─ _observation/        ← QUA-04 观测数据              │
│  │   ├─ workspace/           ← 交付产物                     │
│  │   ├─ agents/              ← Blueprint                   │
│  │   └─ config.yml                                          │
│  ├─ P2-yyyy/                                                │
│  └─ ...                                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 页面设计

### 全局：顶部 Tab 导航 + 工作目录设置

- 页面顶部固定 Tab 栏：`Dashboard` | `Viewer` | `Create` | `Terminal`
- Tab 栏右侧显示当前工作目录，点击可修改
- 工作目录持久化到 `localStorage`

### Page1: Dashboard（项目总览 + 详情）

**路由**: `/` (总览), `/project/:name` (详情)

**总览页** (`/`):
- 网格卡片布局，每个项目一张卡片
- 卡片信息：项目名称、状态图标（运行中/完成/失败/无观测）、进度条、最后更新时间
- 有 `_observation/` 的项目：解析 `run_manifest.json` + 各 stage 的 `assigned/*.json` 计算进度
- 无 `_observation/` 的项目：标记为"非可观测项目"，仍可点击进入 Viewer
- 顶部统计栏：总项目数、运行中、已完成、有告警

**详情页** (`/project/:name`):
- 上半部分：状态视图
  - 用 reactflow 根据 `run_manifest.json` 的 stages 渲染流水线 DAG 图
  - 每个节点显示：agent 名称、assigned 状态（颜色编码）、self 状态（小标签）
  - 状态颜色：`done`=绿, `running`=蓝(脉冲动画), `failed`=红, `timed_out`=橙, `pending`=灰
  - 点击节点展开详情卡片（最后日志、assigned vs self 对比）
- 下半部分：Tab 切换
  - **Events**: 事件时间线（`run.jsonl` + 所有 `_log.jsonl` 合并，按时间排序）
    - 不同 level 用不同颜色：INFO=蓝, WARN=黄, ERROR=红
    - 筛选：按 agent、按 level、按 event type
  - **Logs**: 按 agent 分组查看各 `_log.jsonl`
  - **Status**: 表格形式展示所有 agent 的 self/assigned 状态对比

### Page2: Viewer（目录树 + 文件预览）

**路由**: `/viewer`, `/viewer?path=xxx`

- 复用 master 的 ViewPage 设计
- 左侧：目录树（支持展开/折叠）
- 右侧：文件内容预览（Markdown 渲染 + 原始文本）
- 改进：默认显示工作目录的文件树（而非需要手动选择）

### Page3: Create（创建新 MAS）

**路由**: `/create`

- 复用 master 的 CreatePage 设计
- 移除 macOS `osascript` 系统对话框，改为：
  - 目标目录选择：后端提供"列出子目录"API，前端下拉选择 + 手动输入
  - 参考文件选择：后端提供"列出目录下文件"API，前端多选
- 流式创建过程（SSE）保持不变

### Page4: Terminal（命令终端）

**路由**: `/terminal`

- 左侧：目录树（可选，用于参考文件结构）
- 右侧：xterm.js 终端窗口，全屏可用
- 通过 WebSocket 连接到后端 PTY
- 支持：Claude Code CLI、git、npm 等任意本地命令
- 终端大小自适应窗口

---

## 后端 API 设计

### 项目扫描 API

```
GET /api/projects
```
扫描工作目录，返回所有子目录及其观测状态。

Query: `workdir` (string) — 工作目录路径

Response:
```json
{
  "projects": [
    {
      "name": "P1-ai-trends",
      "path": "/workdir/P1-ai-trends",
      "hasObservation": true,
      "status": "running",        // running | completed | failed | unknown
      "progress": 0.6,            // 0~1, 基于 assigned 状态计算
      "stages": 3,
      "stagesCompleted": 2,
      "lastUpdate": "2026-06-08T09:05:09+08:00",
      "hasAlerts": true,          // 有 WARN/ERROR 事件
      "instance": "ai-trends-2026"  // 从 run_manifest.json 读取
    }
  ]
}
```

### 项目详情 API

```
GET /api/projects/:name/manifest
```
返回 `run_manifest.json` 内容。

```
GET /api/projects/:name/status
```
返回所有 agent 的状态汇总。

Response:
```json
{
  "agents": [
    {
      "key": "01.research",
      "agent": "01.researcher",
      "assigned": { "state": "done", "ts": "...", "detail": "..." },
      "self": { "state": "done", "ts": "..." }
    }
  ]
}
```

```
GET /api/projects/:name/events?agent=xxx&level=xxx&limit=100
```
合并返回 `run.jsonl` + 所有 `_log.jsonl` 的事件，按时间倒序。

```
GET /api/projects/:name/logs/:key
```
返回指定 agent 的 `_log.jsonl` 内容。

### 文件系统 API（复用 master）

```
GET /api/fs/tree?path=xxx          # 获取目录树
GET /api/fs/file?path=xxx          # 读取文件内容
GET /api/fs/dirs?path=xxx          # 列出子目录（用于 Create 页选择）
GET /api/fs/files?path=xxx&glob=xx # 列出文件（用于参考文件选择）
```

### MAS 创建 API（复用 master，调整）

```
POST /api/mas/create               # 流式创建 MAS (SSE)
GET  /api/framework/patterns       # 获取模式列表
GET  /api/framework/template       # 获取用户输入模板
GET  /api/framework/generator      # 获取生成器 prompt
```

### 终端 WebSocket API

```
WS /api/terminal
```
连接后发送 `{ type: "start", cwd: "/path" }` 创建 PTY。
后端转发 PTY 的 stdout/stderr → WebSocket → xterm.js。
前端发送输入 → WebSocket → PTY stdin。
支持 resize: `{ type: "resize", cols: 80, rows: 24 }`。

---

## 目录结构

```
web/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── server/
│   ├── index.ts              # Express + WebSocket 主入口
│   ├── routes/
│   │   ├── projects.ts       # 项目扫描与详情 API
│   │   ├── fs.ts             # 文件系统 API
│   │   ├── mas.ts            # MAS 创建 API
│   │   └── framework.ts      # 框架数据 API
│   ├── services/
│   │   ├── scanner.ts        # 项目扫描逻辑（解析 _observation）
│   │   └── terminal.ts       # PTY 管理
│   └── types.ts              # 共享类型定义
├── src/
│   ├── main.tsx
│   ├── App.tsx               # 路由 + Tab 布局
│   ├── index.css
│   ├── stores/
│   │   └── useWorkDir.ts     # 工作目录状态 (localStorage)
│   ├── hooks/
│   │   ├── usePageTitle.ts
│   │   └── useProjects.ts    # 项目列表轮询
│   ├── components/
│   │   ├── TabNav.tsx         # 顶部 Tab 导航
│   │   ├── WorkDirSelector.tsx # 工作目录设置
│   │   ├── FileTree.tsx       # 目录树组件（复用）
│   │   ├── MarkdownView.tsx   # Markdown 渲染（复用）
│   │   ├── StatusBadge.tsx    # 状态标签
│   │   ├── ProgressRing.tsx   # 环形进度
│   │   └── PipelineDAG.tsx    # 流水线 DAG 图 (reactflow)
│   ├── pages/
│   │   ├── DashboardPage.tsx  # Page1 总览
│   │   ├── ProjectDetailPage.tsx # Page1 详情
│   │   ├── ViewerPage.tsx     # Page2
│   │   ├── CreatePage.tsx     # Page3
│   │   └── TerminalPage.tsx   # Page4
│   └── i18n/
│       ├── index.ts
│       ├── en.json
│       └── zh.json
└── public/
```

---

## 开发阶段

### Phase 0: 项目脚手架 ✅ 已完成

**位置**：根目录 `dashboard/`

**Step 0.1 — 用 Vite 创建项目**
- `npm create vite@latest dashboard -- --template react-ts`
- 安装基础依赖：`react-router-dom`, `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography`, `lucide-react`, `react-markdown`, `remark-gfm`, `reactflow`
- 后端依赖：`express`, `cors`, `ws`, `tsx`, `concurrently`
- 从 master 挑选复制配置文件：`vite.config.ts`, `tsconfig*.json`
- 从 master 复制通用代码：`src/i18n/`, `src/hooks/usePageTitle.ts`, `src/components/LanguageSwitcher.tsx`, `src/main.tsx`, `src/index.css`

**Step 0.2 — Tab 导航布局**
- `src/App.tsx`：路由 + 顶部 Tab 栏
- `src/components/TabNav.tsx`：Dashboard | Viewer | Create | Terminal（Terminal 灰色禁用态）
- 路由：`/` (Dashboard), `/viewer` (Viewer), `/create` (Create)

**Step 0.3 — 工作目录设置**
- `src/stores/useWorkDir.ts`：localStorage 持久化工作目录路径
- `src/components/WorkDirSelector.tsx`：Tab 栏右侧显示/修改工作目录
- 后端 `GET /api/config/workdir` + `POST /api/config/workdir` 读写配置文件

**Step 0.4 — 后端基础框架**
- `server/index.ts`：Express + WebSocket 基础
- `server/routes/fs.ts`：文件系统 API（`/api/fs/tree`, `/api/fs/file`, `/api/fs/dirs`）
- 前端 dev proxy → `http://localhost:3001`

**Step 0.5 — 验证**
- `npm run dev` 同时启动前后端
- Tab 导航可用，工作目录可设置并持久化
- 文件系统 API 可正常调用

### Phase 1: Dashboard 核心 ✅ 已完成
- [x] 后端：项目扫描 API (`GET /api/projects`)
  - 扫描工作目录下所有子目录
  - 检测 `_observation/` 是否存在
  - 解析 `run_manifest.json` 获取 stages
  - 读取 `assigned/*.json` 计算进度
- [x] 前端：Dashboard 总览页
  - 项目卡片网格布局
  - 状态图标 + 进度条
  - 顶部统计栏（总项目数、运行中、已完成、有告警）
  - 自动轮询刷新（10s）

### Phase 2: 项目详情 ✅ 已完成
- [x] 后端：项目详情 API
  - `GET /api/projects/:name/manifest`
  - `GET /api/projects/:name/status`
  - `GET /api/projects/:name/events`
- [x] 前端：项目详情页 (`/project/:name`)
  - reactflow DAG 图（基于 manifest stages，节点颜色编码状态）
  - 事件时间线（合并 JSONL，按时间排序，颜色编码）
  - Agent 状态表格（self vs assigned 对比）
  - 按 agent/level 筛选

### Phase 3: Viewer ✅ 已完成
- [x] 后端：文件系统 API (`/api/fs/*`)
- [x] 前端：ViewerPage（复用 master 的 ViewPage）
  - 目录树 + 文件预览
  - 默认显示工作目录

### Phase 4: Create MAS ✅ 已完成
- [x] 后端：MAS 创建 API（流式 SSE 输出）
- [x] 前端：CreatePage
  - 表单：目标目录、MAS 名称、研究主题
  - 模式选择：按分类分组，Required 自动选中
  - 流式创建输出

### Phase 5: Terminal ✅ 已完成
- [x] 后端：WebSocket 终端服务（child_process.spawn）
- [x] 前端：TerminalPage + xterm.js 集成
- [x] 支持 cwd 切换、连接状态显示

### Phase 6: 打磨 ✅ 已完成
- [x] 国际化 (i18n) - 中英文切换
- [x] 响应式布局 - grid 响应式适配
- [x] Viewer 文件树完整展示 + Markdown 渲染（KaTeX 数学公式 + highlight.js 代码高亮）
- [x] Viewer 文件树工具栏（展开全部、收起全部、定位当前文件）
- [x] CreatePage 与 user_input_template_zh.md 完整对应
- [x] Terminal 使用 node-pty 真实 PTY
- [x] Dashboard DAG 图改进（状态颜色、动画、详情显示）
- [x] 事件时间线改进（事件类型标签、stage 标签、result 标签）
- [x] 状态表格改进（assigned vs self 对比、divergent 标记、图例说明）

---

## 数据模型

### 项目扫描结果

```typescript
interface ProjectInfo {
  name: string                    // 目录名
  path: string                    // 绝对路径
  hasObservation: boolean         // 是否有 _observation/
  status: 'running' | 'completed' | 'failed' | 'unknown'
  progress: number                // 0~1
  stages: number                  // 总阶段数
  stagesCompleted: number         // 已完成阶段数
  lastUpdate: string | null       // ISO 8601
  hasAlerts: boolean              // 有 WARN/ERROR
  instance: string | null         // run_manifest.json 中的 instance
}
```

### 运行清单（来自 run_manifest.json）

```typescript
interface RunManifest {
  instance: string
  created: string
  stages: {
    id: string
    agent: string
    depends_on: string[]
    fanout: 'none' | 'dynamic'
  }[]
}
```

### Agent 状态

```typescript
interface AgentStatus {
  key: string                     // 分区键，如 "01.research"
  agent: string                   // agent 名称
  assigned: {                     // Orchestrator 分配的状态（权威）
    state: string
    ts: string
    detail?: string
  } | null
  self: {                         // Agent 自报状态（低信任）
    state: string
    ts: string
    detail?: string
  } | null
}
```

### 事件日志（来自 .jsonl）

```typescript
interface LogEvent {
  ts: string                      // ISO 8601 with offset
  level: 'INFO' | 'WARN' | 'ERROR'
  agent: string
  instance: string
  event: string                   // 事件类型 slug
  msg: string
  key: string
  path?: string                   // 相关文件路径
  [extra: string]: unknown        // 附加字段
}
```

---

## 与 master 的差异

| 方面 | master | dashboard (本项目) |
|------|--------|-------------------|
| 首页 | 两个大按钮 | Dashboard 项目总览 + 进度 |
| 导航 | 无（单页跳转） | 顶部 Tab 栏 |
| DAG 图 | 无 | reactflow (自动布局 + 状态着色) |
| 文件选择 | macOS osascript | API 驱动（跨平台） |
| 终端 | 无 | xterm.js + WebSocket PTY |
| 观测数据 | 无 | QUA-04 解析 + 可视化 |
| 工作目录 | 无（临时选择） | localStorage 持久化 |
| 技术栈 | React 19, Express 5 | 相同，新增 xterm.js, ws, node-pty |

---

## 参考资源

- master 分支 web 项目：`git show master:web/`
- QUA-04 模式：`skills/pomasa/pattern-catalog/QUA-04-observable-execution-logging.md`
- manager.sh 脚本：`skills/pomasa/scripts/manager.sh`
