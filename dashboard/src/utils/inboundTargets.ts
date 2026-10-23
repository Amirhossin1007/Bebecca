import type { CoreConfigTarget } from "contexts/CoreSettingsContext";
import type { RawInbound } from "utils/inbounds";

const targetRank = (target: CoreConfigTarget) => {
	if (target.type === "master") return 0;
	return target.mode === "custom" ? 1 : 2;
};

export const sortInboundTargets = (targets: CoreConfigTarget[]) =>
	[...targets].sort((a, b) => targetRank(a) - targetRank(b));

export const getCustomNodeTargetIds = (targets: CoreConfigTarget[]) =>
	targets
		.filter((target) => target.type === "node" && target.mode === "custom")
		.map((target) => target.id);

export const getInboundTargetIds = (inbound: RawInbound) =>
	inbound.targets?.length ? inbound.targets : ["master"];
