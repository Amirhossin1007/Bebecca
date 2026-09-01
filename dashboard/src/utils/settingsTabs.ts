export const integrationTabKeys = [
	"panel",
	"telegram",
	"subscriptions",
	"ssl",
] as const;

export const parseSettingsHash = (value: string) => {
	const [tabWithQuery = ""] = value.replace(/^#/, "").split("#").filter(Boolean);
	const [tab = "", query = ""] = tabWithQuery.split("?");
	const index = integrationTabKeys.findIndex(
		(key) => key.toLowerCase() === tab.toLowerCase(),
	);
	return {
		tab,
		focus: query ? new URLSearchParams(query).get("focus") || "" : "",
		index: index >= 0 ? index : 0,
	};
};
