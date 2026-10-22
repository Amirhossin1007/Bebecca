import { toneClass } from "lib/tone";
import { Alert } from "components/ui/alert";
import { Badge } from "components/ui/badge";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";


import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetch, getAPIErrorMessage } from "service/http";
import {
	diagnosticHref,
	diagnosticSeverity,
	isCriticalDiagnostic,
	type Diagnostic,
} from "utils/diagnostics";

export const useSystemDiagnostics = (enabled: boolean) =>
	useQuery<Diagnostic[]>({ queryKey: ["system-diagnostics"], queryFn: () => fetch("/system/diagnostics"), enabled, refetchInterval: 15000, staleTime: 10000, retry: false });

export const SystemDiagnostics = ({
	issues,
	error,
	criticalOnly = false,
}: {
	issues: Diagnostic[];
	error?: unknown;
	criticalOnly?: boolean;
}) => {
	const { t } = useTranslation();
	const visibleIssues = criticalOnly
		? issues.filter(isCriticalDiagnostic)
		: issues;
	if (!visibleIssues.length && !error) return null;
	return (
		<div role="alert" aria-live="polite" className="flex flex-col gap-3">
			<p className="font-bold text-red-400">
				{t(criticalOnly ? "diagnostics.criticalTitle" : "diagnostics.title")} (
				{visibleIssues.length})
			</p>
			{Boolean(error) && (
				<Alert variant="destructive" className="rounded-xl">
					<CircleAlert className="size-4" aria-hidden="true" />
					{getAPIErrorMessage(error)}
				</Alert>
			)}
			{visibleIssues.map((issue, index) => (
				<Link key={`${issue.target_id}-${issue.resource_type}-${index}`} to={diagnosticHref(issue)} aria-label={`${issue.resource}: ${issue.message}`} className="block no-underline"><Alert className="rounded-xl items-start no-underline hover:no-underline hover:shadow-md focus-visible:[outline:2px_solid] focus-visible:outline-blue-400 focus-visible:[outline-offset:2px]">
					<Info className="size-4" aria-hidden="true" />
					<div className="min-w-0! flex-1">
						<div className="flex flex-row items-center flex-wrap gap-2 mb-2">
							<Badge className={toneClass(
									diagnosticSeverity(issue) === "warning" ? "orange" : "red"
								)}>
								{t(`diagnostics.level.${diagnosticSeverity(issue)}`)}
							</Badge>
							<Badge className={toneClass(
									diagnosticSeverity(issue) === "warning" ? "orange" : "red"
								)}>
								{t(
									`diagnostics.source.${issue.resource_type}`,
									issue.resource_type,
								)}
							</Badge>
							<p className="font-semibold">{issue.resource}</p>
							<p dir="ltr" className="text-[0.75rem]">
								{issue.target_id}
							</p>
							<p className="text-[0.75rem] underline">
								{t("diagnostics.openSection")}
							</p>
						</div>
						<p dir="auto" className="text-[0.875rem] font-mono whitespace-pre-wrap [word-break:break-word]">
							{issue.message}
						</p>
					</div>
				</Alert></Link>
			))}
		</div>
	);
};
