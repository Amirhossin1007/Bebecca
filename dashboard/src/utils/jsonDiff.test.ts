import { describe, expect, it } from "vitest";
import { buildJsonDiff } from "./jsonDiff";

describe("buildJsonDiff", () => {
	it("marks only the changed JSON line", () => {
		const diff = buildJsonDiff(
			{ name: "name", enabled: true },
			{ name: "newname", enabled: true },
		);

		expect(diff).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "remove",
					text: '  "name": "name",',
					beforeLine: 2,
				}),
				expect.objectContaining({
					type: "add",
					text: '  "name": "newname",',
					afterLine: 2,
				}),
				expect.objectContaining({ type: "context", text: '  "enabled": true' }),
			]),
		);
	});

	it("keeps unchanged lines between separate changes", () => {
		const diff = buildJsonDiff(
			{ first: "old", unchanged: true, last: "old" },
			{ first: "new", unchanged: true, last: "new" },
		);

		expect(
			diff.filter((line) => line.type === "context").map((line) => line.text),
		).toContain('  "unchanged": true,');
	});
});
