# cline-subagent-profile

**[中文](./README.zh-CN.md)** | English

> 🎯 **Configure low-cost third-party API Subagents for Cline** — Independent Subagent API configuration + Profile preset management for cheap text search, reduced Main Agent token consumption, and flexible multi-API switching.
>
> 📌 Based on **Cline 3.7.9** development. AI-assisted integration theoretically supports any version. Hope the official Cline project will provide a native solution in the future.
>

---

## Why cline-subagent-profile?

Cline's Main Agent uses expensive models (e.g., Claude, GPT-4), and every code search or file read consumes significant tokens. This project allows you to configure low-cost third-party APIs (such as DeepSeek, Qwen, Gemini Flash, etc.) for Subagents, delegating lightweight tasks like search and reading to Subagents:

- 💰 **Reduce costs** — Subagents use cheap models, Main Agent only handles core tasks
- 🚀 **Cut token consumption** — Search and text processing tasks don't consume Main Agent context
- 🔄 **Flexible multi-API switching** — One-click switching between different API configs via Profile presets

---

## Features

### Subagent API Configuration (Core)
- Configure **independent** API Provider / Model / API Key / Base URL for Subagents
- Two modes: **reuse main API** or **use independent cheap API** (e.g., DeepSeek, Qwen, Gemini Flash)
- YAML-formatted Agent configuration files (`~/Documents/Cline/Agents/`)

### API Profile Preset Management (Multi-API Switching)
- **Save / Load** API configurations as named presets (Profiles)
- Main Agent and Subagent can **each select different Profiles**
- Profiles contain non-sensitive options and optional Secrets overrides

### Subagent Runtime Engine
- Full Subagent lifecycle management (create → execute → complete)
- Streaming API response processing
- Automatic context window compression / truncation
- Token usage and cost tracking
- Native / non-native tool call support

---

## Project Structure

```text
cline-subagent-profile/
├── README.md                          # This file (English)
├── README.zh-CN.md                    # Chinese README
├── INTEGRATION_GUIDE.md               # Integration guide (English)
├── INTEGRATION_GUIDE.zh-CN.md         # Integration guide (Chinese)
│
├── src/
│   ├── shared/
│   │   ├── storage/
│   │   │   ├── state-keys.ts          # ApiProfile type, state key definitions
│   │   │   └── provider-keys.ts       # Provider -> API Key mapping
│   │   └── ExtensionMessage.ts        # Extension/WebView message types
│   │
│   └── core/
│       ├── controller/
│       │   ├── models/
│       │   │   └── applyApiProfile.ts # Apply Profile to API config
│       │   ├── state/
│       │   │   └── updateSettings.ts  # Settings update (with subagentsEnabled)
│       │
│       └── task/
│           └── tools/
│               ├── handlers/
│               │   └── SubagentToolHandler.ts # use_subagents tool handler
│               └── subagent/
│                   ├── AgentConfigLoader.ts   # YAML config loader
│                   ├── SubagentBuilder.ts     # Runtime environment builder
│                   └── SubagentRunner.ts      # Core execution engine
│
└── webview-ui/
    └── src/
        └── components/
            └── settings/
                └── sections/
                    ├── ApiConfigurationSection.tsx        # API config (with Profile buttons)
                    ├── ApiProfilesSection.tsx             # Profile management UI
                    └── SubagentApiConfigurationSection.tsx # Subagent API config UI
```

---

## Source Files

### Type Definitions

| File | Lines | Description |
|------|------:|-------------|
| `state-keys.ts` | 484 | `ApiProfile` type, all state key definitions, SecretKeys, defaults |
| `provider-keys.ts` | 139 | Provider to API Key mapping table |
| `ExtensionMessage.ts` | 378 | ExtensionState interface and Subagent message types |

### Backend Logic

| File | Lines | Description |
|------|------:|-------------|
| `applyApiProfile.ts` | 70 | `applyApiProfileToMainAgent()` + `applyApiProfileToSubagent()` |
| `updateSettings.ts` | 316 | Settings update handling, including Subagent fields |

### Subagent Runtime

| File | Lines | Description |
|------|------:|-------------|
| `AgentConfigLoader.ts` | 367 | Singleton YAML config loader (Zod + chokidar) |
| `SubagentBuilder.ts` | 261 | Runtime config builder (tools, API, system prompt) |
| `SubagentRunner.ts` | 882 | Core execution engine (messages, streaming, tool calls) |
| `SubagentToolHandler.ts` | 412 | `use_subagents` tool handler (`IFullyManagedTool`) |

### UI Components

| File | Lines | Description |
|------|------:|-------------|
| `ApiProfilesSection.tsx` | 184 | Profile create / select / delete / rename UI |
| `SubagentApiConfigurationSection.tsx` | 106 | Independent Subagent API configuration panel |
| `ApiConfigurationSection.tsx` | 92 | API configuration area |

---

## How to Use

### Option 1: AI-assisted Integration

Use this repository as reference code and ask an AI assistant to read `INTEGRATION_GUIDE.md`, then integrate the code into your Cline fork.

**Recommended prompt:**

```text
Please read INTEGRATION_GUIDE.md and integrate the Subagent API Configuration
and Active Profile features from cline-subagent-profile into my Cline fork.
Follow the steps in the guide in order.
```

### Option 2: Manual Integration

Follow the four steps in `INTEGRATION_GUIDE.md`:

1. **Add type definitions** - modify `state-keys.ts` and `ExtensionMessage.ts`
2. **Integrate backend logic** - copy `applyApiProfile.ts` and related files, then merge `updateSettings.ts`
3. **Integrate UI components** - copy the three `.tsx` files and modify the Settings panel
4. **Integrate Subagent runtime** - copy the four runtime files and register the tool handler

See -> [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)

---

## Dependencies

### External dependencies required by Subagent runtime
- `zod` - YAML config validation
- `chokidar` - directory watching
- `js-yaml` - YAML parsing

### Internal dependencies
- Cline's `buildApiHandler` factory function
- Cline's `StateManager` / `StorageContext`
- Cline's `IFullyManagedTool` interface
- WebView UI component libraries (`@vscode/webview-ui-toolkit`, `shadcn/ui`)

---

## Important Notes

1. **These files are reference code, not a standalone package** - they must be integrated into a Cline project before use.
2. **`state-keys.ts` and `ExtensionMessage.ts` are complete files** - merge the differences during integration instead of replacing existing files blindly.
3. **`updateSettings.ts` is a complete file** - merge the differences as well.

---

## License

Same as the main Cline project.

## Credits

- Based on the [Cline](https://github.com/cline/cline) open-source project
