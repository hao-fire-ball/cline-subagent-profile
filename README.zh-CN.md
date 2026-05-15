# cline-subagent-profile

中文 | **[English](./README.md)**

> 🎯 **为 Cline 配置廉价第三方 API Subagent** —— 通过独立的 Subagent API 配置和 API Profile 预设管理，实现低成本文本搜索，减少 Main Agent Token 消耗，灵活切换多个 API。
>
> 📌 基于 **Cline 3.7.9** 开发。使用 AI 辅助集成理论上不限制版本，希望官方未来能提供原生解决方案。
>
> 从 [cline-sub](https://github.com/cline/cline) 增强版 fork 中提取，可集成到任意 Cline fork 中。

---

## 为什么需要 cline-subagent-profile？

Cline 的 Main Agent 使用昂贵的模型（如 Claude、GPT-4），每次代码搜索、文件读取都会消耗大量 Token。本项目允许你为 Subagent 配置廉价的第三方 API（如 DeepSeek、Qwen、Gemini Flash 等），将搜索、读取等轻量任务交给 Subagent 执行，从而：

- 💰 **降低成本** —— Subagent 使用廉价模型，Main Agent 仅处理核心任务
- 🚀 **减少 Token 消耗** —— 搜索和文本处理任务不占用 Main Agent 上下文
- 🔄 **灵活切换多 API** —— 通过 Profile 预设一键切换不同 API 配置

---

## 功能特性

### Subagent API 配置（核心功能）
- 为 Subagent 配置**独立的** API Provider / Model / API Key / Base URL
- 支持两种模式：**复用主 API** 或 **使用独立廉价 API**
- 支持 YAML 格式的 Agent 配置文件（`~/Documents/Cline/Agents/`）
- 最多支持 **5 个 Subagent 并行执行**，加速任务处理

### API Profile 预设管理（多 API 快速切换）
- 将 API 配置**保存 / 加载**为命名预设（Profile）
- Main Agent 和 Subagent 可**分别选择不同的 Profile**
- 标题栏按钮可绑定 Profile，**一键切换 API 配置**
- Profile 包含非敏感选项和可选的 Secrets 覆盖

### Subagent 运行时引擎（运行时引擎）
- 完整的 Subagent 生命周期管理（创建 -> 执行 -> 完成）
- 流式 API 响应处理
- 自动上下文窗口压缩 / 截断
- Token 使用量和成本跟踪
- 支持原生 / 非原生工具调用

---

## 项目结构

```text
cline-subagent-profile/
├── README.md                          # 英文说明
├── README.zh-CN.md                    # 本文件（中文说明）
├── INTEGRATION_GUIDE.md               # 集成指南（英文）
├── INTEGRATION_GUIDE.zh-CN.md         # 集成指南（中文）
│
├── src/
│   ├── shared/
│   │   ├── storage/
│   │   │   ├── state-keys.ts          # ApiProfile 类型、状态、键定义
│   │   │   └── provider-keys.ts       # Provider -> API Key 映射表
│   │   └── ExtensionMessage.ts        # Extension/WebView 消息类型
│   │
│   └── core/
│       ├── controller/
│       │   ├── models/
│       │   │   └── applyApiProfile.ts # 应用 Profile 到 API 配置
│       │   ├── state/
│       │   │   └── updateSettings.ts  # 设置更新（含 subagentsEnabled）
│       │   └── ui/
│       │       └── subscribeToApiProfileButtonClicked.ts # Profile 按钮事件
│       │
│       └── task/
│           └── tools/
│               ├── handlers/
│               │   └── SubagentToolHandler.ts # use_subagents 工具处理器
│               └── subagent/
│                   ├── AgentConfigLoader.ts   # YAML 配置加载器
│                   ├── SubagentBuilder.ts     # 运行环境构建器
│                   └── SubagentRunner.ts      # 核心执行引擎
│
└── webview-ui/
    └── src/
        └── components/
            └── settings/
                └── sections/
                    ├── ApiConfigurationSection.tsx        # API 配置（含 Profile 按钮）
                    ├── ApiProfilesSection.tsx             # Profile 管理 UI
                    └── SubagentApiConfigurationSection.tsx # Subagent API 配置 UI
```

---

## 源文件说明

### 类型定义

| 文件 | 行数 | 说明 |
|------|------|------|
| `state-keys.ts` | 484 | `ApiProfile` 类型、所有状态键定义、SecretKeys、默认值 |
| `provider-keys.ts` | 139 | Provider 到 API Key 的映射表 |
| `ExtensionMessage.ts` | 378 | ExtensionState 接口、Subagent 消息类型 |

### 后端逻辑

| 文件 | 行数 | 说明 |
|------|------|------|
| `applyApiProfile.ts` | 70 | `applyApiProfileToMainAgent()` + `applyApiProfileToSubagent()` |
| `subscribeToApiProfileButtonClicked.ts` | 94 | Profile 按钮 1/2 的订阅与广播机制 |
| `updateSettings.ts` | 316 | 设置更新处理（含 Subagent 相关字段） |

### Subagent 运行时

| 文件 | 行数 | 说明 |
|------|------|------|
| `AgentConfigLoader.ts` | 367 | 单例 YAML 配置加载器（Zod + chokidar） |
| `SubagentBuilder.ts` | 261 | 构建运行配置（工具、API、System Prompt） |
| `SubagentRunner.ts` | 882 | 核心执行引擎（消息、流式响应、工具调用） |
| `SubagentToolHandler.ts` | 412 | `use_subagents` 工具处理器（IFullyManagedTool） |

### UI 组件

| 文件 | 行数 | 说明 |
|------|------|------|
| `ApiProfilesSection.tsx` | 184 | Profile 创建 / 选择 / 删除 / 重命名 |
| `SubagentApiConfigurationSection.tsx` | 106 | Subagent API 独立配置面板 |
| `ApiConfigurationSection.tsx` | 92 | 集成 Profile 按钮的 API 配置区域 |

---

## 如何使用

### 方式一：AI 辅助集成

将本仓库作为参考代码，让 AI 阅读 `INTEGRATION_GUIDE.zh-CN.md` 后，将代码集成到你的 Cline fork 中。

**推荐 Prompt：**

```text
请阅读 INTEGRATION_GUIDE.zh-CN.md，将 cline-subagent-profile 中的 Subagent API 配置
和 Active Profile 功能集成到我的 Cline fork 中。请按照指南中的步骤顺序执行。
```

### 方式二：手动集成

按照 `INTEGRATION_GUIDE.zh-CN.md` 中的四个步骤执行：

1. **添加类型定义** - 修改 `state-keys.ts`、`ExtensionMessage.ts`
2. **集成后端逻辑** - 复制 `applyApiProfile.ts` 等文件，并合并 `updateSettings.ts`
3. **集成 UI 组件** - 复制三个 `.tsx` 文件，并修改 Settings 面板
4. **集成 Subagent 运行时** - 复制四个运行时文件，并注册工具处理器

详见 -> [INTEGRATION_GUIDE.zh-CN.md](./INTEGRATION_GUIDE.zh-CN.md)

---

## 依赖关系

### 外部依赖（Subagent 运行时需要）
- `zod` - YAML 配置验证
- `chokidar` - 目录监听
- `js-yaml` - YAML 解析

### 内部依赖
- Cline 的 `buildApiHandler` 工厂函数
- Cline 的 `StateManager` / `StorageContext`
- Cline 的 `IFullyManagedTool` 接口
- WebView UI 组件库（`@vscode/webview-ui-toolkit`、`shadcn/ui`）

---

## 重要说明

1. **这些文件是代码参考，不是独立可运行的包** - 需要集成到 Cline 项目中才能使用。
2. **`state-keys.ts` 和 `ExtensionMessage.ts` 是完整文件** - 集成时需要合并差异，而不是直接替换。
3. **`updateSettings.ts` 是完整文件** - 同样需要合并差异。
4. **原版 Cline 没有这些功能** - 这些是 cline-sub fork 的增强功能。

---

## 许可证

与 Cline 主项目相同。

## 致谢

- 功能源自 [cline-sub](https://github.com/cline/cline) 增强版 fork
- 基于 [Cline](https://github.com/cline/cline) 开源项目