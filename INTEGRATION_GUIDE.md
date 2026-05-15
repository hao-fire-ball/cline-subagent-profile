# cline-subagent-profile Integration Guide

**[中文版](./INTEGRATION_GUIDE.zh-CN.md)** | English

This document guides you through integrating **Subagent API Configuration** and **Active Profile (Save/Select/Delete)** features into any Cline fork.

> 📌 Based on **Cline 3.7.9** development. AI-assisted integration theoretically supports any version. Hope the official Cline project will provide a native solution in the future.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [File List & Integration Paths](#file-list--integration-paths)
3. [Step 1: Add Type Definitions](#step-1-add-type-definitions)
4. [Step 2: Integrate Backend Logic](#step-2-integrate-backend-logic)
5. [Step 3: Integrate UI Components](#step-3-integrate-ui-components)
6. [Step 4: Integrate Subagent Runtime](#step-4-integrate-subagent-runtime)
7. [Dependency Graph](#dependency-graph)
8. [Existing Files to Modify](#existing-files-to-modify)
9. [Notes](#notes)

---

## Feature Overview

This project enables Cline to use **low-cost third-party APIs** for Subagent tasks (code search, file reading, etc.), reducing Main Agent token consumption while supporting flexible multi-API switching.

### Subagent API Configuration（Core Feature）
- Allows the main Agent to invoke sub-agents for sub-tasks
- Supports **independent** API Provider / Model / API Key / Base URL for Subagents — use cheap models like DeepSeek, Qwen, Gemini Flash
- Two modes: **reuse main API** or **use independent cheap API**
- YAML-formatted Agent configuration files (`~/Documents/Cline/Agents/`)
- Execute up to **5 Subagents in parallel**

### Active Profile (API Configuration Presets)
- Save API configurations as named presets (Profiles)
- Main Agent and Subagent can **each select different Profiles**
- Title bar buttons can bind to Profiles for **one-click switching** between APIs
- Profiles contain non-sensitive options and optional Secrets overrides

### Cost-Saving Example

```text
Before: Main Agent (Claude) reads 20 files → ~50K tokens consumed at premium cost
After:  Main Agent delegates to Subagent (DeepSeek) → ~50K tokens at low cost
        Main Agent only processes summarized results → ~5K tokens at premium cost
Result: ~90% cost reduction for search/reading tasks
```

---

## File List & Integration Paths

All source files maintain the same relative path structure as cline-sub and can be copied directly to the target fork.

### Type Definition Layer

| Source File | Integration Path (relative to project root) | Description |
|-------------|----------------------------------------------|-------------|
| `src/shared/storage/state-keys.ts` | `src/shared/storage/state-keys.ts` | ApiProfile type, Profile state keys, SecretKeys |
| `src/shared/storage/provider-keys.ts` | `src/shared/storage/provider-keys.ts` | Provider -> API Key mapping |
| `src/shared/ExtensionMessage.ts` | `src/shared/ExtensionMessage.ts` | Profile/Subagent fields in ExtensionState |

### Backend Logic Layer

| Source File | Integration Path | Description |
|-------------|------------------|-------------|
| `src/core/controller/models/applyApiProfile.ts` | `src/core/controller/models/applyApiProfile.ts` | Apply Profile to API config |
| `src/core/controller/ui/subscribeToApiProfileButtonClicked.ts` | `src/core/controller/ui/subscribeToApiProfileButtonClicked.ts` | Profile button click handler |
| `src/core/controller/state/updateSettings.ts` | `src/core/controller/state/updateSettings.ts` | Settings update (with subagentsEnabled) |

### Subagent Runtime Layer

| Source File | Integration Path | Description |
|-------------|------------------|-------------|
| `src/core/task/tools/subagent/AgentConfigLoader.ts` | `src/core/task/tools/subagent/AgentConfigLoader.ts` | Agent YAML config loader |
| `src/core/task/tools/subagent/SubagentBuilder.ts` | `src/core/task/tools/subagent/SubagentBuilder.ts` | Subagent runtime environment builder |
| `src/core/task/tools/subagent/SubagentRunner.ts` | `src/core/task/tools/subagent/SubagentRunner.ts` | Core execution engine |
| `src/core/task/tools/handlers/SubagentToolHandler.ts` | `src/core/task/tools/handlers/SubagentToolHandler.ts` | `use_subagents` tool handler |

### UI Component Layer

| Source File | Integration Path | Description |
|-------------|------------------|-------------|
| `webview-ui/src/components/settings/sections/ApiProfilesSection.tsx` | `webview-ui/src/components/settings/sections/ApiProfilesSection.tsx` | Profile management UI |
| `webview-ui/src/components/settings/sections/SubagentApiConfigurationSection.tsx` | `webview-ui/src/components/settings/sections/SubagentApiConfigurationSection.tsx` | Subagent API config UI |
| `webview-ui/src/components/settings/sections/ApiConfigurationSection.tsx` | `webview-ui/src/components/settings/sections/ApiConfigurationSection.tsx` | Modified API config with Profile buttons |

---

## Step 1: Add Type Definitions

### 1.1 `state-keys.ts` - Add ApiProfile Type and State Keys

Add the following to `USER_SETTINGS_FIELDS`:

```typescript
// ApiProfile type definition (near the top of the file)
export type ApiProfile = {
    id: string
    name: string
    updatedAt: number
    options: Record<string, unknown>
    secrets?: Partial<Secrets>
}

// Add to USER_SETTINGS_FIELDS:
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

### 1.2 `ExtensionMessage.ts` - Extend ExtensionState

Add the following fields to the `ExtensionState` interface:

```typescript
// Subagent fields
subagentsEnabled?: boolean
subagentUseMainApi?: boolean
subagentApiProvider?: ApiProvider
subagentApiModelId?: string
subagentApiKey?: string
subagentApiBaseUrl?: string

// Profile fields
apiProfiles?: ApiProfile[]
activeMainApiProfileId?: string
activeSubagentApiProfileId?: string
apiProfile1Id?: string
apiProfile2Id?: string
```

Also add Subagent-related message types such as `ClineSaySubagentStatus` and `SubagentExecutionStatus`.

---

## Step 2: Integrate Backend Logic

### 2.1 `applyApiProfile.ts`

Copy this file to `src/core/controller/models/`. It provides two functions:

- **`applyApiProfileToMainAgent(controller, profileId)`** - apply a Profile to the main Agent API configuration
- **`applyApiProfileToSubagent(controller, profileId)`** - apply a Profile to the Subagent API configuration

**Integration point:** call these functions from Controller/settings update logic when `activeMainApiProfileId` or `activeSubagentApiProfileId` changes.

### 2.2 `subscribeToApiProfileButtonClicked.ts`

Copy this file to `src/core/controller/ui/`. It provides two function pairs:

- **`subscribeApiProfile1ButtonClicked` / `sendApiProfile1ButtonClickedEvent`** - Profile button 1
- **`subscribeApiProfile2ButtonClicked` / `sendApiProfile2ButtonClickedEvent`** - Profile button 2

**Integration point:** register the subscriptions during Controller initialization and call the send functions from webview message handling.

### 2.3 `updateSettings.ts`

This is a larger file (316 lines). The Subagent logic is in the `subagentsEnabled` handling block:

```typescript
// Handle subagentsEnabled
if (request.subagentsEnabled !== undefined) {
    await controller.stateManager.setGlobalSettingsKey("subagentsEnabled", request.subagentsEnabled)
}

// Handle subagent API configuration fields
// subagentUseMainApi, subagentApiProvider, subagentApiModelId, subagentApiKey, subagentApiBaseUrl
```

**Note:** do not replace your entire existing file blindly. Merge the Subagent-related field handling into your existing `updateSettings.ts`.

---

## Step 3: Integrate UI Components

### 3.1 `ApiProfilesSection.tsx`

Core Profile management UI features:

- **Create Profile:** create a named preset from the current API configuration
- **Select Profile:** switch the active Profile using a dropdown
- **Delete Profile:** delete a saved preset
- **Rename Profile:** edit a preset name
- **Target switch:** switch between Main and Subagent targets

Dependencies:
- `@/components/ui/select` - dropdown selector
- `../common/DebouncedTextField` - debounced text input
- `../Section` - settings section container
- `../utils/settingsHandlers` - settings update helper functions

### 3.2 `SubagentApiConfigurationSection.tsx`

Subagent API configuration panel:

- Enable/disable Subagent toggle
- Use main API checkbox
- Independent API configuration: Provider, Model ID, API Key, Base URL

### 3.3 `ApiConfigurationSection.tsx`

Modified API configuration area, adding:

- Binding selectors for Profile button 1 and button 2
- Integration of `<ApiProfilesSection />`
- Integration of `<SubagentApiConfigurationSection />`

**Integration point:** replace or extend the existing API configuration component in the Settings panel.

---

## Step 4: Integrate Subagent Runtime

### 4.1 `AgentConfigLoader.ts` (367 lines)

Singleton YAML config loader:
- Reads `.yaml` config files from `~/Documents/Cline/Agents/`
- Validates schemas with Zod
- Watches directory changes with chokidar
- Manages dynamic tool name mappings

**Dependencies:** `zod`, `chokidar`, `js-yaml`

### 4.2 `SubagentBuilder.ts` (261 lines)

Builds the Subagent runtime configuration:
- Parses allowed tool lists (default read-only + ATTEMPT)
- Builds layered API Handler configuration (main API -> Subagent API -> YAML override)
- Builds the System Prompt (Agent identity prefix + execution mode suffix)
- Generates native tool definitions

**Key logic:** Profile application layering

```text
effectiveApiConfiguration = { ...apiConfiguration }
-> apply main Profile
-> apply Subagent Profile
-> apply YAML configuration override
```

### 4.3 `SubagentRunner.ts` (882 lines)

Core execution engine:
- Creates messages and handles retries
- Streams API responses
- Handles native and non-native tool calls
- Executes tool handlers through the Coordinator
- Tracks usage statistics (tokens, cost)
- Compresses/truncates context windows
- Returns results via `attempt_completion`

### 4.4 `SubagentToolHandler.ts` (412 lines)

`use_subagents` tool handler implementing `IFullyManagedTool`:
- Collects prompts (up to 5)
- Verifies that Subagent functionality is enabled
- Manages approval flow
- Executes Subagents in parallel via `SubagentRunner`
- Caches results and emits progress status updates

**Integration point:** register the `use_subagents` tool in your tool handler registry.

---

## Dependency Graph

```text
Type definition layer
├── state-keys.ts (ApiProfile, SecretKeys, Settings)
├── provider-keys.ts (ProviderToApiKeyMap)
└── ExtensionMessage.ts (ExtensionState)
    ├── Backend logic layer
    │   ├── applyApiProfile.ts
    │   ├── subscribeToApiProfileButtonClicked.ts
    │   └── updateSettings.ts
    ├── UI component layer
    │   ├── ApiProfilesSection.tsx
    │   ├── SubagentApiConfigurationSection.tsx
    │   └── ApiConfigurationSection.tsx
    └── Subagent runtime layer
        ├── AgentConfigLoader.ts
        ├── SubagentBuilder.ts
        ├── SubagentRunner.ts
        └── SubagentToolHandler.ts
```

---

## Existing Files to Modify

In addition to copying the new files above, update these existing files to complete integration:

### 1. `src/extension.ts`
- Register Subagent-related commands and event handlers

### 2. `src/core/controller/Controller.ts`
- Register `subscribeApiProfileButtonClicked` subscriptions during initialization
- Add Profile/Subagent branches in message handling
- Integrate `ApiProfilesSection` in the Settings panel

### 3. `src/core/controller/state/StateManager.ts`
- Ensure `getGlobalSettingsKey` supports Profile-related fields

### 4. `webview-ui/src/context/ExtensionStateContext.tsx`
- Add the following to the default state:
  ```typescript
  subagentsEnabled: false,
  subagentUseMainApi: true,
  apiProfiles: [],
  activeMainApiProfileId: undefined,
  activeSubagentApiProfileId: undefined,
  apiProfile1Id: undefined,
  apiProfile2Id: undefined,
  ```

### 5. Tool registry
- Add the `use_subagents` tool definition
- Register `SubagentToolHandler`

### 6. `package.json` (optional)
- Add `zod`, `chokidar`, and `js-yaml` if YAML config support is needed

---

## Notes

### Security
- The `secrets` field in Profile uses `Partial<Secrets>` and is stored in GlobalState
- `SecretKeys` defines all sensitive fields, and `omitSecrets()` excludes sensitive information from Profile options
- API Keys are mapped through `ProviderToApiKeyMap`, ensuring only keys relevant to the current Provider are saved

### Compatibility
- Subagent runtime requires the `IFullyManagedTool` interface support from Cline
- `SubagentRunner` depends on the `buildApiHandler` factory function
- `AgentConfigLoader` requires Node.js `fs` and `path` modules

### Performance
- `AgentConfigLoader` is a singleton and uses chokidar to watch configuration changes
- `SubagentRunner` supports context window compression to avoid token overflow
- Up to 5 Subagents are supported in parallel

### Integration Recommendations
1. **Integrate gradually:** integrate Profile features first (more independent), then integrate the Subagent runtime
2. **Test order:** type definitions -> Profile save/load -> Profile switching -> Subagent API config -> Subagent execution
3. **Watch for conflicts:** `updateSettings.ts` and `ExtensionMessage.ts` should be merged, not blindly replaced