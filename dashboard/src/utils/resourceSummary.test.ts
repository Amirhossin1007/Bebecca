import type { NodeType } from "contexts/NodesContext";
import type { Admin } from "types/Admin";
import type { RawInbound } from "utils/inbounds";
import { describe, expect, it } from "vitest";
import {
	summarizeAdmins,
	summarizeInbounds,
	summarizeNodes,
} from "./resourceSummary";

const node = (overrides: Partial<NodeType>) =>
	({ name: "node", address: "203.0.113.1", ...overrides }) as NodeType;
const inbound = (overrides: Partial<RawInbound>) =>
	({ tag: "vless", ...overrides }) as RawInbound;
const admin = (overrides: Partial<Admin>) =>
	({ id: 1, username: "admin", ...overrides }) as Admin;

describe("summarizeNodes", () => {
	it("counts statuses, sums usage, and only adds speeds of connected nodes", () => {
		const summary = summarizeNodes([
			node({ status: "connected", uplink: 1000, downlink: 2000, upload_speed: 10, download_speed: 20 }),
			node({ status: "connected", uplink: 5, downlink: 5, upload_speed: null, download_speed: null }),
			node({ status: "disabled", uplink: 10, downlink: 0, upload_speed: 999, download_speed: 999 }),
			node({ status: "connecting" }),
			node({ status: "error" }),
			node({ status: "limited" }),
		]);
		expect(summary).toMatchObject({
			total: 6,
			connected: 2,
			connecting: 1,
			error: 1,
			limited: 1,
			disabled: 1,
			upload: 1015,
			download: 2005,
			usage: 3020,
			uploadSpeed: 10,
			downloadSpeed: 20,
		});
	});
});

describe("summarizeInbounds", () => {
	it("sums traffic and speeds of the listed inbounds only", () => {
		const summary = summarizeInbounds(
			[
				inbound({ tag: "a", uplink: 100, downlink: 300 }),
				inbound({ tag: "b", uplink: 50, downlink: 0 }),
			],
			{
				a: { upload_speed: 4, download_speed: 8 },
				other: { upload_speed: 1000, download_speed: 1000 },
			},
		);
		expect(summary).toEqual({
			upload: 150,
			download: 300,
			total: 450,
			uploadSpeed: 4,
			downloadSpeed: 8,
		});
	});
});

describe("summarizeAdmins", () => {
	it("ignores missing and negative values", () => {
		const summary = summarizeAdmins([
			admin({ users_count: 10, online_users: 3, users_usage: 1000 }),
			admin({ users_count: null, online_users: -5, users_usage: undefined }),
			admin({ users_count: 5, online_users: 1, users_usage: 24 }),
		]);
		expect(summary).toEqual({ users: 15, online: 4, usage: 1024 });
	});
});
