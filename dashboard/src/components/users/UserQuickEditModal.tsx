import { useToast } from "components/shadcn/toast";
import { Button } from "components/shadcn/button";
import { FormControl, FormLabel } from "components/shadcn/field";
import { InputGroup, InputRightAddon } from "components/shadcn/input";
import { NumericInput } from "components/common/NumericInput";
import { DateTimePicker } from "components/DateTimePicker";
import { AppDialog } from "components/dialogs/AppDialog";
import { useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";

const BYTES_PER_GB = 1024 * 1024 * 1024;

/**
 * Lightweight single-field editor for a user's data limit or expiry date,
 * driven by the `quickEditUser` store slot. These map onto the same
 * PUT /v2/users/{username} contract the edit dialog uses, exposed as quick
 * one-off actions from the Users overflow menu.
 */
export const UserQuickEditModal: FC = () => {
	const { t } = useTranslation();
	const toast = useToast();
	const quickEditUser = useDashboard((state) => state.quickEditUser);
	const refetchUsers = useDashboard((state) => state.refetchUsers);
	const user = quickEditUser?.user ?? null;
	const field = quickEditUser?.field ?? null;

	const [loading, setLoading] = useState(false);
	const [limitGb, setLimitGb] = useState("");
	const [expireDate, setExpireDate] = useState<Date | null>(null);

	// Seed the input from the user's current value each time the modal opens.
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
			toast({
				title:
					field === "data_limit"
						? t("usersTable.setDataLimitSuccess")
						: t("usersTable.setExpirySuccess"),
				status: "success",
				isClosable: true,
				position: "top",
				duration: 2500,
			});
			refetchUsers(true);
			useDashboard.setState({ quickEditUser: null });
		} catch (error: any) {
			toast({
				title: error?.data?.detail || error?.message || t("error"),
				status: "error",
				isClosable: true,
				position: "top",
				duration: 3000,
			});
		} finally {
			setLoading(false);
		}
	};

	const isDataLimit = field === "data_limit";

	return (
		<AppDialog isCentered open={Boolean(quickEditUser)} onClose={onClose} size="sm" title={
				isDataLimit
					? t("usersTable.setDataLimit")
					: t("usersTable.setExpiry")
			} overlayProps={{ className: "bg-blackAlpha-300" }} contentProps={{ className: "mx-3" }} footerProps={{ className: "gap-3" }} footer={
				<>
					<Button size="sm" variant="outline" onClick={onClose} disabled={loading}>
						{t("cancel")}
					</Button>
					<Button size="sm" colorScheme="primary" onClick={save} loading={loading}>
						{t("save")}
					</Button>
				</>
			}>
					<div className="flex flex-col items-stretch gap-3">
						{user && (
							<p dir="ltr" className="text-[0.875rem] text-panel-text-muted">
								{user.username}
							</p>
						)}
						{isDataLimit ? (
							<FormControl>
								<FormLabel>{t("userDialog.dataLimit")}</FormLabel>
								<InputGroup>
									<NumericInput
										min={0}
										step={1}
										value={limitGb}
										onChange={(valueAsString) => setLimitGb(valueAsString)}
									/>
									<InputRightAddon>GB</InputRightAddon>
								</InputGroup>
								<p className="text-[0.75rem] text-panel-text-muted mt-1">
									{t("usersTable.unlimitedHint")}
								</p>
							</FormControl>
						) : (
							<FormControl>
								<FormLabel>{t("usersTable.expire")}</FormLabel>
								<DateTimePicker
									value={expireDate}
									onChange={setExpireDate}
									minDate={new Date()}
									placeholder={t("usersTable.setExpiry")}
								/>
								<p className="text-[0.75rem] text-panel-text-muted mt-1">
									{t("usersTable.expiryClearHint")}
								</p>
							</FormControl>
						)}
					</div>
		</AppDialog>
	);
};
