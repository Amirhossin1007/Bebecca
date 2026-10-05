export type HostClientSettings = Record<string, unknown>;

export const parseHostClientSettings = (value: string): HostClientSettings => {
	const parsed: unknown = JSON.parse(value.trim() || "{}");
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Client settings must be a JSON object.");
	}
	if (new TextEncoder().encode(value).length > 65536) {
		throw new Error("Client settings must not exceed 64 KiB.");
	}
	return parsed as HostClientSettings;
};

export const hostClientSettingsError = (value: string): string | null => {
	try {
		parseHostClientSettings(value);
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : "Invalid client settings.";
	}
};
