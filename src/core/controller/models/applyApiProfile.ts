import { buildApiHandler } from "@core/api"
import type { Controller } from "@core/controller"
import type { ApiConfiguration } from "@shared/api"
import type { ApiProfile, Secrets } from "@shared/storage/state-keys"

function sanitizeOptions(options: Record<string, unknown>): Partial<ApiConfiguration> {
	const { ulid: _ulid, onRetryAttempt: _onRetryAttempt, ...rest } = options as any
	return rest as Partial<ApiConfiguration>
}

export async function applyApiProfileToMainAgent(controller: Controller, profileId: string): Promise<void> {
	if (!profileId) {
		return
	}

	const profiles = (controller.stateManager.getGlobalSettingsKey("apiProfiles") || []) as ApiProfile[]
	const profile = profiles.find((p) => p.id === profileId)
	if (!profile) {
		return
	}

	// Apply secrets first (optional) so `getApiConfiguration()` reflects them.
	if (profile.secrets) {
		controller.stateManager.setSecretsBatch(profile.secrets as Partial<Secrets>)
	}

	const current = controller.stateManager.getApiConfiguration()
	const updated = {
		...current,
		...sanitizeOptions(profile.options || {}),
	}
	controller.stateManager.setApiConfiguration(updated)

	// Update running task handler if needed.
	if (controller.task) {
		const currentMode = controller.stateManager.getGlobalSettingsKey("mode")
		controller.task.api = buildApiHandler({ ...updated, ulid: controller.task.ulid }, currentMode)
	}
}

export async function applyApiProfileToSubagent(controller: Controller, profileId: string): Promise<void> {
	if (!profileId) {
		return
	}

	const profiles = (controller.stateManager.getGlobalSettingsKey("apiProfiles") || []) as ApiProfile[]
	const profile = profiles.find((p) => p.id === profileId)
	if (!profile) {
		return
	}

	const options = profile.options || {}

	// Apply subagent-specific fields from the profile
	if (options.subagentApiProvider !== undefined) {
		controller.stateManager.setGlobalState("subagentApiProvider", options.subagentApiProvider as any)
	}
	if (options.subagentApiModelId !== undefined) {
		controller.stateManager.setGlobalState("subagentApiModelId", options.subagentApiModelId as string)
	}
	if (options.subagentApiBaseUrl !== undefined) {
		controller.stateManager.setGlobalState("subagentApiBaseUrl", options.subagentApiBaseUrl as string)
	}

	// Apply subagentApiKey from secrets (stored as generic key since it's not in the Secrets type)
	const secrets = profile.secrets as Record<string, string | undefined> | undefined
	if (secrets?.subagentApiKey !== undefined) {
		controller.stateManager.setGlobalState("subagentApiKey", secrets.subagentApiKey)
	}
}
