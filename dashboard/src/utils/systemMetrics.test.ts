import { describe, expect, it } from "vitest";
import type { SystemStats } from "types/System";
import { mergeLiveSystemStats, sampleSparklineValues } from "./systemMetrics";

const stats = (cpu: number): SystemStats =>
	({
		cpu_usage: cpu,
		memory: { percent: 20 },
		swap: { percent: 0 },
		disk: { percent: 30 },
		incoming_bandwidth_speed: 40,
		outgoing_bandwidth_speed: 50,
		panel_cpu_percent: 5,
		panel_memory_percent: 6,
	}) as SystemStats;

describe("system metric history", () => {
	it("updates one sample per 30-second window", () => {
		const first = mergeLiveSystemStats(undefined, stats(10), 100);
		const updated = mergeLiveSystemStats(first, stats(20), 105);
		const appended = mergeLiveSystemStats(updated, stats(30), 130);

		expect(updated.cpu_history).toEqual([{ timestamp: 100, value: 20 }]);
		expect(appended.cpu_history).toEqual([
			{ timestamp: 100, value: 20 },
			{ timestamp: 130, value: 30 },
		]);
	});

	it("keeps sparklines bounded while preserving both ends", () => {
		const values = Array.from({ length: 1000 }, (_, index) => index);
		const sampled = sampleSparklineValues(values, 80);
		expect(sampled).toHaveLength(80);
		expect(sampled[0]).toBe(0);
		expect(sampled.at(-1)).toBe(999);
	});
});
