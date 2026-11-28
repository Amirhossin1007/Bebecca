export type UserIPRecord = {
	node_id: number;
	node_name?: string;
	node_names?: string[];
	protocol: string;
	protocols?: string[];
	inbound_tag?: string;
	inbound_tags?: string[];
	session_id?: string;
	ip?: string;
	assigned_ip?: string;
	assigned_ips?: string[];
	connections?: number;
	operator_short_name?: string;
	operator_owner?: string;
	last_seen_at?: string;
};

export type UserIPsResponse = {
	username: string;
	ips: UserIPRecord[];
};

export type UserIPDialogState = {
	username: string;
	records: UserIPRecord[];
	error?: string;
};

export const uniqueIPValues = (values: Array<string | undefined>): string[] =>
	Array.from(
		new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
	).sort();

export const deduplicateUserIPRecords = (
	records: UserIPRecord[],
): UserIPRecord[] => {
	const byIP = new Map<string, UserIPRecord>();
	for (const record of records) {
		const ip = (record.ip || record.assigned_ip || "").trim();
		const key =
			ip || `${record.node_id}:${record.protocol}:${record.session_id || ""}`;
		const current = byIP.get(key);
		if (!current) {
			byIP.set(key, {
				...record,
				ip,
				connections: Math.max(record.connections || 1, 1),
				node_names: uniqueIPValues([
					...(record.node_names || []),
					record.node_name,
				]),
				protocols: uniqueIPValues([
					...(record.protocols || []),
					record.protocol,
				]),
				inbound_tags: uniqueIPValues([
					...(record.inbound_tags || []),
					record.inbound_tag,
				]),
				assigned_ips: uniqueIPValues([
					...(record.assigned_ips || []),
					record.assigned_ip,
				]),
			});
			continue;
		}
		current.connections =
			(current.connections || 1) + Math.max(record.connections || 1, 1);
		current.node_names = uniqueIPValues([
			...(current.node_names || []),
			...(record.node_names || []),
			record.node_name,
		]);
		current.protocols = uniqueIPValues([
			...(current.protocols || []),
			...(record.protocols || []),
			record.protocol,
		]);
		current.inbound_tags = uniqueIPValues([
			...(current.inbound_tags || []),
			...(record.inbound_tags || []),
			record.inbound_tag,
		]);
		current.assigned_ips = uniqueIPValues([
			...(current.assigned_ips || []),
			...(record.assigned_ips || []),
			record.assigned_ip,
		]);
		if ((record.last_seen_at || "") > (current.last_seen_at || "")) {
			current.last_seen_at = record.last_seen_at;
		}
		if (!current.operator_short_name) {
			current.operator_short_name = record.operator_short_name;
		}
		if (!current.operator_owner) {
			current.operator_owner = record.operator_owner;
		}
	}
	return Array.from(byIP.values()).sort((left, right) =>
		(right.last_seen_at || "").localeCompare(left.last_seen_at || ""),
	);
};

export const formatUserIPRecords = (
	records: UserIPRecord[],
	emptyLabel: string,
): string => {
	if (records.length === 0) {
		return emptyLabel;
	}
	return records
		.map((record) => {
			const nodes = uniqueIPValues([
				...(record.node_names || []),
				record.node_name || `node-${record.node_id}`,
			]);
			const protocols = uniqueIPValues([
				...(record.protocols || []),
				record.protocol,
			]);
			const inbounds = uniqueIPValues([
				...(record.inbound_tags || []),
				record.inbound_tag,
			]);
			const ip = record.ip || record.assigned_ip || "-";
			const assigned = uniqueIPValues([
				...(record.assigned_ips || []),
				record.assigned_ip,
			]).filter((value) => value !== ip);
			const operator = record.operator_short_name || record.operator_owner;
			return `${protocols.join(", ")}${inbounds.length ? ` (${inbounds.join(", ")})` : ""} @ ${nodes.join(", ")}: ${ip}${assigned.length ? ` assigned=${assigned.join(",")}` : ""}${operator ? ` operator=${operator}` : ""}`;
		})
		.join("\n");
};
