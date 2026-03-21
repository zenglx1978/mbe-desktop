# MBE Desktop — 统一桌面端

> **一个安装包，所有行业方案。** 客户下载 MBE Desktop → 选行业 → AI 专家团队到位。

## 项目概述

MBE Desktop 是 MBE 产品矩阵的**主产品入口**，基于 Electron 33 + React 18 + Vite 5 构建。
取代所有单 Agent 前端（mbe-finance/mbe-legal/mbe-pulmonary 等已冻结），提供统一的行业解决方案选择与 AI 专家交互体验。

核心卖点：**数据留本地、断线能用、大文件不走网络**。

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 33 (Chromium 130, Node 20.18) |
| 前端 | React 18, Vite 5, TailwindCSS, Zustand |
| 路由 | react-router-dom (HashRouter) |
| 本地数据库 | sql.js (SQLite in WASM) |
| 文档生成 | docx / pptxgenjs / exceljs |
| 计算引擎 | 纯 TypeScript (calc-engine.ts)，零 Python 依赖 |
| 构建 | electron-builder (MSI/NSIS/portable) |
| E2E 测试 | Playwright |

## 目录结构

```
src/
├── main/                      # Electron 主进程
│   ├── index.ts               # 入口：窗口、生命周期、IPC handlers、自动更新
│   ├── preload.ts             # contextBridge 暴露 API 到渲染进程
│   ├── database.ts            # sql.js 本地数据库
│   ├── calc-engine.ts         # 纯 TS 确定性计算器（个税/增值税/劳动补偿/诉讼费/造价/肺科评分）
│   ├── local-calc.ts          # 计算器 IPC 入口（白名单校验）
│   ├── local-app-bridge.ts    # 本地应用调用（命令白名单 + 参数校验）
│   ├── web-reader.ts          # 网页内容提取（CSS selector 安全校验，customScript 已禁用）
│   ├── copilot-bridge.ts      # AI Copilot 集成
│   ├── migration.ts           # 旧版数据迁移
│   ├── workflow-miner.ts      # 工作流挖掘
│   ├── behavior-observer.ts   # 用户行为观察
│   ├── pattern-recognizer.ts  # 模式识别
│   ├── data-pipeline.ts       # 数据管道
│   ├── local-data-reader.ts   # 本地数据读取
│   ├── local-inference.ts     # 本地推理
│   ├── file-intel.ts          # 文件智能分析
│   ├── scheduler.ts           # 定时任务
│   ├── user-memory.ts         # 用户记忆
│   ├── ecommerce-cs-bridge.ts # 电商客服桥接
│   ├── accessibility-bridge.ts # 无障碍桥接
│   └── docgen/                # 文档生成引擎
│       ├── docx-engine.ts     # Word 生成
│       ├── pptx-engine.ts     # PPT 生成
│       └── xlsx-engine.ts     # Excel 生成
└── renderer/                  # React 渲染进程
    ├── App.tsx                # 根组件（ErrorBoundary + HashRouter）
    ├── stores/                # Zustand 状态管理
    │   ├── app-store.ts       # 应用全局状态
    │   ├── auth-store.ts      # 认证状态
    │   ├── chat-store.ts      # 聊天状态
    │   ├── conversation-store.ts
    │   ├── tool-store.ts
    │   ├── notification-store.ts
    │   ├── connectivity-store.ts
    │   ├── cloud-sync-store.ts
    │   ├── smart-cache-store.ts
    │   ├── approval-store.ts
    │   ├── adaptive-ui-store.ts
    │   ├── local-feedback-store.ts
    │   ├── client-chat-store.ts
    │   ├── client-input-store.ts
    │   ├── client-session-store.ts
    │   ├── client-portal-types.ts
    │   └── client-portal-constants.ts
    ├── pages/
    │   └── Workspace.tsx      # 主工作区
    ├── components/
    │   ├── chat/              # 聊天组件
    │   ├── charts/            # 图表组件
    │   ├── tasks/             # 任务卡片
    │   ├── workbench/         # 工作台（自动化/效率面板/客户聊天）
    │   ├── io/                # 导入导出
    │   └── visualization/     # 可视化（DataPoetry/ConfidenceVisual/AgentCollaboration）
    ├── lib/                   # 工具库
    └── types/                 # 类型定义
```

## 路由

| 路由 | 组件 | 认证 | 说明 |
|------|------|------|------|
| `/auth` | AuthPage | 否 | 登录页 |
| `/pick` | SolutionPicker | 是 | 行业方案选择 |
| `/` | Workspace | 是 | 主工作区（需已选方案） |
| `/settings` | Settings | 是 | 设置 |
| `/migrate` | MigrationWizard | 是 | 旧版数据迁移 |
| `/data-source-setup` | DataSourceSetup | 是 | 数据源配置 |
| `/solution/:solutionId` | SolutionDetail | 是 | 方案详情 |
| `/kb-graph` | KBGraphView | 是 | 知识图谱 |
| `/analytics/heatmaps` | AnalyticsHeatmaps | 是 | 分析热力图 |
| `/deepmind` | DeepMindDashboard | 是 | DeepMind 仪表盘 |
| `/copilot` | CopilotPanel | — | AI Copilot |

## 安全架构

### IPC 安全原则
- **contextIsolation: true** — 渲染进程无法直接访问 Node.js
- **nodeIntegration: false** — 渲染进程不加载 Node 模块
- 所有主进程 API 通过 `preload.ts` 的 `contextBridge.exposeInMainWorld` 暴露

### 已实施安全措施
- `localApp.exec`: 命令白名单 + 参数 shell 元字符校验
- `webReader`: CSS selector 安全校验，`customScript` 已禁用，`webReader:extract` 已禁用
- `fs:readFileBase64`: 路径白名单（documents/downloads/desktop/temp/dataDir）
- `fs:writeFile`: 路径白名单（MBE Desktop 目录/downloads/desktop/temp）
- `calc:run`: 计算器名称白名单（仅允许 HANDLERS 中注册的 11 个计算器）
- `shell:openExternal`: 仅允许 http/https 协议
- 全局 ErrorBoundary 防止 UI 崩溃白屏

## 常用命令

```bash
# 开发（Electron + Vite 联调）
npm run dev:electron       # 端口 5180

# 仅前端（浏览器模式）
npm run dev

# 构建
npm run build              # Vite + TypeScript 编译
npm run pack:win           # Windows 安装包（MSI/NSIS/portable）

# 测试
npm run test               # Vitest 单元测试（calc-engine 44 用例）
npm run test:watch         # Vitest 监听模式
npm run test:e2e           # Playwright E2E
npm run test:e2e:headed    # 有界面模式
npm run test:e2e:ui        # Playwright UI 模式

# 代码质量
npm run lint               # ESLint
npm run type-check         # TypeScript 类型检查
```

## 安全架构

| 层 | 措施 | 状态 |
|----|------|------|
| IPC 命令注入 | `local-app-bridge.ts` 白名单 + 参数校验 | ✅ |
| 文件路径穿越 | `isPathWithinAllowed()` 读/写目录白名单 | ✅ |
| 计算器注入 | `local-calc.ts` 白名单 + 参数类型校验 | ✅ |
| `shell:openPath` | 路径必须在允许的读取目录内 | ✅ |
| CSP 策略 | `webRequest.onHeadersReceived` 注入 CSP header | ✅ |
| contextIsolation | `true`，渲染进程无 Node.js 访问 | ✅ |
| nodeIntegration | `false` | ✅ |
| 会话加密 | `safeStorage` 加密敏感字段 | ✅ |

## 不可违反的原则

1. **渲染进程零 Node.js** — 所有文件/系统操作必须通过 IPC 调主进程
2. **路径安全** — fs 操作必须校验路径在允许目录内，禁止路径穿越
3. **命令安全** — 外部命令必须在白名单中，参数不得含 shell 元字符
4. **数据本地化** — 用户数据存储在 `app.getPath('userData')`，不上传
5. **离线可用** — 计算引擎纯 TS 实现，断网照常工作
6. **统一入口** — 所有行业方案共用一个安装包，通过 SolutionPicker 选择

## 已知陷阱

| 陷阱 | 正确做法 |
|------|---------|
| 渲染进程直接 `require('fs')` | 通过 `window.electronAPI.fs.xxx` IPC 调用 |
| `shell:openPath` 打开任意路径 | 路径需在允许目录内或来自用户 dialog 选择 |
| `child_process.spawn` 执行命令 | 使用 `local-app-bridge.ts` 白名单机制 |
| 直接字符串拼接 CSS selector | 使用 `sanitizeSelector()` 校验 |
| Zustand store 未持久化 | auth-store 使用 localStorage，其他按需 |
| HashRouter 路径含 `#` | 正常 Electron 行为，不要改为 BrowserRouter |
