import { DateTimeField } from "components/ui/date-time-field";
import { FormField } from "components/ui/form-field";
import { Input } from "components/ui/input";
import { cn } from "lib/cn";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { type FC, useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { formatBytes } from "utils/formatByte";
import { type FormType, ON_HOLD_QUICK_DAYS } from "./UserDialog.types";

type UserLimitsFieldsProps = {
	form: UseFormReturn<FormType>;
	disabled: boolean;
	ipLimitEditable: boolean;
	speedLimitEditable: boolean;
	remainingBytes?: number | null;
};

export const UserLimitsFields: FC<UserLimitsFieldsProps> = ({
	form,
	disabled,
	ipLimitEditable,
	speedLimitEditable,
	remainingBytes,
}) => {
	const { t, i18n } = useTranslation();
	const _isRTL = i18n.dir(i18n.language) === "rtl";
	const { errors } = form.formState;

	const status = form.watch("status");
	const isOnHold = status === "on_hold";
	const _expire = form.watch("expire");
	const [_trafficUnit, _setTrafficUnit] = useState<"GB" | "TB">("GB");

	const handleModeSwitch = (mode: "expire" | "on_hold") => {
		if (mode === "on_hold") {
			form.setValue("status", "on_hold", {
				shouldDirty: true,
				shouldValidate: true,
			});
			form.setValue("expire", null, {
				shouldDirty: true,
				shouldValidate: true,
			});
			if (!form.getValues("on_hold_expire_duration")) {
				form.setValue("on_hold_expire_duration", 30, {
					shouldDirty: true,
					shouldValidate: true,
				});
			}
		} else {
			form.setValue("status", "active", {
				shouldDirty: true,
				shouldValidate: true,
			});
			form.setValue("on_hold_expire_duration", null, {
				shouldDirty: true,
				shouldValidate: true,
			});
		}
	};

	return (
		<div className="flex flex-col gap-3.5 pb-4 border-b border-panel-border/60">
			<div className="flex items-center justify-between pb-1">
				<h4 className="text-xs font-semibold text-panel-text uppercase tracking-wider">
					{t("userDialog.limits")}
				</h4>

				<div className="flex items-center rounded-xl border border-panel-border bg-panel-card p-0.5">
					<button
						type="button"
						onClick={() => handleModeSwitch("expire")}
						disabled={disabled}
						className={cn(
							"flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer active:scale-95",
							!isOnHold
								? "bg-panel-accent text-white shadow-xs"
								: "text-panel-text-secondary min-[769px]:hover:text-panel-text",
						)}
					>
						<CalendarIcon className="size-3.5" />
						<span>{t("userDialog.expiryDate")}</span>
					</button>
					<button
						type="button"
						onClick={() => handleModeSwitch("on_hold")}
						disabled={disabled}
						className={cn(
							"flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer active:scale-95",
							isOnHold
								? "bg-panel-accent text-white shadow-xs"
								: "text-panel-text-secondary min-[769px]:hover:text-panel-text",
						)}
					>
						<Clock className="size-3.5" />
						<span>{t("userDialog.onHold")}</span>
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					{isOnHold ? (
						<FormField
							label={t("userDialog.onHoldExpireDuration")}
							error={errors.on_hold_expire_duration?.message}
						>
							<div className="flex flex-col gap-2">
								<div className="relative flex items-center">
									<Input
										id="user-on-hold-duration"
										type="number"
										min={1}
										dir="ltr"
										disabled={disabled}
										placeholder="30"
										className="h-9 rounded-xl border border-panel-border bg-panel-card text-xs text-panel-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pe-12"
										{...form.register("on_hold_expire_duration", {
											valueAsNumber: true,
										})}
									/>
									<span className="absolute end-3 text-xs font-medium text-panel-text-muted pointer-events-none select-none">
										{t("userDialog.days")}
									</span>
								</div>
								<div className="flex flex-wrap items-center gap-1.5">
									{ON_HOLD_QUICK_DAYS.map((days) => (
										<button
											key={days}
											type="button"
											onClick={() =>
												form.setValue("on_hold_expire_duration", days, {
													shouldDirty: true,
													shouldValidate: true,
												})
											}
											className="rounded-lg border border-panel-border/70 bg-panel-card px-2 py-0.5 text-[11px] font-medium text-panel-text-secondary transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent cursor-pointer active:scale-95"
										>
											{days} {t("userDialog.days")}
										</button>
									))}
								</div>
							</div>
						</FormField>
					) : (
						<FormField
							label={t("userDialog.expiryDate")}
							error={errors.expire?.message}
						>
							<Controller
								name="expire"
								control={form.control}
								render={({ field }) => (
									<DateTimeField
										value={field.value ? new Date(field.value * 1000) : null}
										onChange={(date) =>
											field.onChange(
												date ? Math.floor(date.getTime() / 1000) : null,
											)
										}
										placeholder={t("userDialog.expiryDate")}
										disabled={disabled}
										quickSelects={[
											{
												label: "+1m",
												onClick: () => {
													const d = new Date();
													d.setMonth(d.getMonth() + 1);
													field.onChange(Math.floor(d.getTime() / 1000));
												},
											},
											{
												label: "+3m",
												onClick: () => {
													const d = new Date();
													d.setMonth(d.getMonth() + 3);
													field.onChange(Math.floor(d.getTime() / 1000));
												},
											},
											{
												label: "+1y",
												onClick: () => {
													const d = new Date();
													d.setFullYear(d.getFullYear() + 1);
													field.onChange(Math.floor(d.getTime() / 1000));
												},
											},
										]}
									/>
								)}
							/>
						</FormField>
					)}
				</div>

				<div className="flex flex-col gap-1.5">
					<FormField
						label={t("userDialog.dataLimit")}
						error={errors.data_limit?.message}
						description={
							remainingBytes !== undefined && remainingBytes !== null
								? `${t("userDialog.remainingDataLabel", "Remaining")}: ${formatBytes(remainingBytes, 2)}`
								: undefined
						}
					>
						<div className="relative flex items-center">
							<Input
								id="user-data-limit"
								type="text"
								inputMode="decimal"
								dir="ltr"
								disabled={disabled}
								placeholder={t("userDialog.unlimited")}
								className="h-9 rounded-xl border border-panel-border bg-panel-card text-xs text-panel-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pe-14"
								{...form.register("data_limit")}
							/>
							<div className="absolute end-1.5 flex items-center">
								<span className="rounded-lg bg-panel-surface px-2 py-0.5 text-[11px] font-semibold text-panel-text-secondary border border-panel-border/60">
									GB
								</span>
							</div>
						</div>
					</FormField>
				</div>

				{ipLimitEditable && (
					<div className="flex flex-col gap-1.5">
						<FormField
							label={t("userDialog.ipLimitLabel")}
							error={errors.ip_limit?.message}
						>
							<div className="relative flex items-center">
								<Input
									id="user-ip-limit"
									type="number"
									min={0}
									dir="ltr"
									disabled={disabled}
									placeholder={t("userDialog.unlimited")}
									className="h-9 rounded-xl border border-panel-border bg-panel-card text-xs text-panel-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
									{...form.register("ip_limit", {
										setValueAs: (v) =>
											v === "" || v === null ? null : Number(v),
									})}
								/>
							</div>
						</FormField>
					</div>
				)}

				{speedLimitEditable && (
					<div className="flex flex-col gap-1.5">
						<FormField
							label={t("userDialog.speedLimitLabel")}
							error={errors.speed_limit?.message}
						>
							<div className="relative flex items-center">
								<Input
									id="user-speed-limit"
									type="number"
									step="0.1"
									min={0}
									dir="ltr"
									disabled={disabled}
									placeholder={t("userDialog.unlimited")}
									className="h-9 rounded-xl border border-panel-border bg-panel-card text-xs text-panel-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pe-14"
									{...form.register("speed_limit", {
										setValueAs: (v) =>
											v === "" || v === null ? null : Number(v),
									})}
								/>
								<span className="absolute end-2 text-[11px] font-medium text-panel-text-muted pointer-events-none select-none">
									Mbps
								</span>
							</div>
						</FormField>
					</div>
				)}
			</div>
		</div>
	);
};
