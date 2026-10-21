import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "components/ui/table";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
	diagnosticHref,
	diagnosticSeverity,
	type Diagnostic,
} from "utils/diagnostics";
import { cn } from "lib/cn";

const SEVERITY_TONE: Record<string, string> = {
	critical: "bg-panel-danger/12 text-panel-danger",
	error: "bg-panel-danger/10 text-panel-danger",
	warning: "bg-panel-warning/12 text-panel-warning",
};

/**
 * The diagnostic list on a stock shadcn Table.
 *
 * The rows come from the panel API, so the columns are the panel's own: level,
 * source, resource, detail and where it leads. The severity colour is the only
 * thing that differs per row, and it is a token, not a hard-coded palette value.
 */
export function DiagnosticsTable({ issues }: { issues: Diagnostic[] }) {
	const { t } = useTranslation();

	return (
		<div className="overflow-hidden rounded-lg border border-panel-border bg-panel-surface">
			<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-[110px]">{t("diagnostics.levelTitle")}</TableHead>
					<TableHead className="w-[160px]">{t("diagnostics.sourceTitle")}</TableHead>
					<TableHead className="w-[220px]">{t("diagnostics.resourceTitle")}</TableHead>
					<TableHead>{t("diagnostics.detailTitle")}</TableHead>
					<TableHead className="w-[90px] text-end">
						{t("diagnostics.sectionTitle")}
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{issues.map((issue) => {
					const severity = diagnosticSeverity(issue);
					const href = diagnosticHref(issue);
					return (
						<TableRow key={`${issue.target_id}-${issue.resource_type}-${issue.message}`}>
							<TableCell>
								<span
									className={cn(
										"inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
										SEVERITY_TONE[severity],
									)}
								>
									{t(`diagnostics.level.${severity}`)}
								</span>
							</TableCell>
							<TableCell className="text-panel-text-secondary">
								{t(`diagnostics.source.${issue.resource_type}`)}
							</TableCell>
							<TableCell className="font-semibold">{issue.resource}</TableCell>
							<TableCell>
								<span dir="auto" className="whitespace-pre-wrap break-words font-mono text-[0.78rem]">
									{issue.message}
								</span>
							</TableCell>
							<TableCell className="text-end">
								{href ? (
									<Link
										to={href}
										className="text-panel-accent underline-offset-2 hover:underline"
									>
										{t("diagnostics.openSection")}
									</Link>
								) : null}
							</TableCell>
						</TableRow>
					);
				})}
				</TableBody>
			</Table>
		</div>
	);
}
