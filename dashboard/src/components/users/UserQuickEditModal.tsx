import { Button } from "components/ui/button";
import { DateTimeField } from "components/ui/date-time-field";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { toast } from "components/ui/sonner";
import { useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { Calendar, Database, X } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch as apiFetch } from "service/http";

const BYTES_PER_GB = 1024 * 1024 * 1024;

export const UserQuickEditModal: FC = () => {
	const { t } = useTranslation();

	const quickEditUser = useDashboard((state) => state.quickEditUser);
	const refetchUsers = useDashboard((state) => state.refetchUsers);
	const user = quickEditUser?.user ?? null;
	const field = quickEditUser?.field ?? null;

	const [loading, setLoading] = useState(false);
	const [limitGb, setLimitGb] = useState("");
	const [expireDate, setExpireDate] = useState<Date | null>(null);

	useEffect(() => {
		if (!quickEditUser) return;
		if (quickEditUser.field === "data_limit") {
			const bytes = quickEditUser.user.data_limit ?? 0;
			setLimitGb(bytes ? String(+(bytes / BYTES_PER_GB).toFixed(2)) : "");
		} else {
			const expire = quickEditUser.user.expire;
			setExpireDate(expire ? dayjs.unix(expire).toDate() : null);
		}
	}, [quickEditUser]);

	const onClose = () => {
		if (loading) return;
		useDashboard.setState({ quickEditUser: null });
	};

	const save = async () => {
		if (!user || !field) return;
		const body =
			field === "data_limit"
				? {
						data_limit: Math.max(0, Math.round(Number(limitGb) * BYTES_PER_GB)),
					}
				: { expire: expireDate ? dayjs(expireDate).unix() : null };

		setLoading(true);
		try {
			await apiFetch(`/v2/users/${encodeURIComponent(user.username)}`, {
				method: "PUT",
				body,
			});
			toast.success(
				field === "data_limit"
					? t("usersTable.setDataLimitSuccess")
					: t("usersTable.setExpirySuccess"),
				{ duration: 2500 },
			);
			refetchUsers(true);
			useDashboard.setState({ quickEditUser: null });
		} catch (error: any) {
			toast.error(error?.data?.detail || error?.message || t("error"), {
				duration: 3000,
			});
		} finally {
			setLoading(false);
		}
	};

	if (!quickEditUser) return null;

	const isDataLimit = field === "data_limit";

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-sm overflow-hidden rounded-[20px] border border-panel-border bg-panel-card p-0 shadow-2xl z-[1500]">
				<DialogHeader className="flex flex-row items-center justify-between border-b border-panel-border px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-xl bg-panel-accent/10 text-panel-accent">
							{isDataLimit ? (
								<Database className="size-4" />
							) : (
								<Calendar className="size-4" />
							)}
						</div>
						<div>
							<DialogTitle className="text-sm font-bold text-panel-text">
								{isDataLimit
									? t("usersTable.setDataLimit")
									: t("usersTable.setExpiry")}
							</DialogTitle>
							<p
								dir="ltr"
								className="text-[11px] font-mono text-panel-text-secondary text-start"
							>
								{user?.username}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex size-8 items-center justify-center rounded-xl border border-panel-border/70 text-panel-text-secondary transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text cursor-pointer active:scale-95"
					>
						<X className="size-4" />
					</button>
				</DialogHeader>

				<div className="px-6 py-5 flex flex-col gap-3">
					{isDataLimit ? (
						<div className="relative flex items-center">
							<Input
								type="number"
								step="0.1"
								min={0}
								dir="ltr"
								value={limitGb}
								onChange={(e) => setLimitGb(e.target.value)}
								placeholder={t("userDialog.unlimited")}
								className="h-10 rounded-[12px] border border-panel-border bg-panel-surface text-sm text-panel-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pe-12"
							/>
							<span className="absolute end-3 text-xs font-semibold text-panel-text-muted pointer-events-none select-none">
								GB
							</span>
						</div>
					) : (
						<DateTimeField
							value={expireDate}
							onChange={setExpireDate}
							placeholder={t("userDialog.expiryDate")}
							quickSelects={[
								{
									label: "+1m",
									onClick: () =>
										setExpireDate(dayjs().add(1, "month").toDate()),
								},
								{
									label: "+3m",
									onClick: () =>
										setExpireDate(dayjs().add(3, "month").toDate()),
								},
								{
									label: "+1y",
									onClick: () => setExpireDate(dayjs().add(1, "year").toDate()),
								},
							]}
						/>
					)}
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-panel-border px-6 py-3.5 bg-panel-surface/60">
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
						disabled={loading}
						className="h-9 rounded-[12px] border-panel-border bg-panel-surface text-xs font-medium"
					>
						{t("cancel")}
					</Button>
					<Button
						type="button"
						onClick={save}
						disabled={loading}
						className="h-9 rounded-[12px] bg-panel-accent text-xs font-semibold text-white shadow-xs"
					>
						{t("save")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
