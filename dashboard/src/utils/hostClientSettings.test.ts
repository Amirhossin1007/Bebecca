import { describe, expect, it } from "vitest";
import { hostClientSettingsError, parseHostClientSettings } from "./hostClientSettings";

describe("host client settings", () => {
	it("preserves explicit disabled values and nested per-host options", () => {
		expect(parseHostClientSettings('{"tlsSettings":{"echConfigList":"","enableSessionResumption":false}}')).toEqual({ tlsSettings: { echConfigList: "", enableSessionResumption: false } });
		expect(parseHostClientSettings("")).toEqual({});
	});
	it("rejects invalid JSON, non-objects and oversized payloads", () => {
		for (const value of ["{", "[]", "null", "false", '"value"', JSON.stringify({ value: "a".repeat(65536) })]) {
			expect(hostClientSettingsError(value)).not.toBeNull();
		}
		expect(hostClientSettingsError('{"sockopt":{"tcpFastOpen":true}}')).toBeNull();
	});
});
