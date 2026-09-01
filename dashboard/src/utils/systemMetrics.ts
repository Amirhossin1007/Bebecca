import type {
	HistoryEntry,
	NetworkHistoryEntry,
	SystemStats,
} from "types/System";

const HISTORY_MAX_ENTRIES = 600;
const HISTORY_SAMPLE_SECONDS = 30;

const appendHistory = <T extends { timestamp: number }>(
	entries: T[] | null | undefined,
	entry: T,
): T[] => {
	const current = Array.isArray(entries) ? entries : [];
	const last = current[current.length - 1];
	if (!last) return [entry];
	if (entry.timestamp - last.timestamp < HISTORY_SAMPLE_SECONDS) {
		return [...current.slice(0, -1), { ...entry, timestamp: last.timestamp }];
	}
	return [...current, entry].slice(-HISTORY_MAX_ENTRIES);
};

export const mergeLiveSystemStats = (
	current: SystemStats | undefined,
	next: SystemStats,
	timestamp = Math.floor(Date.now() / 1000),
): SystemStats => ({
	...current,
	...next,
	cpu_history: appendHistory(current?.cpu_history, {
		timestamp,
		value: next.cpu_usage,
	}),
	memory_history: appendHistory(current?.memory_history, {
		timestamp,
		value: next.memory.percent,
	}),
	swap_history: appendHistory(current?.swap_history, {
		timestamp,
		value: next.swap.percent,
	}),
	disk_history: appendHistory(current?.disk_history, {
		timestamp,
		value: next.disk.percent,
	}),
	network_history: appendHistory<NetworkHistoryEntry>(current?.network_history, {
		timestamp,
		incoming: next.incoming_bandwidth_speed,
		outgoing: next.outgoing_bandwidth_speed,
	}),
	panel_cpu_history: appendHistory(current?.panel_cpu_history, {
		timestamp,
		value: next.panel_cpu_percent,
	}),
	panel_memory_history: appendHistory(current?.panel_memory_history, {
		timestamp,
		value: next.panel_memory_percent,
	}),
});

export const sampleSparklineValues = (
	values: number[],
	maxPoints = 80,
): number[] => {
	if (values.length <= maxPoints || maxPoints < 2) return values;
	const lastIndex = values.length - 1;
	return Array.from(
		{ length: maxPoints },
		(_, index) => values[Math.round((index * lastIndex) / (maxPoints - 1))],
	);
};

export type { HistoryEntry };
