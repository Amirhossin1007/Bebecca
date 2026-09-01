import { describe, expect, it } from "vitest";

import { matchesSearch } from "./searchMatch";

describe("matchesSearch", () => {
	it("supports case-sensitive and whole-word matching", () => {
		expect(matchesSearch("Alpha-beta", "alpha")).toBe(true);
		expect(matchesSearch("Alpha-beta", "alpha", { matchCase: true, matchWholeWord: false })).toBe(false);
		expect(matchesSearch("Alpha-beta", "Alpha", { matchCase: true, matchWholeWord: true })).toBe(true);
		expect(matchesSearch("alphabet", "alpha", { matchCase: false, matchWholeWord: true })).toBe(false);
	});
});
