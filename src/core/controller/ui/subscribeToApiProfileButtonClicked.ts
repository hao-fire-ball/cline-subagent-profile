import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { Logger } from "@/shared/services/Logger"
import { getRequestRegistry, StreamingResponseHandler } from "../grpc-handler"
import type { Controller } from "../index"

// Keep track of active API profile 1 button clicked subscriptions
const activeApiProfile1ButtonClickedSubscriptions = new Set<StreamingResponseHandler<Empty>>()

// Keep track of active API profile 2 button clicked subscriptions
const activeApiProfile2ButtonClickedSubscriptions = new Set<StreamingResponseHandler<Empty>>()

/**
 * Subscribe to API profile 1 button clicked events
 */
export async function subscribeToApiProfile1ButtonClicked(
	_controller: Controller,
	_request: EmptyRequest,
	responseStream: StreamingResponseHandler<Empty>,
	requestId?: string,
): Promise<void> {
	activeApiProfile1ButtonClickedSubscriptions.add(responseStream)

	const cleanup = () => {
		activeApiProfile1ButtonClickedSubscriptions.delete(responseStream)
	}

	if (requestId) {
		getRequestRegistry().registerRequest(
			requestId,
			cleanup,
			{ type: "api_profile_1_button_clicked_subscription" },
			responseStream,
		)
	}
}

/**
 * Subscribe to API profile 2 button clicked events
 */
export async function subscribeToApiProfile2ButtonClicked(
	_controller: Controller,
	_request: EmptyRequest,
	responseStream: StreamingResponseHandler<Empty>,
	requestId?: string,
): Promise<void> {
	activeApiProfile2ButtonClickedSubscriptions.add(responseStream)

	const cleanup = () => {
		activeApiProfile2ButtonClickedSubscriptions.delete(responseStream)
	}

	if (requestId) {
		getRequestRegistry().registerRequest(
			requestId,
			cleanup,
			{ type: "api_profile_2_button_clicked_subscription" },
			responseStream,
		)
	}
}

/**
 * Send API profile 1 button clicked event to all active subscribers
 */
export async function sendApiProfile1ButtonClickedEvent(): Promise<void> {
	const promises = Array.from(activeApiProfile1ButtonClickedSubscriptions).map(async (responseStream) => {
		try {
			const event = Empty.create({})
			await responseStream(event, false)
		} catch (error) {
			Logger.error("Error sending API profile 1 button clicked event:", error)
			activeApiProfile1ButtonClickedSubscriptions.delete(responseStream)
		}
	})

	await Promise.all(promises)
}

/**
 * Send API profile 2 button clicked event to all active subscribers
 */
export async function sendApiProfile2ButtonClickedEvent(): Promise<void> {
	const promises = Array.from(activeApiProfile2ButtonClickedSubscriptions).map(async (responseStream) => {
		try {
			const event = Empty.create({})
			await responseStream(event, false)
		} catch (error) {
			Logger.error("Error sending API profile 2 button clicked event:", error)
			activeApiProfile2ButtonClickedSubscriptions.delete(responseStream)
		}
	})

	await Promise.all(promises)
}
