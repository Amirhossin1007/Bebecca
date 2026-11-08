import { fetch } from "service/http";

export type PropagationSection = "routing.rules" | "outbounds" | "balancers";

export type PropagationStatus = "ok" | "missing" | "different" | "conflict";

export type PropagationOp = {
	source: string;
	section: PropagationSection;
	before: unknown | null;
	after: unknown | null;
	targets: string[];
};

export type PropagationTarget = {
	id: string;
	name: string;
	status: PropagationStatus;
	applied?: boolean;
	error?: string;
};

const isEmptyValue = (value: unknown) =>
	value === undefined ||
	value === null ||
	value === "" ||
	(Array.isArray(value) && value.length === 0) ||
	(typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === 0);

const canonicalize = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object") {
		const source = value as Record<string, unknown>;
		return Object.keys(source)
			.sort()
			.reduce<Record<string, unknown>>((acc, key) => {
				const item = canonicalize(source[key]);
				if (!isEmptyValue(item)) acc[key] = item;
				return acc;
			}, {});
	}
	return value;
};

export const propagationKey = (value: unknown) =>
	JSON.stringify(canonicalize(value) ?? null);

export const previewXrayPropagation = (
	op: Omit<PropagationOp, "targets">,
) =>
	fetch<{ targets: PropagationTarget[] }>("/core/config/propagate/preview", {
		method: "POST",
		body: { ...op, targets: [] },
	}).then((response) => response?.targets || []);

export const applyXrayPropagation = (op: PropagationOp) =>
	fetch<{ targets: PropagationTarget[] }>("/core/config/propagate", {
		method: "POST",
		body: op,
	}).then((response) => response?.targets || []);
