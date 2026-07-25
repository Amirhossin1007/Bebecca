import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("service/http", () => ({ fetch: vi.fn() }));

import { fetch as apiFetch } from "service/http";

import { useCoreSettings } from "./CoreSettingsContext";

type PendingRequest = { resolve: (value: unknown) => void };

describe("fetchCoreSettings", () => {
	afterEach(() => {
		vi.clearAllMocks();
		useCoreSettings.setState({ config: null, configTargets: [] });
	});

	it("keeps a newer target response when an older request finishes last", async () => {
		const pending: PendingRequest[] = [];
		vi.mocked(apiFetch).mockImplementation(
			() =>
				new Promise((resolve) => {
					pending.push({ resolve });
				}),
		);

		const first = useCoreSettings.getState().fetchCoreSettings("master");
		const second = useCoreSettings.getState().fetchCoreSettings("node-1");

		pending[3].resolve({ version: "new", started: true, logs_websocket: null });
		pending[4].resolve({ tag: "node-1" });
		pending[5].resolve({
			targets: [
				{
					id: "node-1",
					type: "node",
					name: "Node",
					node_id: 1,
					mode: "custom",
				},
			],
		});
		await second;

		pending[0].resolve({
			version: "old",
			started: false,
			logs_websocket: null,
		});
		pending[1].resolve({ tag: "master" });
		pending[2].resolve({ targets: [] });
		await first;

		expect(useCoreSettings.getState().config).toEqual({ tag: "node-1" });
	});
});
