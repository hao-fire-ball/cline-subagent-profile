import type { ApiProvider } from "@shared/api"
import { memo, useCallback } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ApiKeyField } from "../common/ApiKeyField"
import { DebouncedTextField } from "../common/DebouncedTextField"
import Section from "../Section"
import { updateSetting } from "../utils/settingsHandlers"
import ApiProfilesSection from "./ApiProfilesSection"

const PROVIDERS: Array<{ id: ApiProvider; label: string }> = [
	{ id: "openai", label: "OpenAI Compatible" },
	{ id: "openrouter", label: "OpenRouter" },
	{ id: "anthropic", label: "Anthropic" },
	{ id: "gemini", label: "Gemini" },
	{ id: "litellm", label: "LiteLLM" },
	{ id: "ollama", label: "Ollama" },
	{ id: "lmstudio", label: "LM Studio" },
	{ id: "requesty", label: "Requesty" },
]

const SubagentApiConfigurationSection = () => {
	const { subagentUseMainApi, subagentApiProvider, subagentApiModelId, subagentApiKey, subagentApiBaseUrl } =
		useExtensionState()

	const useSeparate = !(subagentUseMainApi ?? true)

	const handleUseSeparateChange = useCallback((checked: boolean) => {
		// checked: "use separate API" => subagentUseMainApi = false
		updateSetting("subagentUseMainApi", !checked)
	}, [])

	const handleProviderChange = useCallback((provider: ApiProvider) => {
		updateSetting("subagentApiProvider", provider)
	}, [])

	return (
		<div className="mt-4">
			<Section>
				<div className="mb-4">
					<div className="text-sm font-medium mb-1">Subagent API</div>
					<div className="text-xs text-(--vscode-descriptionForeground)">
						为 subagent 单独配置 Provider / Model / Key / Base URL。不开启则复用主 Agent 的 API 配置。
					</div>
				</div>

				<div className="flex items-center justify-between w-full py-2">
					<div>Use separate API for subagents</div>
					<Switch checked={useSeparate} onCheckedChange={handleUseSeparateChange} size="lg" />
				</div>

				{useSeparate && (
					<div className="mt-3 space-y-3">
						<ApiProfilesSection target="subagent" />

						<div className="text-xs text-(--vscode-descriptionForeground)">
							可选：你也可以在下面填写“高级覆盖”，用于临时覆盖 profile 的 provider/model/key/baseUrl（优先级更高）。
						</div>
						<div className="space-y-2">
							<div className="text-sm font-medium">API Provider</div>
							<Select
								onValueChange={(v) => handleProviderChange(v as ApiProvider)}
								value={subagentApiProvider || ""}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select provider" />
								</SelectTrigger>
								<SelectContent>
									{PROVIDERS.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											{p.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<DebouncedTextField
							initialValue={subagentApiModelId || ""}
							onChange={(value) => updateSetting("subagentApiModelId", value)}
							placeholder="例如 gpt-4o-mini / claude-3-5-haiku / 自定义模型 ID"
							style={{ width: "100%" }}>
							<span style={{ fontWeight: 500 }}>Model ID</span>
						</DebouncedTextField>

						<ApiKeyField
							initialValue={subagentApiKey || ""}
							onChange={(value) => updateSetting("subagentApiKey", value)}
							providerName="Subagent"
						/>

						<DebouncedTextField
							initialValue={subagentApiBaseUrl || ""}
							onChange={(value) => updateSetting("subagentApiBaseUrl", value)}
							placeholder="可选：覆盖 provider 的 Base URL"
							style={{ width: "100%" }}>
							<span style={{ fontWeight: 500 }}>Base URL (optional)</span>
						</DebouncedTextField>
					</div>
				)}
			</Section>
		</div>
	)
}

export default memo(SubagentApiConfigurationSection)
