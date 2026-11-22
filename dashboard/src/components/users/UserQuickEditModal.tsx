import { NumericInput } from "components/common/NumericInput";
import { DateTimePicker } from "components/DateTimePicker";
import { AppDialog } from "components/dialogs/AppDialog";
import { Button } from "components/ui/button";
import { Field, FieldLabel } from "components/ui/field";
import { toast } from "components/ui/sonner";
import { useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";

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
			await fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
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

	const isDataLimit = field === "data_limit";

	return (
		<AppDialog
			open={Boolean(quickEditUser)}
			onClose={onClose}
			size="sm"
			title={
				isDataLimit ? t("usersTable.setDataLimit") : t("usersTable.setExpiry")
			}
			contentProps={{
				className: "mx-3 rounded-[20px] border-panel-border bg-panel-elevated",
			}}
			headerProps={{ className: "border-b border-panel-border px-5 py-4" }}
			footerProps={{
				className: "border-t border-panel-border px-5 py-3 gap-2",
			}}
			footer={
				<>
					<Button
						onClick={onClose}
						disabled={loading}
						variant="outline"
						size="sm"
						className="h-9 flex-1 rounded-xl border-panel-border"
					>
						{t("cancel")}
					</Button>
					<Button
						onClick={save}
						size="sm"
						loading={loading}
						className="h-9 flex-1 rounded-xl bg-panel-accent text-white hover:bg-panel-accent/90"
					>
						{t("save")}
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4 py-2">
				{user && (
					<p
						dir="ltr"
						className="text-xs font-medium text-panel-text-muted [unicode-bidi:isolate]"
					>
						@{user.username}
					</p>
				)}

				{isDataLimit ? (
					<Field className="flex flex-col gap-2">
						<FieldLabel className="text-xs font-semibold text-panel-text-secondary">
							{t("usersTable.trafficLimitGb")}
						</FieldLabel>
						<NumericInput
							value={limitGb}
							onChange={setLimitGb}
							placeholder="0 (Unlimited)"
							min={0}
							step={1}
							autoFocus
							className="h-10 rounded-xl border-panel-border bg-panel-surface text-sm"
						/>
						<div className="flex flex-wrap gap-1.5 pt-1">
							{[
								{ label: "+10 GB", val: 10 },
								{ label: "+20 GB", val: 20 },
								{ label: "+50 GB", val: 50 },
								{ label: "+100 GB", val: 100 },
							].map((preset) => (
								<button
									key={preset.label}
									type="button"
									onClick={() =>
										setLimitGb((curr) =>
											String(Math.max(0, Number(curr || 0) + preset.val)),
										)
									}
									className="rounded-lg border border-panel-border bg-panel-surface px-2.5 py-1 text-[11px] font-medium text-panel-text-secondary transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent active:scale-[0.98] touch-manipulation"
								>
									{preset.label}
								</button>
							))}
							<button
								type="button"
								onClick={() => setLimitGb("0")}
								className="rounded-lg border border-panel-border bg-panel-surface px-2.5 py-1 text-[11px] font-medium text-panel-text-muted transition-colors min-[769px]:hover:text-panel-text active:scale-[0.98] touch-manipulation"
							>
								∞
							</button>
						</div>
					</Field>
				) : (
					<Field className="flex flex-col gap-2">
						<FieldLabel className="text-xs font-semibold text-panel-text-secondary">
							{t("usersTable.expiryDate")}
						</FieldLabel>
						<DateTimePicker value={expireDate} onChange={setExpireDate} />
						<div className="flex flex-wrap gap-1.5 pt-1">
							{[
								{ label: "+7d", days: 7 },
								{ label: "+30d", days: 30 },
								{ label: "+60d", days: 60 },
								{ label: "+90d", days: 90 },
							].map((preset) => (
								<button
									key={preset.label}
									type="button"
									onClick={() => {
										const base =
											expireDate && dayjs(expireDate).isAfter(dayjs())
												? dayjs(expireDate)
												: dayjs();
										setExpireDate(base.add(preset.days, "day").toDate());
									}}
									className="rounded-lg border border-panel-border bg-panel-surface px-2.5 py-1 text-[11px] font-medium text-panel-text-secondary transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent active:scale-[0.98] touch-manipulation"
								>
									{preset.label}
								</button>
							))}
							<button
								type="button"
								onClick={() => setExpireDate(null)}
								className="rounded-lg border border-panel-border bg-panel-surface px-2.5 py-1 text-[11px] font-medium text-panel-text-muted transition-colors min-[769px]:hover:text-panel-text active:scale-[0.98] touch-manipulation"
							>
								∞
							</button>
						</div>
					</Field>
				)}
			</div>
		</AppDialog>
	);
};
