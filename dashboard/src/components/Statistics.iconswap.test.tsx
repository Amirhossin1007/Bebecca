import { ChakraProvider } from "@chakra-ui/react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../chakra.config";
import { Statistics } from "./Statistics";

Object.assign(globalThis, { React });

vi.mock("hooks/useGetUser", () => ({
	default: () => ({
		userData: { username: "tester", role: "sudo", status: "active" },
		getUserIsSuccess: true,
		getUserIsLoading: false,
		isError: false,
		error: null,
		refetch: () => Promise.resolve(),
	}),
}));

vi.mock("react-apexcharts", () => ({
	default: () => null,
}));

vi.mock("utils/userPreferenceStorage", () => ({
	NUM_PER_PAGE_DEFAULT: 10,
	getUsersPerPageLimitSize: () => 10,
	setUsersPerPageLimitSize: () => {},
	getAllUserPreferences: () => ({}),
	setUserPreference: () => {},
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { dir: () => "ltr", language: "en" },
	}),
	Trans: ({ i18nKey }: { i18nKey: string }) =>
		React.createElement("span", null, i18nKey),
}));

const makeClient = () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	client.setQueryData(["current-admin"], {
		username: "tester",
		role: "sudo",
		status: "active",
	});
	client.setQueryData(["statistics-query-key"], {
		version: "1.0.0",
		os: "Ubuntu 24.04",
		uptime: 100000,
		system_uptime: 200000,
		panel_uptime: 300000,
		cpu_cores: 4,
		cpu_threads: 8,
		cpu_usage: 12,
		total_user: 5,
		online_users: 2,
		incoming_bandwidth: 100,
		outgoing_bandwidth: 200,
		incoming_bandwidth_speed: 1024,
		outgoing_bandwidth_speed: 2048,
		memory: { total: 1000, used: 400, free: 600, percent: 40 },
		disk: { total: 1000, used: 400, free: 600, percent: 40 },
		cpu_history: [],
		network_history: [],
		admin_overview: {
			total_admins: 2,
			sudo_admins: 1,
			full_access_admins: 0,
			standard_admins: 1,
			top_admin_username: "tester",
			top_admin_usage: 10,
		},
	});
	return client;
};

const render = () =>
	renderToStaticMarkup(
		React.createElement(
			ChakraProvider,
			{ theme },
			React.createElement(
				MemoryRouter,
				null,
				React.createElement(
					QueryClientProvider,
					{ client: makeClient() },
					React.createElement(Statistics as React.FC<Record<string, never>>),
				),
			),
		),
	);

describe("Statistics icon color swap", () => {
	it("marks every labelled card icon with data-rb-icon", () => {
		const html = render();

		const labels = [
			"dashboard.system.bandwidthSpeed",
			"dashboard.system.incomingSpeed",
			"dashboard.system.outgoingSpeed",
			"dashboard.system.uptime",
			"dashboard.system.systemUptime",
			"dashboard.system.panelUptime",
			"dashboard.admins",
		];

		for (const key of labels) {
			expect(html, `renders label ${key}`).toContain(key);
		}

		const iconCount = (html.match(/data-rb-icon/g) ?? []).length;
		expect(iconCount, "icons marked for color swap").toBeGreaterThanOrEqual(
			labels.length,
		);

		const swapCount = (html.match(/data-rb-iconswap/g) ?? []).length;
		expect(swapCount, "cards with iconswap enabled").toBeGreaterThan(0);

		const iconBoxes = (html.match(/data-rb-icon=""/g) ?? []).length;
		expect(
			iconBoxes,
			"every icon box carries data-rb-icon in empty-string form",
		).toBeGreaterThanOrEqual(labels.length);
	});

	it("inverts the icon box away from the card hover colour", () => {
		const html = render();

		const cardHover =
			html.match(
				/\.css-\w+:hover,\.css-\w+\[data-hover\]\{[^}]*background:([^;}]+)/,
			)?.[1] ?? "";
		const iconHover =
			html.match(/:hover \[data-rb-icon\]\{[^}]*background:([^;!}]+)/)?.[1] ??
			"";

		expect(cardHover, "card hover background declared").toBeTruthy();
		expect(iconHover, "icon box hover background declared").toBeTruthy();

		expect(
			iconHover.trim(),
			"icon box hover must differ from the card hover colour",
		).not.toBe(cardHover.trim());

		expect(iconHover).toContain("rb-panel-surface");
	});
});
