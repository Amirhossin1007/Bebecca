import type { CoreConfigTarget } from "contexts/CoreSettingsContext";
import type { RawInbound } from "utils/inbounds";
import { describe, expect, it } from "vitest";
import {
	getCustomNodeTargetIds,
	getInboundTargetIds,
	sortInboundTargets,
} from "./inboundTargets";

const target = (
	id: string,
	type: CoreConfigTarget["type"],
	mode: CoreConfigTarget["mode"],
) => ({ id, type, mode, name: id, node_id: null }) as CoreConfigTarget;

const targets = [
	target("master", "master", "custom"),
	target("node-1", "node", "default"),
	target("node-2", "node", "custom"),
	target("node-3", "node", "default"),
	target("node-4", "node", "custom"),
];

describe("sortInboundTargets", () => {
	it("lists the default target first, then custom nodes, then default nodes", () => {
		const input = [targets[1], targets[2], targets[0], targets[3], targets[4]];
		expect(sortInboundTargets(input).map((item) => item.id)).toEqual([
			"master",
			"node-2",
			"node-4",
			"node-1",
			"node-3",
		]);
		expect(input[0].id).toBe("node-1");
	});
});

describe("getCustomNodeTargetIds", () => {
	it("returns only custom nodes, never the default target or default nodes", () => {
		expect(getCustomNodeTargetIds(targets)).toEqual(["node-2", "node-4"]);
	});
});

describe("getInboundTargetIds", () => {
	it("uses the selected targets and ignores the nodes that inherit the default", () => {
		const inbound = {
			targets: ["master", "node-2"],
			effective_targets: ["master", "node-1", "node-2", "node-3"],
		} as RawInbound;
		expect(getInboundTargetIds(inbound)).toEqual(["master", "node-2"]);
		expect(getInboundTargetIds({} as RawInbound)).toEqual(["master"]);
	});
});
