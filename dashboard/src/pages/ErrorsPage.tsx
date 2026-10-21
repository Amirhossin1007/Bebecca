import { Button } from "components/shadcn/button";
import { RequestErrors } from "components/RequestErrors";
import { DiagnosticsTable } from "components/diagnostics/DiagnosticsTable";
import {
	SystemDiagnostics,
	useSystemDiagnostics,
} from "components/SystemDiagnostics";
import { PanelSelect as Select } from "components/common/PanelSelect";
import {
	PageHeader,
	PageLoadingSkeleton,
	ResourceListCard,
} from "components/ui";
import useGetUser from "hooks/useGetUser";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAPIRequestErrors } from "service/http";
import { AdminRole } from "types/Admin";
import { diagnosticSeverity, type DiagnosticSeverity } from "utils/diagnostics";

const levels: DiagnosticSeverity[] = ["critical", "error", "warning"];

export default function ErrorsPage() {
	const { t } = useTranslation();
	const { userData } = useGetUser();
	const canSeeGlobal =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const query = useSystemDiagnostics(canSeeGlobal);
	const requests = useAPIRequestErrors((state) => state.errors);
	const [level, setLevel] = useState<DiagnosticSeverity | "all">("all");
	const issues = [...(canSeeGlobal ? query.data || [] : [])].sort(
		(a, b) =>
			levels.indexOf(diagnosticSeverity(a)) -
			levels.indexOf(diagnosticSeverity(b)),
	);
	const visibleIssues = issues.filter(
		(issue) => level === "all" || diagnosticSeverity(issue) === level,
	);
	const showRequests = level === "all" || level === "error";
	const empty = !visibleIssues.length && (!showRequests || !requests.length);

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title="errors"
				description={t("diagnostics.pageDescription")}
			/>
			<ResourceListCard
				title={t("diagnostics.title")}
				summaryItems={levels.map((severity) => ({
					label: t(`diagnostics.level.${severity}`),
					value:
						issues.filter((issue) => diagnosticSeverity(issue) === severity)
							.length + (severity === "error" ? requests.length : 0),
					colorScheme: severity === "warning" ? "orange" : "red",
				}))}
				actions={
					canSeeGlobal ? (
						<Button variant="solid" size="sm" onClick={() => query.refetch()} loading={query.isFetching}>
							{t("diagnostics.refresh")}
						</Button>
					) : undefined
				}
			>
				<div className="flex flex-row items-center gap-2">
					<Select aria-label={t("diagnostics.filterLevel")} value={level} onChange={(event) => setLevel(event.target.value as typeof level)} className="max-w-[260px]">
						<option value="all">{t("diagnostics.allLevels")}</option>
						{levels.map((severity) => (
							<option key={severity} value={severity}>
								{t(`diagnostics.level.${severity}`)}
							</option>
						))}
					</Select>
				</div>
			</ResourceListCard>
			{canSeeGlobal && query.isLoading ? (
				<PageLoadingSkeleton />
			) : (
				<>
					{/* Global diagnostics now render as a stock shadcn table; the
					    per-request alert list is not a diagnostics source and stays as it is. */}
					{visibleIssues.length ? (
						<section className="flex flex-col gap-3">
							<h2 className="text-[0.95rem] font-semibold">
								{t("diagnostics.title")}{" "}
								<span className="text-panel-text-muted">({visibleIssues.length})</span>
							</h2>
							<DiagnosticsTable issues={visibleIssues} />
						</section>
					) : canSeeGlobal && query.error ? (
						<SystemDiagnostics issues={[]} error={query.error} />
					) : null}
					{showRequests && <RequestErrors />}
					{empty && !(canSeeGlobal && query.error) && (
						<div className="p-6 bg-panel-surface rounded-2xl">
							<p className="text-panel-text-secondary">{t("diagnostics.empty")}</p>
						</div>
					)}
				</>
			)}
		</div>
	);
}
