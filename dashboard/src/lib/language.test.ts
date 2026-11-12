import { describe, expect, it } from "vitest";
import { resolveAppLanguageCode } from "./language";

describe("resolveAppLanguageCode", () => {
	it("maps languageOnly and regional variants to supported app codes", () => {
		expect(resolveAppLanguageCode("zh")).toBe("zh-cn");
		expect(resolveAppLanguageCode("zh-cn")).toBe("zh-cn");
		expect(resolveAppLanguageCode("zh-CN")).toBe("zh-cn");
		expect(resolveAppLanguageCode("zh-Hans")).toBe("zh-cn");
		expect(resolveAppLanguageCode("fa")).toBe("fa");
		expect(resolveAppLanguageCode("fa-IR")).toBe("fa");
		expect(resolveAppLanguageCode("ru")).toBe("ru");
		expect(resolveAppLanguageCode("ru-RU")).toBe("ru");
		expect(resolveAppLanguageCode("en-US")).toBe("en");
		expect(resolveAppLanguageCode(undefined)).toBe("en");
	});
});
