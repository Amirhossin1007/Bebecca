// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	new URL("./AppLayout.tsx", import.meta.url),
	"utf-8",
);

const menuListStart = source.indexOf("<MenuList");
const itemRuleStart = source.indexOf('".chakra-menu__menuitem"', menuListStart);
const logoutRuleStart = source.indexOf('".rb-logout-menu-item"', itemRuleStart);

const sharedRule = source.slice(itemRuleStart, logoutRuleStart);
const logoutRule = source.slice(logoutRuleStart, logoutRuleStart + 2000);

describe("profile menu item styling", () => {
	it("drives menu item backgrounds through the --menu-bg variable", () => {
		const directBg = sharedRule.match(/(^|[\s{,"'])bg:\s*"/g) ?? [];

		expect(
			directBg,
			"no direct bg may shadow Chakra's --menu-bg variable on menu items",
		).toHaveLength(0);

		expect(sharedRule, "shared rule sets --menu-bg").toContain("--menu-bg");
	});

	it("gives the logout item a red hover distinct from the shared item hover", () => {
		expect(logoutRule, "logout rule exists").toContain("red.400");
		expect(logoutRule, "logout hover paints a red background").toContain(
			"rgba(239, 68, 68, 0.16)",
		);
		expect(logoutRule, "logout press paints a stronger red").toContain(
			"rgba(239, 68, 68, 0.26)",
		);
		expect(logoutRule, "logout reacts to hover").toContain("&:hover");
		expect(logoutRule, "logout presses with a scale").toContain("scale(0.98)");
	});

	it("excludes the logout item from the shared neutral hover", () => {
		expect(sharedRule, "shared hover is scoped away from logout").toContain(
			":not(.rb-logout-menu-item)",
		);
	});
});
