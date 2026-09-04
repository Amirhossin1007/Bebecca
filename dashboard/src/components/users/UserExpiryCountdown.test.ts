import { describe, expect, it } from "vitest";
import { formatExpiryClock, formatExpiryDuration } from "./UserExpiryCountdown";

describe("formatExpiryDuration", () => {
	it("keeps expiry labels short and stable", () => {
		expect(formatExpiryDuration(59 * 86400)).toBe("1M, 29D");
		expect(formatExpiryDuration(400 * 86400)).toBe("1Y, 1M");
		expect(formatExpiryDuration(3599)).toBe("<1H");
	});

	it("formats the live under-24-hour countdown", () => {
		expect(formatExpiryClock(86399)).toBe("23:59:59");
		expect(formatExpiryClock(1)).toBe("00:00:01");
	});
});
