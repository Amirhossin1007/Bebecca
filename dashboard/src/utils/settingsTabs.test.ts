import { describe, expect, it } from "vitest";
import { parseSettingsHash } from "./settingsTabs";

describe("parseSettingsHash", () => {
	it("selects direct tabs and keeps focus parameters", () => {
		expect(parseSettingsHash("#ssl").index).toBe(3);
		expect(parseSettingsHash("#telegram?focus=periodic-backup")).toEqual({
			tab: "telegram",
			focus: "periodic-backup",
			index: 1,
		});
		expect(parseSettingsHash("").index).toBe(0);
	});
});
