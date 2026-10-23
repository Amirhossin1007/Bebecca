import type { NodeType } from "contexts/NodesContext";
import type { Admin } from "types/Admin";
import { getInboundTraffic, type RawInbound } from "utils/inbounds";

export type InboundSpeedMap = Record<
	string,
	{ upload_speed: number; download_speed: number }
>;

const positive = (value: number | null | undefined) =>
	typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

export const summarizeNodes = (nodes: NodeType[]) => {
	const summary = {
		total: nodes.length,
		connected: 0,
		connecting: 0,
		error: 0,
		limited: 0,
		disabled: 0,
		upload: 0,
		download: 0,
		usage: 0,
		uploadSpeed: 0,
		downloadSpeed: 0,
	};
	for (const node of nodes) {
		summary.upload += positive(node.uplink);
		summary.download += positive(node.downlink);
		switch (node.status) {
			case "connected":
				summary.connected += 1;
				summary.uploadSpeed += positive(node.upload_speed);
				summary.downloadSpeed += positive(node.download_speed);
				break;
			case "connecting":
				summary.connecting += 1;
				break;
			case "error":
				summary.error += 1;
				break;
			case "limited":
				summary.limited += 1;
				break;
			case "disabled":
				summary.disabled += 1;
				break;
		}
	}
	summary.usage = summary.upload + summary.download;
	return summary;
};

export const summarizeInbounds = (
	inbounds: RawInbound[],
	speeds: InboundSpeedMap,
) => {
	const summary = {
		upload: 0,
		download: 0,
		total: 0,
		uploadSpeed: 0,
		downloadSpeed: 0,
	};
	for (const inbound of inbounds) {
		const traffic = getInboundTraffic(inbound);
		summary.upload += traffic.upload;
		summary.download += traffic.download;
		const speed = speeds[inbound.tag];
		summary.uploadSpeed += positive(speed?.upload_speed);
		summary.downloadSpeed += positive(speed?.download_speed);
	}
	summary.total = summary.upload + summary.download;
	return summary;
};

export const summarizeAdmins = (admins: Admin[]) => {
	const summary = { users: 0, online: 0, usage: 0 };
	for (const admin of admins) {
		summary.users += positive(admin.users_count);
		summary.online += positive(admin.online_users);
		summary.usage += positive(admin.users_usage);
	}
	return summary;
};
