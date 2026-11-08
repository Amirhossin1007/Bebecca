import { describe, expect, it } from "vitest";

import { getAPIErrorMessage } from "./http";

describe("getAPIErrorMessage", () => {
	it("prefers the backend detail over the generic fetch error", () => {
		expect(
			getAPIErrorMessage({
				message: "FetchError: 502",
				response: { _data: { detail: "node health check failed" } },
			}),
		).toBe("node health check failed");
	});

	it("formats validation details without hiding their fields", () => {
		expect(
			getAPIErrorMessage({ response: { data: { detail: { port: "is busy" } } } }),
		).toBe('{"port":"is busy"}');
	});
});
