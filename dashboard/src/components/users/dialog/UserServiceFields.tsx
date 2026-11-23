import { PanelSelect as Select } from "components/common/PanelSelect";
import { FormField } from "components/ui/form-field";
import { Input } from "components/ui/input";
import { resetStrategy } from "constants/UserSettings";
import { Server } from "lucide-react";
import type { FC } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ALLOWED_FLOWS, type FormType } from "./UserDialog.types";

type UserServiceFieldsProps = {
	form: UseFormReturn<FormType>;
	disabled: boolean;
	serviceSelectionDisabled: boolean;
	showServiceSelector: boolean;
	serviceOptions: Array<{
		id: number;
		name: string;
		host_count?: number;
		user_count?: number;
	}>;
	isServiceManagedUser: boolean;
	serviceName?: string;
	canConfigurePeriodicReset: boolean;
	canSetCustomKey: boolean;
};

export const UserServiceFields: FC<UserServiceFieldsProps> = ({
	form,
	disabled,
	serviceSelectionDisabled,
	showServiceSelector,
	serviceOptions,
	isServiceManagedUser,
	serviceName,
	canConfigurePeriodicReset,
	canSetCustomKey,
}) => {
	const { t } = useTranslation();
	const { errors } = form.formState;
	const manualKeyEntry = form.watch("manual_key_entry");

	return (
		<div className="flex flex-col gap-3.5 rounded-2xl border border-panel-border bg-panel-surface p-4 shadow-xs">
			<div className="flex items-center justify-between pb-2 border-b border-panel-border/60">
				<div className="flex items-center gap-2">
					<span className="size-2 rounded-full bg-panel-accent" />
					<h4 className="text-xs font-semibold text-panel-text uppercase tracking-wider">
						{t("userDialog.serviceSettings")}
					</h4>
				</div>
				<Server className="size-4 text-panel-text-muted" />
			</div>

			{isServiceManagedUser && serviceName && (
				<div className="rounded-xl border border-panel-accent/20 bg-panel-accent/10 px-3 py-2 text-xs text-panel-text">
					{t("userDialog.serviceManagedNotice", { service: serviceName })}
				</div>
			)}

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{showServiceSelector && (
					<div className="flex flex-col gap-1.5">
						<FormField
							label={t("userDialog.selectServiceLabel")}
							error={errors.service_id?.message}
						>
							<Controller
								name="service_id"
								control={form.control}
								render={({ field }) => (
									<Select
										value={field.value ? String(field.value) : ""}
										onChange={(e) => {
											const val = e.target.value;
											field.onChange(val ? Number(val) : null);
										}}
										disabled={disabled || serviceSelectionDisabled}
										size="sm"
									>
										<option value="">{t("userDialog.selectService")}</option>
										{serviceOptions.map((s) => (
											<option key={s.id} value={String(s.id)}>
												{s.name}
											</option>
										))}
									</Select>
								)}
							/>
						</FormField>
					</div>
				)}

				{canConfigurePeriodicReset && (
					<div className="flex flex-col gap-1.5">
						<FormField
							label={t("userDialog.periodicUsageReset")}
							error={errors.data_limit_reset_strategy?.message}
						>
							<Controller
								name="data_limit_reset_strategy"
								control={form.control}
								render={({ field }) => (
									<Select
										value={field.value}
										onChange={(e) => field.onChange(e.target.value)}
										disabled={disabled}
										size="sm"
									>
										{resetStrategy.map((strategy) => (
											<option key={strategy.value} value={strategy.value}>
												{t(`userDialog.resetStrategy${strategy.title}`)}
											</option>
										))}
									</Select>
								)}
							/>
						</FormField>
					</div>
				)}

				{canSetCustomKey && (
					<div className="flex flex-col gap-2.5 sm:col-span-2 pt-2 border-t border-panel-border/50">
						<label className="flex items-center gap-2 cursor-pointer select-none">
							<input
								type="checkbox"
								disabled={disabled}
								checked={manualKeyEntry}
								onChange={(e) =>
									form.setValue("manual_key_entry", e.target.checked)
								}
								className="size-4 rounded border-panel-border text-panel-accent focus:ring-panel-accent"
							/>
							<span className="text-xs font-medium text-panel-text">
								{t("userDialog.allowManualKeyEntry")}
							</span>
						</label>

						{manualKeyEntry && (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
								<FormField
									label={t("userDialog.credentialKeyLabel")}
									error={errors.credential_key?.message}
									description={t("userDialog.manualKeyHelper")}
								>
									<Input
										dir="ltr"
										disabled={disabled}
										placeholder="32 hex characters or UUID"
										className="h-9 rounded-xl border border-panel-border bg-panel-card text-xs text-panel-text font-mono"
										{...form.register("credential_key")}
									/>
								</FormField>

								<FormField label={t("userDialog.flow.label")}>
									<Controller
										name="flow"
										control={form.control}
										render={({ field }) => (
											<Select
												value={field.value ?? ""}
												onChange={(e) => field.onChange(e.target.value || null)}
												disabled={disabled}
												size="sm"
											>
												{ALLOWED_FLOWS.map((flow) => (
													<option key={flow} value={flow}>
														{flow ? flow : t("userDialog.flow.none")}
													</option>
												))}
											</Select>
										)}
									/>
								</FormField>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
