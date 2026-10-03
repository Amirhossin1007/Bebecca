import { type FetchOptions, $fetch as ohMyFetch } from "ofetch";
import { create } from "zustand";

type RequestFailure = { key: string; message: string };
export const useAPIRequestErrors = create<{
	errors: RequestFailure[];
	clear: (key?: string) => void;
}>((set) => ({
	errors: [],
	clear: (key) => set((state) => ({ errors: key ? state.errors.filter((item) => item.key !== key) : [] })),
}));

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
	if (typeof value === "string" && value.trim()) {
		if (value.trim().startsWith("{")) {
			try { return errorText(JSON.parse(value)); } catch { /* Keep non-JSON text. */ }
		}
		return value.trim();
	}
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

const fetchWithAPIError = <T>(url: string, ops: FetchOptions<"json"> = {}) => {
	const key = `${String(ops.method || "GET").toUpperCase()} ${url.split("?")[0]}`;
	return rawFetch<T>(url, ops).then((result) => {
		useAPIRequestErrors.getState().clear(key);
		return result;
	}).catch(async (error: unknown) => {
		const response = (error as { response?: { _data?: unknown } } | null)?.response;
		if (typeof Blob !== "undefined" && response?._data instanceof Blob && response._data.size <= 65536) {
			try { response._data = await response._data.text(); } catch { /* Keep the original download error. */ }
		}
		if (!ops.signal?.aborted) reportAPIError(key, error);
		throw error;
	});
};

// Native uploads and metrics streams share the same reporting policy as JSON
// requests, so their callers cannot accidentally swallow backend details.
export const reportAPIError = (key: string, error: unknown) => {
	const message = getAPIErrorMessage(error);
	if (message && error && typeof error === "object") {
		try { (error as { message?: string }).message = message; } catch { /* Some native errors are read-only. */ }
	}
	const status = (error as { response?: { status?: number } } | null)?.response?.status;
	if (message && status !== 401) {
		useAPIRequestErrors.setState((state) => ({
			errors: [{ key, message }, ...state.errors.filter((item) => item.key !== key)].slice(0, 20),
		}));
	}
};

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
