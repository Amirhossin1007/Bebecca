import { describe, expect, it } from "vitest";
import { createStableCellRegistry } from "./stableCell";

describe("createStableCellRegistry", () => {
	it("returns the same cell function for an id and renders the latest callback", () => {
		const stableCell = createStableCellRegistry<string>();
		const first = stableCell("actions", (value) => `first:${value}`);
		const second = stableCell("actions", (value) => `second:${value}`);

		expect(second).toBe(first);
		expect(second("row")).toBe("second:row");
	});

	it("keeps separate ids apart", () => {
		const stableCell = createStableCellRegistry<string>();
		const actions = stableCell("actions", (value) => `actions:${value}`);
		const speed = stableCell("column:speed", (value) => `speed:${value}`);

		expect(speed).not.toBe(actions);
		expect(actions("a")).toBe("actions:a");
		expect(speed("b")).toBe("speed:b");
	});
});
