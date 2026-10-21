import { Alert, AlertIcon } from "components/shadcn/alert";
import { Tag } from "components/shadcn/badge";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import { fetch, getAPIErrorMessage } from "service/http";
import {
	diagnosticHref,
	diagnosticSeverity,
	isCriticalDiagnostic,
	type Diagnostic,
} from "utils/diagnostics";

export const useSystemDiagnostics = (enabled: boolean) =>
	useQuery<Diagnostic[]>(
		["system-diagnostics"],
		() => fetch("/system/diagnostics"),
		{ enabled, refetchInterval: 15000, staleTime: 10000, retry: false },
	);

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
				<Alert status="error" className="rounded-xl">
					<AlertIcon />
					{getAPIErrorMessage(error)}
				</Alert>
			)}
			{visibleIssues.map((issue, index) => (
				<Alert as={Link} to={diagnosticHref(issue)} role="link" aria-label={`${issue.resource}: ${issue.message}`} key={`${issue.target_id}-${issue.resource_type}-${index}`} status={diagnosticSeverity(issue) === "warning" ? "warning" : "error"} className="rounded-xl items-start no-underline hover:no-underline hover:shadow-md focus-visible:[outline:2px_solid] focus-visible:outline-blue-400 focus-visible:[outline-offset:2px]">
					<AlertIcon className="mt-1" />
					<div className="min-w-0! flex-1">
						<div className="flex flex-row items-center flex-wrap gap-2 mb-2">
							<Tag colorScheme={
									diagnosticSeverity(issue) === "warning" ? "orange" : "red"
								} size="sm">
								{t(`diagnostics.level.${diagnosticSeverity(issue)}`)}
							</Tag>
							<Tag colorScheme={
									diagnosticSeverity(issue) === "warning" ? "orange" : "red"
								} size="sm">
								{t(
									`diagnostics.source.${issue.resource_type}`,
									issue.resource_type,
								)}
							</Tag>
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
				</Alert>
			))}
		</div>
	);
};
