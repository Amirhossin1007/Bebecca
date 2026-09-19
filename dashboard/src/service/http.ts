import { type FetchOptions, $fetch as ohMyFetch } from "ofetch";

const configuredBaseURL = import.meta.env.VITE_BASE_API || "";

const getDevProxyBaseURL = (baseURL: string) => {
	try {
		const parsed = new URL(baseURL);
		return parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/api";
	} catch {
		return baseURL;
	}
};

export const apiBaseURL =
	import.meta.env.DEV && /^https?:\/\//i.test(configuredBaseURL)
		? getDevProxyBaseURL(configuredBaseURL)
		: configuredBaseURL;

const rawFetch = ohMyFetch.create({
	baseURL: apiBaseURL,
	credentials: "include",
});

const errorText = (value: unknown): string | undefined => {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (Array.isArray(value)) {
		const text = value.map(errorText).filter(Boolean).join(", ");
		return text || undefined;
	}
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	for (const key of ["detail", "msg", "error", "message", "statusMessage", "statusText"]) {
		const text = errorText(record[key]);
		if (text) return text;
	}
	try {
		const serialized = JSON.stringify(record);
		return serialized && serialized !== "{}" ? serialized : undefined;
	} catch {
		return undefined;
	}
};

/** Extract the server's actual error instead of exposing only FetchError. */
export const getAPIErrorMessage = (error: unknown): string | undefined => {
	if (!error || typeof error !== "object") return errorText(error);
	const record = error as Record<string, unknown>;
	const response = record.response as Record<string, unknown> | undefined;
	return (
		errorText(response?._data) ||
		errorText(response?.data) ||
		errorText(record.data) ||
		errorText(error)
	);
};

const fetchWithAPIError = <T>(url: string, ops: FetchOptions<"json"> = {}) =>
	rawFetch<T>(url, ops).catch((error: unknown) => {
		const message = getAPIErrorMessage(error);
		if (message && error && typeof error === "object") {
			(error as { message?: string }).message = message;
		}
		throw error;
	});

export const $fetch = fetchWithAPIError;

export const fetcher = <T = any>(
	url: string,
	ops: FetchOptions<"json"> = {},
) => {
	const method = String(ops.method || "GET").toUpperCase();
	ops.credentials = "include";
	if (method === "GET") {
		ops.cache = "no-store";
	}
	return $fetch<T>(url, ops);
};

export const fetch = fetcher;
