# cline-subagent-profile 集成指南

中文 | **[English](./INTEGRATION_GUIDE.md)**

本文档指导如何将 **Subagent API 配置** 和 **Active Profile（保存/选择/删除）** 功能集成到任意 Cline fork 中。

> 📌 基于 **Cline 3.7.9** 开发。使用 AI 辅助集成理论上不限制版本，希望官方未来能提供原生解决方案。

---

## 目录

1. [功能概述](#功能概述)
2. [文件清单与集成路径](#文件清单与集成路径)
3. [第一步：添加类型定义](#第一步添加类型定义)
4. [第二步：集成后端逻辑](#第二步集成后端逻辑)
5. [第三步：集成 UI 组件](#第三步集成-ui-组件)
6. [第四步：集成 Subagent 运行时](#第四步集成-subagent-运行时)
7. [依赖关系图](#依赖关系图)
8. [需要修改的现有文件](#需要修改的现有文件)
9. [注意事项](#注意事项)

---

## 功能概述

本项目让 Cline 能够使用**廉价第三方 API** 执行 Subagent 任务（代码搜索、文件读取等），减少 Main Agent 的 Token 消耗，同时支持灵活的多 API 切换。

### Subagent API 配置（核心功能）
- 允许主 Agent 调用子 Agent 执行子任务
- 支持为 Subagent 配置**独立的** API Provider / Model / API Key / Base URL —— 可使用 DeepSeek、Qwen、Gemini Flash 等廉价模型
- 两种模式：**复用主 API** 或 **使用独立廉价 API**
- 支持 YAML 格式的 Agent 配置文件（`~/Documents/Cline/Agents/`）
- 支持最多 **5 个 Subagent 并行执行**

### Active Profile（API 配置预设）
- 将 API 配置保存为命名预设（Profile）
- Main Agent 和 Subagent 可**分别选择不同的 Profile**
- 标题栏按钮可绑定 Profile，**一键切换**不同 API 配置
- Profile 包含非敏感选项和可选的 Secrets 覆盖

### 成本节省示例

```text
优化前：Main Agent（Claude）读取 20 个文件 → 消耗约 50K tokens（高成本）
优化后：Main Agent 委派 Subagent（DeepSeek）读取 → 消耗约 50K tokens（低成本）
       Main Agent 仅处理汇总结果 → 消耗约 5K tokens（高成本）
效果：  搜索/读取任务成本降低约 90%
```

---

## 文件清单与集成路径

所有源文件保持与 cline-sub 相同的相对路径结构，可复制到目标 fork 中。

### 类型定义层

| 源文件 | 集成路径（相对于项目根目录） | 说明 |
|--------|------------------------------|------|
| `src/shared/storage/state-keys.ts` | `src/shared/storage/state-keys.ts` | ApiProfile 类型、Profile 相关状态键、SecretKeys |
| `src/shared/storage/provider-keys.ts` | `src/shared/storage/provider-keys.ts` | Provider -> API Key 映射表 |
| `src/shared/ExtensionMessage.ts` | `src/shared/ExtensionMessage.ts` | ExtensionState 中的 Profile/Subagent 字段 |

### 后端逻辑层

| 源文件 | 集成路径 | 说明 |
|--------|----------|------|
| `src/core/controller/models/applyApiProfile.ts` | `src/core/controller/models/applyApiProfile.ts` | 应用 Profile 到 API 配置 |
| `src/core/controller/ui/subscribeToApiProfileButtonClicked.ts` | `src/core/controller/ui/subscribeToApiProfileButtonClicked.ts` | Profile 按钮点击处理 |
| `src/core/controller/state/updateSettings.ts` | `src/core/controller/state/updateSettings.ts` | 设置更新（含 `subagentsEnabled`） |

### Subagent 运行时层

| 源文件 | 集成路径 | 说明 |
|--------|----------|------|
| `src/core/task/tools/subagent/AgentConfigLoader.ts` | `src/core/task/tools/subagent/AgentConfigLoader.ts` | Agent YAML 配置加载器 |
| `src/core/task/tools/subagent/SubagentBuilder.ts` | `src/core/task/tools/subagent/SubagentBuilder.ts` | Subagent 运行环境构建器 |
| `src/core/task/tools/subagent/SubagentRunner.ts` | `src/core/task/tools/subagent/SubagentRunner.ts` | 核心执行引擎 |
| `src/core/task/tools/handlers/SubagentToolHandler.ts` | `src/core/task/tools/handlers/SubagentToolHandler.ts` | `use_subagents` 工具处理器 |

### UI 组件层

| 源文件 | 集成路径 | 说明 |
|--------|----------|------|
| `webview-ui/src/components/settings/sections/ApiProfilesSection.tsx` | `webview-ui/src/components/settings/sections/ApiProfilesSection.tsx` | Profile 管理 UI |
| `webview-ui/src/components/settings/sections/SubagentApiConfigurationSection.tsx` | `webview-ui/src/components/settings/sections/SubagentApiConfigurationSection.tsx` | Subagent API 配置 UI |
| `webview-ui/src/components/settings/sections/ApiConfigurationSection.tsx` | `webview-ui/src/components/settings/sections/ApiConfigurationSection.tsx` | 修改后的 API 配置（含 Profile 按钮） |

---

## 第一步：添加类型定义

### 1.1 `state-keys.ts` - 新增 ApiProfile 类型和状态键

在 `USER_SETTINGS_FIELDS` 中添加以下字段：

```typescript
// ApiProfile 类型定义（在文件顶部附近）
export type ApiProfile = {
    id: string
    name: string
    updatedAt: number
    options: Record<string, unknown>
    secrets?: Partial<Secrets>
}

// 添加到 USER_SETTINGS_FIELDS：
subagentsEnabled: { default: false as boolean },

// Subagent API configuration
subagentUseMainApi: { default: true as boolean },
subagentApiProvider: { default: undefined as ApiProvider | undefined },
subagentApiModelId: { default: undefined as string | undefined },
subagentApiKey: { default: undefined as string | undefined },
subagentApiBaseUrl: { default: undefined as string | undefined },

// API Profiles
apiProfiles: { default: [] as ApiProfile[] },
activeMainApiProfileId: { default: undefined as string | undefined },
activeSubagentApiProfileId: { default: undefined as string | undefined },
apiProfile1Id: { default: undefined as string | undefined },
apiProfile2Id: { default: undefined as string | undefined },
```

### 1.2 `ExtensionMessage.ts` - 扩展 ExtensionState

在 `ExtensionState` 接口中添加：

```typescript
// Subagent 字段
subagentsEnabled?: boolean
subagentUseMainApi?: boolean
subagentApiProvider?: ApiProvider
subagentApiModelId?: string
subagentApiKey?: string
subagentApiBaseUrl?: string

// Profile 字段
apiProfiles?: ApiProfile[]
activeMainApiProfileId?: string
activeSubagentApiProfileId?: string
apiProfile1Id?: string
apiProfile2Id?: string
```

同时添加 Subagent 相关的消息类型，例如 `ClineSaySubagentStatus`、`SubagentExecutionStatus` 等。

---

## 第二步：集成后端逻辑

### 2.1 `applyApiProfile.ts`

复制到 `src/core/controller/models/`。此文件提供两个函数：

- **`applyApiProfileToMainAgent(controller, profileId)`** - 将 Profile 应用到主 Agent 的 API 配置
- **`applyApiProfileToSubagent(controller, profileId)`** - 将 Profile 应用到 Subagent 的 API 配置

**集成点：** 在 Controller 的设置更新逻辑中，当 `activeMainApiProfileId` 或 `activeSubagentApiProfileId` 变化时调用。

### 2.2 `subscribeToApiProfileButtonClicked.ts`

复制到 `src/core/controller/ui/`。提供两对函数：

- **`subscribeApiProfile1ButtonClicked` / `sendApiProfile1ButtonClickedEvent`** - Profile 按钮 1
- **`subscribeApiProfile2ButtonClicked` / `sendApiProfile2ButtonClickedEvent`** - Profile 按钮 2

**集成点：** 在 Controller 初始化时注册订阅，在 webview 消息处理中触发 `send` 函数。

### 2.3 `updateSettings.ts`

此文件较大（316 行）。Subagent 相关处理逻辑位于 `subagentsEnabled` 处理块中：

```typescript
// 处理 subagentsEnabled
if (request.subagentsEnabled !== undefined) {
    await controller.stateManager.setGlobalSettingsKey("subagentsEnabled", request.subagentsEnabled)
}

// 处理 subagent API 配置字段
// subagentUseMainApi, subagentApiProvider, subagentApiModelId, subagentApiKey, subagentApiBaseUrl
```

**注意：** 不要直接替换整个文件，而是将 Subagent 相关字段的处理逻辑合并到现有 `updateSettings.ts` 中。

---

## 第三步：集成 UI 组件

### 3.1 `ApiProfilesSection.tsx`

核心 Profile 管理 UI，功能包括：

- **创建 Profile：** 从当前 API 配置创建命名预设
- **选择 Profile：** 通过下拉菜单切换活跃 Profile
- **删除 Profile：** 删除保存的预设
- **重命名 Profile：** 编辑预设名称
- **目标切换：** 可在 Main/Subagent 目标之间切换

依赖组件：
- `@/components/ui/select` - 下拉选择器
- `../common/DebouncedTextField` - 防抖文本输入
- `../Section` - 设置面板容器
- `../utils/settingsHandlers` - 设置更新工具函数

### 3.2 `SubagentApiConfigurationSection.tsx`

Subagent API 配置面板：

- **启用/禁用 Subagent** 的开关
- **使用主 API** 的复选框
- **独立 API 配置：** Provider、Model ID、API Key、Base URL

### 3.3 `ApiConfigurationSection.tsx`

修改后的 API 配置区域，新增：

- Profile 按钮 1 / 按钮 2 的绑定选择
- 集成 `<ApiProfilesSection />`
- 集成 `<SubagentApiConfigurationSection />`

**集成点：** 在 Settings 面板中替换原有的 API 配置组件。

---

## 第四步：集成 Subagent 运行时

### 4.1 `AgentConfigLoader.ts`（367 行）

单例 YAML 配置加载器：
- 从 `~/Documents/Cline/Agents/` 读取 `.yaml` 配置文件
- 使用 Zod 进行 schema 验证
- 使用 chokidar 监听目录变化
- 管理动态工具名映射

**依赖：** `zod`、`chokidar`、`js-yaml`

### 4.2 `SubagentBuilder.ts`（261 行）

构建 Subagent 运行配置：
- 解析允许的工具列表（默认只读 + ATTEMPT）
- 构建分层 API Handler（主 API -> Subagent API -> YAML 覆盖）
- 构建 System Prompt（Agent 身份前缀 + 执行模式后缀）
- 生成原生工具定义

**关键逻辑：** Profile 应用层叠

```text
effectiveApiConfiguration = { ...apiConfiguration }
-> 应用主 Profile
-> 应用 Subagent Profile
-> 应用 YAML 配置覆盖
```

### 4.3 `SubagentRunner.ts`（882 行）

核心执行引擎：
- 创建消息并处理重试
- 流式处理 API 响应
- 处理原生/非原生工具调用
- 通过 Coordinator 执行工具处理器
- 跟踪使用统计（tokens, cost）
- 上下文窗口压缩/截断
- 在 `attempt_completion` 时返回结果

### 4.4 `SubagentToolHandler.ts`（412 行）

`use_subagents` 工具处理器，实现 `IFullyManagedTool`：
- 收集提示（最多 5 个）
- 验证 Subagent 功能已启用
- 管理审批流程
- 通过 `SubagentRunner` 并行执行
- 缓存结果并发出进度状态更新

**集成点：** 在工具处理器注册表中注册 `use_subagents` 工具。

---

## 依赖关系图

```text
类型定义层
├── state-keys.ts（ApiProfile、SecretKeys、Settings）
├── provider-keys.ts（ProviderToApiKeyMap）
└── ExtensionMessage.ts（ExtensionState）
    ├── 后端逻辑层
    │   ├── applyApiProfile.ts
    │   ├── subscribeToApiProfileButtonClicked.ts
    │   └── updateSettings.ts
    ├── UI 组件层
    │   ├── ApiProfilesSection.tsx
    │   ├── SubagentApiConfigurationSection.tsx
    │   └── ApiConfigurationSection.tsx
    └── Subagent 运行时层
        ├── AgentConfigLoader.ts
        ├── SubagentBuilder.ts
        ├── SubagentRunner.ts
        └── SubagentToolHandler.ts
```

---

## 需要修改的现有文件

除了复制上述新文件外，还需要修改以下现有文件以完成集成：

### 1. `src/extension.ts`
- 注册 Subagent 相关的命令和事件处理器

### 2. `src/core/controller/Controller.ts`
- 初始化时注册 `subscribeApiProfileButtonClicked` 订阅
- 在消息处理中添加 Profile/Subagent 相关分支
- 在设置面板中集成 `ApiProfilesSection`

### 3. `src/core/controller/state/StateManager.ts`
- 确保 `getGlobalSettingsKey` 支持 Profile 相关字段

### 4. `webview-ui/src/context/ExtensionStateContext.tsx`
- 在默认状态中添加：
  ```typescript
  subagentsEnabled: false,
  subagentUseMainApi: true,
  apiProfiles: [],
  activeMainApiProfileId: undefined,
  activeSubagentApiProfileId: undefined,
  apiProfile1Id: undefined,
  apiProfile2Id: undefined,
  ```

### 5. 工具注册表
- 在工具定义中添加 `use_subagents` 工具
- 注册 `SubagentToolHandler`

### 6. `package.json`（可选）
- 如果需要 YAML 配置支持，添加 `zod`、`chokidar`、`js-yaml` 依赖

---

## 注意事项

### 安全性
- Profile 中的 `secrets` 字段使用 `Partial<Secrets>` 类型，存储在 GlobalState 中
- `SecretKeys` 列表定义所有敏感字段，`omitSecrets()` 函数用于从 Profile 选项中排除敏感信息
- API Key 通过 `ProviderToApiKeyMap` 映射，确保只保存与当前 Provider 相关的 Key

### 兼容性
- Subagent 运行时需要 `IFullyManagedTool` 接口支持（Cline 原生接口）
- `SubagentRunner` 依赖 `buildApiHandler` 工厂函数
- `AgentConfigLoader` 需要 Node.js 的 `fs` 和 `path` 模块

### 性能
- `AgentConfigLoader` 是单例模式，使用 chokidar 监听配置变化
- `SubagentRunner` 支持上下文窗口压缩，避免 token 溢出
- 最多支持 5 个并行 Subagent

### 集成建议
1. **渐进式集成：** 先集成 Profile 功能（较独立），再集成 Subagent 运行时
2. **测试顺序：** 类型定义 -> Profile 保存/加载 -> Profile 切换 -> Subagent API 配置 -> Subagent 执行
3. **注意冲突：** `updateSettings.ts` 和 `ExtensionMessage.ts` 需要合并而非替换