import type { ApiConfiguration, ApiProvider } from "@shared/api"
import { ProviderToApiKeyMap } from "@shared/storage/provider-keys"
import type { ApiProfile } from "@shared/storage/state-keys"
import { SecretKeys } from "@shared/storage/state-keys"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { memo, useCallback, useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { DebouncedTextField } from "../common/DebouncedTextField"
import Section from "../Section"
import { updateSettingsCli } from "../utils/settingsHandlers"

type Target = "main" | "subagent"

function omitSecrets(apiConfiguration: ApiConfiguration | undefined): Record<string, unknown> {
	const src = (apiConfiguration || {}) as Record<string, unknown>
	const secretsSet = new Set(SecretKeys as string[])
	const result: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(src)) {
		if (secretsSet.has(k)) continue
		if (k === "ulid" || k === "onRetryAttempt") continue
		if (v === undefined) continue
		result[k] = v
	}
	return result
}

function pickProviderSecrets(apiConfiguration: ApiConfiguration | undefined): Record<string, string | undefined> {
	const provider = (apiConfiguration?.actModeApiProvider || apiConfiguration?.planModeApiProvider) as ApiProvider | undefined
	const mapped = provider ? ProviderToApiKeyMap[provider] : undefined
	const src = (apiConfiguration || {}) as Record<string, any>
	const out: Record<string, string | undefined> = {}
	if (!mapped) return out
	const keys = Array.isArray(mapped) ? mapped : [mapped]
	for (const k of keys) {
		out[k] = src[k]
	}
	return out
}

/** Build profile options from subagent-specific fields instead of main apiConfiguration. */
function buildSubagentProfileOptions(state: {
	subagentApiProvider?: ApiProvider
	subagentApiModelId?: string
	subagentApiBaseUrl?: string
}): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	if (state.subagentApiProvider) result.subagentApiProvider = state.subagentApiProvider
	if (state.subagentApiModelId) result.subagentApiModelId = state.subagentApiModelId
	if (state.subagentApiBaseUrl) result.subagentApiBaseUrl = state.subagentApiBaseUrl
	return result
}

const ApiProfilesSection = ({ target }: { target: Target }) => {
	const {
		apiConfiguration,
		apiProfiles,
		activeMainApiProfileId,
		activeSubagentApiProfileId,
		subagentApiProvider,
		subagentApiModelId,
		subagentApiKey,
		subagentApiBaseUrl,
	} = useExtensionState()

	const activeId = target === "main" ? activeMainApiProfileId : activeSubagentApiProfileId

	const [newProfileName, setNewProfileName] = useState("")
	const [includeKeys, setIncludeKeys] = useState(true)

	const profiles: ApiProfile[] = (apiProfiles || []) as any
	const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])

	const setActive = useCallback(
		(id: string) => {
			updateSettingsCli({
				[target === "main" ? "activeMainApiProfileId" : "activeSubagentApiProfileId"]: id,
			})
		},
		[target],
	)

	const createFromCurrent = useCallback(() => {
		const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
		const name = (newProfileName || `Profile ${profiles.length + 1}`).trim()

		let options: Record<string, unknown>
		let secrets: Partial<Record<string, string | undefined>> | undefined

		if (target === "subagent") {
			options = buildSubagentProfileOptions({ subagentApiProvider, subagentApiModelId, subagentApiBaseUrl })
			secrets = includeKeys && subagentApiKey ? { subagentApiKey } : undefined
		} else {
			options = omitSecrets(apiConfiguration)
			secrets = includeKeys ? pickProviderSecrets(apiConfiguration) : undefined
		}

		const next: ApiProfile = {
			id,
			name,
			updatedAt: Date.now(),
			options,
			secrets,
		}
		updateSettingsCli({
			apiProfiles: [...profiles, next],
			[target === "main" ? "activeMainApiProfileId" : "activeSubagentApiProfileId"]: id,
		})
		setNewProfileName("")
	}, [
		apiConfiguration,
		includeKeys,
		newProfileName,
		profiles,
		target,
		subagentApiProvider,
		subagentApiModelId,
		subagentApiKey,
		subagentApiBaseUrl,
	])

	const deleteProfile = useCallback(
		(id: string) => {
			const next = profiles.filter((p) => p.id !== id)
			updateSettingsCli({
				apiProfiles: next,
				...(activeId === id ? { [target === "main" ? "activeMainApiProfileId" : "activeSubagentApiProfileId"]: "" } : {}),
			})
		},
		[profiles, activeId, target],
	)

	return (
		<div className="mt-2">
			<Section>
				<div className="text-sm font-medium">API Profiles ({target === "main" ? "Main Agent" : "Subagent"})</div>

				<div className="space-y-2">
					<div className="text-xs">Active profile</div>
					<Select onValueChange={setActive} value={activeId || ""}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Select a profile" />
						</SelectTrigger>
						<SelectContent>
							{profiles.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{activeId && byId.get(activeId) && (
						<div className="flex justify-end">
							<button className="text-xs text-(--vscode-errorForeground)" onClick={() => deleteProfile(activeId)}>
								Delete active profile
							</button>
						</div>
					)}
				</div>

				<div className="mt-3 space-y-2">
					<DebouncedTextField
						initialValue={newProfileName}
						onChange={(v) => setNewProfileName(v)}
						placeholder="Profile name (optional)"
						style={{ width: "100%" }}>
						<span style={{ fontWeight: 500 }}>New profile name</span>
					</DebouncedTextField>

					<div className="flex items-center gap-2">
						<VSCodeCheckbox checked={includeKeys} onChange={(e) => setIncludeKeys((e.target as any).checked)} />
						<span className="text-xs">Include API keys for the current provider</span>
					</div>

					<button className="text-xs underline" onClick={createFromCurrent}>
						Save current settings as new profile
					</button>
				</div>
			</Section>
		</div>
	)
}

export default memo(ApiProfilesSection)
