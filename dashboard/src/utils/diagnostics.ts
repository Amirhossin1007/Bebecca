export type DiagnosticSeverity = "critical" | "error" | "warning";

export type Diagnostic = {
	target_id: string;
	resource_type: string;
	resource: string;
	message: string;
	severity?: DiagnosticSeverity;
};

export const diagnosticSeverity = (issue: Diagnostic): DiagnosticSeverity =>
	issue.severity ||
	(issue.resource_type === "runtime_warning" ? "warning" : "error");

export const isCriticalDiagnostic = (issue: Diagnostic) =>
	diagnosticSeverity(issue) === "critical";

export const dashboardDiagnostics = (
	issues: Diagnostic[],
	legacyRuntime?: { xray_running: boolean; last_xray_error?: string | null },
) => {
	const critical = issues.filter(isCriticalDiagnostic);
	// Older APIs expose only the last node error. Do not treat it as an outage
	// while any core is running, or infer severity from its wording.
	if (
		!critical.length &&
		legacyRuntime?.last_xray_error &&
		!legacyRuntime.xray_running
	) {
		critical.push({
			target_id: "master",
			resource_type: "node",
			resource: "Xray",
			message: legacyRuntime.last_xray_error,
			severity: "critical",
		});
	}
	return critical;
};

export const diagnosticHref = ({
	resource_type: kind,
	target_id: target,
	resource,
}: Pick<Diagnostic, "resource_type" | "target_id" | "resource">) => {
	const corePath = `/xray-settings?${new URLSearchParams({ target: target || "master" })}`;
	if (kind === "inbound") return "/hosts#inbounds";
	if (kind === "host") return "/hosts#hosts";
	if (kind === "outbound" || kind === "outbound_subscription")
		return `${corePath}#outbounds`;
	if (
		kind === "xray_config" ||
		(kind === "node_service" && resource === "xray")
	)
		return `${corePath}#advanced`;
	if (
		kind === "haproxy" ||
		(kind === "node_service" && resource.startsWith("haproxy"))
	)
		return "/haproxy";
	if (kind === "resource") return target === "master" ? "/" : "/node-settings";
	if (kind === "certificate")
		return target === "master" ? "/settings#ssl" : "/node-settings";
	if (kind === "node" || kind === "node_operation" || kind === "node_service")
		return "/node-settings";
	if (kind === "external_app") return "/external-apps";
	if (kind === "backup") return "/settings#telegram?focus=periodic-backup";
	if (kind === "telegram") return "/settings#telegram";
	if (kind === "database") return "/phpmyadmin";
	if (kind === "runtime_warning" || kind === "runtime_error") {
		if (resource === "Telegram") return "/settings#telegram";
		if (resource === "Database") return "/phpmyadmin";
		if (resource === "Node") return "/node-settings";
		if (resource === "User") return "/users";
		if (resource === "Admin") return "/admins";
		return "/xray-logs";
	}
	return "/settings#panel";
};

export const requestErrorHref = (key: string, coreSearch = "") => {
	const path = key.replace(/^[A-Z]+\s+/, "");
	if (path.startsWith("/nodes")) return "/node-settings";
	if (path.startsWith("/inbounds")) return "/hosts#inbounds";
	if (path.startsWith("/hosts")) return "/hosts#hosts";
	if (path.startsWith("/haproxy")) return "/haproxy";
	if (path.startsWith("/external-apps")) return "/external-apps";
	if (path.startsWith("/users")) return "/users";
	if (path.startsWith("/admins")) return "/admins";
	if (path.startsWith("/services")) return "/services";
	if (
		path.startsWith("/core") ||
		path.startsWith("/outbound") ||
		path.startsWith("/panel/xray")
	) {
		const tab = /outbound|tor|windscribe|psiphon|nord|warp/i.test(path)
			? "outbounds"
			: path.includes("routeTest")
				? "routing"
				: "advanced";
		return `/xray-settings${coreSearch}#${tab}`;
	}
	if (path.startsWith("/telegram")) return "/settings#telegram";
	if (path.startsWith("/settings/subscriptions/certificates"))
		return "/settings#ssl";
	if (path.startsWith("/settings/subscriptions"))
		return "/settings#subscriptions";
	if (path.startsWith("/settings/phpmyadmin")) return "/phpmyadmin";
	if (path.startsWith("/settings/backup")) return "/";
	if (path.startsWith("/system")) return "/";
	return "/settings#panel";
};
