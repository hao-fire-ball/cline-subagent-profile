import { buildApiHandler } from "@core/api"
import { PromptRegistry } from "@core/prompts/system-prompt"
import { ClineToolSet } from "@core/prompts/system-prompt/registry/ClineToolSet"
import type { SystemPromptContext } from "@core/prompts/system-prompt/types"
import { ClineDefaultTool } from "@shared/tools"
import { ApiProvider } from "@/shared/api"
import { getProviderModelIdKey, ProviderToApiKeyMap } from "@/shared/storage/provider-keys"
import type { ApiProfile } from "@/shared/storage/state-keys"
import { SecretKeys } from "@/shared/storage/state-keys"
import type { TaskConfig } from "../types/TaskConfig"
import type { AgentBaseConfig } from "./AgentConfigLoader"
import { AgentConfigLoader } from "./AgentConfigLoader"

export type AgentConfig = Partial<AgentBaseConfig>

export const SUBAGENT_DEFAULT_ALLOWED_TOOLS: ClineDefaultTool[] = [
	ClineDefaultTool.FILE_READ,
	ClineDefaultTool.LIST_FILES,
	ClineDefaultTool.SEARCH,
	ClineDefaultTool.LIST_CODE_DEF,
	ClineDefaultTool.BASH,
	ClineDefaultTool.USE_SKILL,
	ClineDefaultTool.ATTEMPT,
]

export const SUBAGENT_SYSTEM_SUFFIX = `\n\n# Subagent Execution Mode
You are running as a research subagent. Your job is to explore the codebase and gather information to answer the question.
Explore, read related files, trace through call chains, and build a complete picture before reporting back.
You can read files, list directories, search for patterns, list code definitions, and run commands.
Only use execute_command for readonly operations like ls, grep, git log, git diff, gh, etc.
When it makes sense, be clever about chaining commands or in-command scripting in execute_command to quickly get relevant context - and using pipes / filters to help narrow results.
Do not run commands that modify files or system state.
When you have a comprehensive answer, call the attempt_completion tool.
The attempt_completion result field is sent directly to the main agent, so put your full final findings there.
Unless the subagent prompt explicitly asks for detailed analysis, keep the result concise and focus on the files the main agent should read next.
Include a section titled "Relevant file paths" and list only file paths, one per line.
Do not include line numbers, summaries, or per-file explanations unless explicitly requested.

## Output Format Requirements
Structure your attempt_completion result as follows:

### SUMMARY (required, max 800 chars)
A concise answer to the question. Include:
- Direct answer or conclusion
- Key file paths (one per line)
- Critical findings that affect the main agent's next decision
- Confidence indicator: ✅ HIGH / ⚠️ MEDIUM / ❓ LOW

### DETAILS (optional, for complex analysis)
Full code snippets, call chains, dependency graphs, etc.
The main agent may not see this section if context is limited,
so ensure SUMMARY is self-contained and accurate.

### RELEVANT FILE PATHS
List only file paths, one per line. No descriptions.

## Context Efficiency Guidelines
You have a large context window (~1M tokens). Use it efficiently:
- Read multiple related files in one go rather than one at a time
- When searching, prefer broader searches and filter results yourself
- Use execute_command to batch operations when helpful
- Don't be afraid to read entire files - you have the context budget
- Build a complete picture before reporting back
`

export class SubagentBuilder {
	private readonly agentConfig: AgentConfig = {}
	private readonly allowedTools: ClineDefaultTool[]
	private readonly apiHandler: ReturnType<typeof buildApiHandler>

	constructor(
		private readonly baseConfig: TaskConfig,
		subagentName?: string,
	) {
		const subagentConfig = AgentConfigLoader.getInstance().getCachedConfig(subagentName)
		this.agentConfig = subagentConfig ?? {}
		this.allowedTools = this.resolveAllowedTools(this.agentConfig.tools)

		const mode = this.baseConfig.services.stateManager.getGlobalSettingsKey("mode")
		const apiConfiguration = this.baseConfig.services.stateManager.getApiConfiguration()
		const stateManager = this.baseConfig.services.stateManager
		const useMainApi = stateManager.getGlobalSettingsKey("subagentUseMainApi") ?? true

		let effectiveApiConfiguration: Record<string, unknown> = { ...apiConfiguration }

		const profiles = (stateManager.getGlobalSettingsKey("apiProfiles") || []) as ApiProfile[]
		const activeMainProfileId = stateManager.getGlobalSettingsKey("activeMainApiProfileId")
		const activeSubagentProfileId = stateManager.getGlobalSettingsKey("activeSubagentApiProfileId")

		const applyProfile = (profileId?: string) => {
			if (!profileId) return
			const profile = profiles.find((p) => p.id === profileId)
			if (!profile) return

			// Apply non-secret options.
			if (profile.options && typeof profile.options === "object") {
				effectiveApiConfiguration = { ...effectiveApiConfiguration, ...(profile.options as Record<string, unknown>) }
			}

			// Apply optional secrets into effective configuration.
			if (profile.secrets && typeof profile.secrets === "object") {
				for (const [k, v] of Object.entries(profile.secrets as Record<string, unknown>)) {
					if ((SecretKeys as string[]).includes(k)) {
						effectiveApiConfiguration[k] = v
					}
				}
			}
		}

		// Apply main profile first, then subagent profile.
		applyProfile(activeMainProfileId)
		if (!useMainApi) {
			applyProfile(activeSubagentProfileId)
		}

		if (!useMainApi) {
			const subagentProvider = stateManager.getGlobalSettingsKey("subagentApiProvider")
			const subagentModelId = stateManager.getGlobalSettingsKey("subagentApiModelId")?.trim()
			const subagentApiKey = stateManager.getGlobalSettingsKey("subagentApiKey")
			const subagentBaseUrl = stateManager.getGlobalSettingsKey("subagentApiBaseUrl")

			if (subagentProvider) {
				// Use subagent provider in both modes (subagent runs in whichever mode the parent is in).
				effectiveApiConfiguration.actModeApiProvider = subagentProvider
				effectiveApiConfiguration.planModeApiProvider = subagentProvider

				if (subagentModelId) {
					effectiveApiConfiguration[getProviderModelIdKey(subagentProvider, "act")] = subagentModelId
					effectiveApiConfiguration[getProviderModelIdKey(subagentProvider, "plan")] = subagentModelId
				}

				const providerApiKeyField = ProviderToApiKeyMap[subagentProvider]
				if (typeof providerApiKeyField === "string" && subagentApiKey) {
					effectiveApiConfiguration[providerApiKeyField] = subagentApiKey
				}

				if (subagentBaseUrl) {
					this.applyProviderBaseUrlOverride(effectiveApiConfiguration, subagentProvider, subagentBaseUrl)
				}
			}
		}

		// YAML config remains highest priority.
		effectiveApiConfiguration = {
			...effectiveApiConfiguration,
			...(this.agentConfig.api ?? {}),
			ulid: this.baseConfig.ulid,
		}
		this.applyModelOverride(effectiveApiConfiguration, mode, this.agentConfig.modelId)
		this.apiHandler = buildApiHandler(effectiveApiConfiguration as typeof apiConfiguration, mode)
	}

	getApiHandler(): ReturnType<typeof buildApiHandler> {
		return this.apiHandler
	}

	getAllowedTools(): ClineDefaultTool[] {
		return this.allowedTools
	}

	getConfiguredSkills(): string[] | undefined {
		return this.agentConfig.skills
	}

	buildSystemPrompt(generatedSystemPrompt: string): string {
		const configuredSystemPrompt = this.agentConfig?.systemPrompt?.trim()
		const systemPrompt = configuredSystemPrompt || generatedSystemPrompt
		return `${systemPrompt}${this.buildAgentIdentitySystemPrefix()}${SUBAGENT_SYSTEM_SUFFIX}`
	}

	buildNativeTools(context: SystemPromptContext) {
		const family = PromptRegistry.getInstance().getModelFamily(context)
		const toolSets = ClineToolSet.getToolsForVariantWithFallback(family, this.allowedTools)
		const filteredToolSpecs = toolSets
			.map((toolSet) => toolSet.config)
			.filter(
				(toolSpec) =>
					this.allowedTools.includes(toolSpec.id) &&
					(!toolSpec.contextRequirements || toolSpec.contextRequirements(context)),
			)

		const converter = ClineToolSet.getNativeConverter(context.providerInfo.providerId, context.providerInfo.model.id)
		return filteredToolSpecs.map((tool) => converter(tool, context))
	}

	private resolveAllowedTools(configuredTools?: ClineDefaultTool[]): ClineDefaultTool[] {
		const sourceTools = configuredTools && configuredTools.length > 0 ? configuredTools : SUBAGENT_DEFAULT_ALLOWED_TOOLS
		return Array.from(new Set([...sourceTools, ClineDefaultTool.ATTEMPT]))
	}

	private buildAgentIdentitySystemPrefix(): string {
		const name = this.agentConfig?.name?.trim()
		const description = this.agentConfig?.description?.trim()
		if (!name && !description) {
			return ""
		}

		const lines = ["# Agent Profile"]
		if (name) {
			lines.push(`Name: ${name}`)
		}
		if (description) {
			lines.push(`Description: ${description}`)
		}

		return `${lines.join("\n")}\n\n`
	}

	private applyModelOverride(apiConfiguration: Record<string, unknown>, _mode: string, modelId?: string): void {
		const trimmedModelId = modelId?.trim()
		if (!trimmedModelId) {
			return
		}

		const mode = _mode === "plan" ? "plan" : "act"
		const provider = apiConfiguration[_mode === "plan" ? "planModeApiProvider" : "actModeApiProvider"] as ApiProvider
		apiConfiguration[getProviderModelIdKey(provider as ApiProvider, mode)] = trimmedModelId
	}

	private applyProviderBaseUrlOverride(
		apiConfiguration: Record<string, unknown>,
		provider: ApiProvider,
		baseUrl: string,
	): void {
		switch (provider) {
			case "openai":
			case "openai-native":
				apiConfiguration.openAiBaseUrl = baseUrl
				return
			case "anthropic":
				apiConfiguration.anthropicBaseUrl = baseUrl
				return
			case "gemini":
				apiConfiguration.geminiBaseUrl = baseUrl
				return
			case "litellm":
				apiConfiguration.liteLlmBaseUrl = baseUrl
				return
			case "ollama":
				apiConfiguration.ollamaBaseUrl = baseUrl
				return
			case "lmstudio":
				apiConfiguration.lmStudioBaseUrl = baseUrl
				return
			case "requesty":
				apiConfiguration.requestyBaseUrl = baseUrl
				return
			case "oca":
				apiConfiguration.ocaBaseUrl = baseUrl
				return
			case "aihubmix":
				apiConfiguration.aihubmixBaseUrl = baseUrl
				return
			case "sapaicore":
				apiConfiguration.sapAiCoreBaseUrl = baseUrl
				return
			default:
				return
		}
	}
}
