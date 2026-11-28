import { AppDialog } from "components/dialogs/AppDialog";
import { OperatorIdentity } from "components/OperatorIdentity";
import { Button } from "components/ui/button";
import { Spinner } from "components/ui/spinner";
import dayjs from "dayjs";
import { Clock, Copy, Globe, Link, Server, Signal } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { type UserIPDialogState, uniqueIPValues } from "./userIPsUtils";

type UserIPsModalProps = {
	ipDialog: UserIPDialogState | null;
	loading: boolean;
	onClose: () => void;
	onCopyIPs: () => void;
};

export const UserIPsModal: FC<UserIPsModalProps> = ({
	ipDialog,
	loading,
	onClose,
	onCopyIPs,
}) => {
	const { t } = useTranslation();

	return (
		<AppDialog
			open={ipDialog !== null}
			onClose={onClose}
			title={t("usersTable.ipsDialogTitle")}
			size="lg"
			contentProps={{
				className:
					"bg-panel-surface border-panel-border! border rounded-lg overflow-hidden",
			}}
			bodyProps={{ className: "pb-5" }}
			footer={
				<div className="flex flex-row items-center w-full justify-end gap-2">
					<Button onClick={onClose} size="sm">
						{t("close")}
					</Button>
					<Button
						onClick={onCopyIPs}
						disabled={
							loading || Boolean(ipDialog?.error) || !ipDialog?.records.length
						}
						size="sm"
					>
						<Copy />
						{t("usersTable.copyIps")}
					</Button>
				</div>
			}
		>
			<div className="flex flex-col gap-4">
				<div>
					<div className="flex flex-row justify-between items-baseline gap-3">
						<p dir="ltr" className="font-bold truncate">
							{ipDialog?.username}
						</p>
						{!loading && !ipDialog?.error && (
							<p className="text-[0.75rem] text-panel-text-muted shrink-0">
								{t("usersTable.ipsDialogCount", {
									count: ipDialog?.records.length ?? 0,
								})}
							</p>
						)}
					</div>
					<p className="mt-1 text-[0.875rem] text-panel-text-muted">
						{t("usersTable.ipsDialogDescription")}
					</p>
				</div>

				{loading ? (
					<div className="flex items-center justify-center gap-3 py-8">
						<Spinner className="text-panel-accent" />
						<p className="text-[0.875rem] text-panel-text-muted">
							{t("usersTable.ipsDialogLoading")}
						</p>
					</div>
				) : ipDialog?.error ? (
					<div
						role="alert"
						className="border border-red-400! rounded-md bg-red-50 text-red-700 dark:bg-[rgba(127,_29,_29,_0.22)] dark:text-red-200 px-3 py-2.5 text-[0.875rem]"
					>
						{ipDialog.error}
					</div>
				) : !ipDialog?.records.length ? (
					<div className="border border-panel-border! rounded-md px-4 py-8 text-center">
						<p className="text-[0.875rem] text-panel-text-muted">
							{t("usersTable.ipsDialogEmpty")}
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{ipDialog.records.map((record, index) => {
							const nodes = uniqueIPValues([
								...(record.node_names || []),
								record.node_name || `node-${record.node_id}`,
							]);
							const protocols = uniqueIPValues([
								...(record.protocols || []),
								record.protocol,
							]);
							const inbounds = uniqueIPValues([
								...(record.inbound_tags || []),
								record.inbound_tag,
							]);
							const ip = record.ip || record.assigned_ip || "-";
							const metadata = [
								protocols.join(", "),
								inbounds.join(", "),
								nodes.join(", "),
							]
								.filter(Boolean)
								.join(" · ");
							const assignedIPs = uniqueIPValues([
								...(record.assigned_ips || []),
								record.assigned_ip,
							]).filter((value) => value !== ip);
							const connections = Math.max(record.connections || 1, 1);

							return (
								<article
									key={ip === "-" ? `${metadata}-${index}` : ip}
									className="p-3 border border-panel-border! rounded-[6px]"
								>
									<div className="flex-col sm:flex-row flex justify-between items-stretch sm:items-start gap-3">
										<OperatorIdentity
											shortName={record.operator_short_name}
											owner={record.operator_owner}
										/>
										<div className="min-w-0! text-start sm:text-end">
											<p
												dir="ltr"
												className="font-mono font-bold text-[0.875rem] [overflow-wrap:anywhere]"
											>
												{ip}
											</p>
											<div className="flex flex-row items-center mt-0.5 gap-1 justify-start sm:justify-end text-panel-text-secondary text-[0.75rem]">
												<Signal aria-hidden="true" className="w-[14px]" />
												<p>
													{t("usersTable.ipConnections_other", {
														count: connections,
													})}
												</p>
											</div>
										</div>
									</div>

									<div className="flex flex-row items-center mt-3 gap-3 flex-wrap text-panel-text-muted text-[0.75rem]">
										{protocols.length > 0 && (
											<div className="flex flex-row items-center gap-1">
												<Globe aria-hidden="true" className="w-[14px]" />
												<p>{protocols.join(", ")}</p>
											</div>
										)}
										{inbounds.length > 0 && (
											<div className="flex flex-row items-center gap-1">
												<Link aria-hidden="true" className="w-[14px]" />
												<p>{inbounds.join(", ")}</p>
											</div>
										)}
										{nodes.length > 0 && (
											<div className="flex flex-row items-center gap-1">
												<Server aria-hidden="true" className="w-[14px]" />
												<p>{nodes.join(", ")}</p>
											</div>
										)}
										{record.last_seen_at && (
											<div className="flex flex-row items-center gap-1">
												<Clock aria-hidden="true" className="w-[14px]" />
												<p dir="ltr">
													{dayjs(record.last_seen_at).format(
														"YYYY-MM-DD HH:mm",
													)}
												</p>
											</div>
										)}
									</div>
									{assignedIPs.length > 0 && (
										<p className="mt-1 text-[0.75rem] text-panel-text-secondary [overflow-wrap:anywhere]">
											{t("usersTable.assignedIp")}:{" "}
											<span dir="ltr" className="inline-block">
												{assignedIPs.join(", ")}
											</span>
										</p>
									)}
								</article>
							);
						})}
					</div>
				)}
			</div>
		</AppDialog>
	);
};
