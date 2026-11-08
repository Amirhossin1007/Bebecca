import type { ApexOptions } from "apexcharts";
import { formatBytes } from "utils/formatByte";

type AreaChartExtras = {
	yTitle?: string;
	xLabelRotate?: number;
};

export const buildUsageAreaOptions = (
	colorMode: string,
	categories: string[],
	extras: AreaChartExtras = {},
): ApexOptions => {
	const axisColor = colorMode === "dark" ? "#d8dee9" : "#1a202c";
	return {
		chart: { type: "area", toolbar: { show: false }, zoom: { enabled: false } },
		dataLabels: { enabled: false },
		stroke: { curve: "smooth", width: 2 },
		fill: {
			type: "gradient",
			gradient: {
				shadeIntensity: 1,
				opacityFrom: 0.35,
				opacityTo: 0.05,
				stops: [0, 80, 100],
			},
		},
		grid: { borderColor: colorMode === "dark" ? "#2D3748" : "#E2E8F0" },
		xaxis: {
			categories,
			labels: {
				style: { colors: categories.map(() => axisColor) },
				...(extras.xLabelRotate === undefined
					? {}
					: { rotate: extras.xLabelRotate }),
			},
			axisBorder: { show: false },
			axisTicks: { show: false },
		},
		yaxis: {
			labels: {
				formatter: (value: number) => formatBytes(Number(value) || 0, 1),
				style: { colors: [axisColor] },
			},
			...(extras.yTitle === undefined
				? {}
				: { title: { text: extras.yTitle, style: { color: axisColor } } }),
		},
		tooltip: {
			theme: colorMode === "dark" ? "dark" : "light",
			shared: true,
			fillSeriesColor: false,
			y: { formatter: (value: number) => formatBytes(Number(value) || 0, 2) },
		},
		colors: [colorMode === "dark" ? "#63B3ED" : "#3182CE"],
	};
};

export const buildUsageDonutOptions = (
	colorMode: string,
	labels: string[],
): ApexOptions => ({
	labels,
	legend: {
		position: "bottom",
		labels: { colors: colorMode === "dark" ? "#d8dee9" : "#1a202c" },
	},
	tooltip: {
		y: {
			formatter: (value: number) => formatBytes(Number(value) || 0, 2),
			title: {
				formatter: (
					seriesName: string,
					opts?: { seriesIndex: number; w: { globals: { labels: string[] } } },
				) => opts?.w?.globals?.labels?.[opts.seriesIndex] ?? seriesName,
			},
		},
	},
	colors: [
		"#3182CE",
		"#63B3ED",
		"#ED8936",
		"#38A169",
		"#9F7AEA",
		"#F6AD55",
		"#4299E1",
		"#E53E3E",
		"#D53F8C",
		"#805AD5",
	],
});
