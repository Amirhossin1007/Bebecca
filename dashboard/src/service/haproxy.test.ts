import { describe, expect, it } from "vitest";
import {
	cloneHAProxyTargetForNode,
	type HAProxyCandidate,
	type HAProxyTarget,
	preferredHAProxyMatcher,
} from "./haproxy";

const source: HAProxyTarget = {
	node_id: 1,
	listeners: [
		{
			name: "shared-443",
			listen_address: "0.0.0.0",
			listen_port: 443,
			accept_proxy_protocol: false,
			routes: [
				{
					name: "demo-ws",
					source: "xray",
					inbound_tag: "demo-ws",
					protocol: "vless",
					backend_host: "127.0.0.1",
					backend_port: 10001,
					match_type: "http_path",
					match_value: "/demo",
				},
			],
			sites: [
				{
					enabled: true,
					source: "templatemo",
					template_id: "111-first",
					template_url: "https://templatemo.com/tm-111-first",
				},
				{
					enabled: true,
					source: "templatemo",
					template_id: "222-second",
				},
			],
		},
	],
};

const candidates: HAProxyCandidate[] = [
	{
		tag: "demo-ws",
		protocol: "vless",
		network: "ws",
		port: 20002,
		matchers: [{ type: "http_path", value: "/demo" }],
	},
];

describe("cloneHAProxyTargetForNode", () => {
	it("updates node-specific inbound ports and randomizes TemplateMo sites", () => {
		const result = cloneHAProxyTargetForNode(
			source,
			2,
			candidates,
			[
				{ id: "111-first", name: "First" },
				{ id: "222-second", name: "Second" },
			],
			true,
			() => 0,
		);
		expect(result.missingInbounds).toEqual([]);
		expect(result.target?.node_id).toBe(2);
		expect(result.target?.listeners[0].routes[0].backend_port).toBe(20002);
		expect(
			result.target?.listeners[0].sites?.map((site) => site.template_id),
		).toEqual(["222-second", "111-first"]);
		expect(result.target?.listeners[0].sites?.[0].template_url).toBe("");
		expect(source.node_id).toBe(1);
	});

	it("refuses a node when an Xray matcher is unavailable", () => {
		const result = cloneHAProxyTargetForNode(source, 3, [], [], false);
		expect(result.target).toBeUndefined();
		expect(result.missingInbounds).toEqual(["demo-ws"]);
	});
});

describe("preferredHAProxyMatcher", () => {
	it("prefers SNI, then HTTP path, HTTP host, and default", () => {
		expect(
			preferredHAProxyMatcher([
				{ type: "default", value: "" },
				{ type: "http_host", value: "host.example.com" },
				{ type: "http_path", value: "/edge" },
				{ type: "sni", value: "sni.example.com" },
			]),
		).toEqual({ type: "sni", value: "sni.example.com" });
		expect(
			preferredHAProxyMatcher([
				{ type: "http_host", value: "host.example.com" },
				{ type: "http_path", value: "/edge" },
			]),
		).toEqual({ type: "http_path", value: "/edge" });
	});
});
