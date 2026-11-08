import { describe, expect, it } from "vitest";
import {
	buildUsageAreaOptions,
	buildUsageDonutOptions,
} from "./usageChartOptions";

describe("usage chart options", () => {
	it("keeps the plain area chart when no extras are given", () => {
		const options = buildUsageAreaOptions("light", ["a", "b"]);
		expect(options.chart).toMatchObject({ type: "area" });
		expect(options.xaxis).not.toHaveProperty("labels.rotate");
		expect(options.yaxis).not.toHaveProperty("title");
		expect(options.colors).toEqual(["#3182CE"]);
	});

	it("adds the rotation and the axis title only when asked", () => {
		const options = buildUsageAreaOptions("dark", ["a"], {
			yTitle: "Traffic",
			xLabelRotate: 0,
		});
		expect(options.xaxis).toMatchObject({ labels: { rotate: 0 } });
		expect(options.yaxis).toMatchObject({
			title: { text: "Traffic", style: { color: "#d8dee9" } },
		});
		expect(options.colors).toEqual(["#63B3ED"]);
	});

	it("builds the donut with the shared palette and legend colour", () => {
		const options = buildUsageDonutOptions("dark", ["x", "y"]);
		expect(options.labels).toEqual(["x", "y"]);
		expect(options.legend).toMatchObject({
			position: "bottom",
			labels: { colors: "#d8dee9" },
		});
		expect(options.colors).toHaveLength(10);
	});
});
