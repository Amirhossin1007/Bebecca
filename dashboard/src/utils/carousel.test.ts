import { describe, expect, it } from "vitest";
import { getSwipeTargetIndex } from "./carousel";

describe("getSwipeTargetIndex", () => {
	it("moves in both directions and wraps around", () => {
		expect(getSwipeTargetIndex(0, 3, -50)).toBe(1);
		expect(getSwipeTargetIndex(0, 3, 50)).toBe(2);
	});
});
