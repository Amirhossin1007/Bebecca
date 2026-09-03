import { describe, expect, it } from "vitest";
import { addQuickExpiry } from "./expiry";

describe("addQuickExpiry", () => {
	it("adds repeated shortcuts to the selected expiry", () => {
		const first = addQuickExpiry(new Date("2026-01-15T12:00:00Z"), 1, "month");
		const second = addQuickExpiry(first, 1, "month");

		expect(second.getMonth()).toBe(2);
		expect(second.getDate()).toBe(15);
	});
});
