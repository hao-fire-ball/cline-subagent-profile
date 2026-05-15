import type { ApiProfile } from "@shared/storage/state-keys"
import { memo, useCallback } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useExtensionState } from "@/context/ExtensionStateContext"
import ApiOptions from "../ApiOptions"
import ApiProfilesSection from "./ApiProfilesSection"
import SubagentApiConfigurationSection from "./SubagentApiConfigurationSection"
import Section from "../Section"
import { updateSettingsCli } from "../utils/settingsHandlers"

interface ApiConfigurationSectionProps {
	renderSectionHeader?: (tabId: string) => JSX.Element | null
	initialModelTab?: "recommended" | "free"
}

/** Dropdown to bind an API profile to a title-bar button. */
const ProfileButtonBinding = ({
	label,
	profileId,
	profiles,
	onChange,
}: {
	label: string
	profileId: string | undefined
	profiles: ApiProfile[]
	onChange: (id: string) => void
}) => (
	<div className="space-y-1">
		<div className="text-xs">{label}</div>
		<Select onValueChange={onChange} value={profileId || ""}>
			<SelectTrigger className="w-full">
				<SelectValue placeholder="未绑定 Profile" />
			</SelectTrigger>
			<SelectContent>
				{profiles.map((p) => (
					<SelectItem key={p.id} value={p.id}>
						{p.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	</div>
)

/**
 * API 设置：仅保留 OpenAI 兼容所需的 Base URL、API Key、Model ID（对齐 cline_m 的精简配置思路）。
 */
const ApiConfigurationSection = (props: ApiConfigurationSectionProps) => {
	const { mode, apiProfiles, apiProfile1Id, apiProfile2Id } = useExtensionState()
	const profiles: ApiProfile[] = (apiProfiles || []) as any

	const setProfile1 = useCallback((id: string) => updateSettingsCli({ apiProfile1Id: id }), [])
	const setProfile2 = useCallback((id: string) => updateSettingsCli({ apiProfile2Id: id }), [])

	return (
		<div>
			{props.renderSectionHeader?.("api-configuration")}
			<ApiProfilesSection target="main" />

			{/* Profile Button Bindings — choose which profile each title-bar button activates */}
			<div className="mt-2">
				<Section>
					<div className="text-sm font-medium">标题栏按钮 Profile 绑定</div>
					<div className="text-xs text-[var(--vscode-descriptionForeground)]">
						选择每个标题栏按钮点击时激活的 API Profile
					</div>
					<div className="mt-2 grid grid-cols-2 gap-3">
						<ProfileButtonBinding
							label="API Profile 1 按钮"
							profileId={apiProfile1Id}
							profiles={profiles}
							onChange={setProfile1}
						/>
						<ProfileButtonBinding
							label="API Profile 2 按钮"
							profileId={apiProfile2Id}
							profiles={profiles}
							onChange={setProfile2}
						/>
					</div>
				</Section>
			</div>

			<div className="mt-2">
				<ApiOptions currentMode={mode || "act"} initialModelTab={props.initialModelTab} showModelOptions />
			</div>
			<SubagentApiConfigurationSection />
		</div>
	)
}

export default memo(ApiConfigurationSection)
