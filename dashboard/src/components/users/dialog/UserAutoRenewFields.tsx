import { FormField } from "components/ui/form-field";
import { Input } from "components/ui/input";
import { Switch } from "components/ui/switch";
import { cn } from "lib/cn";
import { ChevronDown, RefreshCw } from "lucide-react";
import { type FC, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { FormType } from "./UserDialog.types";

type UserAutoRenewFieldsProps = {
	form: UseFormReturn<FormType>;
	disabled: boolean;
};

export const UserAutoRenewFields: FC<UserAutoRenewFieldsProps> = ({
	form,
	disabled,
}) => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);
	const nextPlanEnabled = form.watch("next_plan_enabled");
	const addRemaining = form.watch("next_plan_add_remaining_traffic");
	const fireOnEither = form.watch("next_plan_fire_on_either");

	return (
		<div className="flex flex-col rounded-[14px] border border-panel-border bg-panel-surface/60 shadow-xs overflow-hidden transition-all">
			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				className="flex items-center justify-between p-4 text-start cursor-pointer transition-colors min-[769px]:hover:bg-panel-elevated/40"
			>
				<div className="flex items-center gap-2.5">
					<div className="flex size-7 items-center justify-center rounded-lg bg-panel-card border border-panel-border/70 text-panel-text-secondary">
						<RefreshCw className="size-3.5" />
					</div>
					<div>
						<h4 className="text-xs font-semibold text-panel-text">
							{t("userDialog.autoRenewTitle")}
						</h4>
						<p className="text-[11px] text-panel-text-secondary">
							{t("userDialog.nextPlanDescription")}
						</p>
					</div>
				</div>
				<ChevronDown
					className={cn(
						"size-4 text-panel-text-muted transition-transform duration-200",
						isOpen && "rotate-180",
					)}
				/>
			</button>

			{isOpen && (
				<div className="flex flex-col gap-3.5 p-4 pt-1 border-t border-panel-border/60">
					<div className="flex items-center justify-between py-1">
						<span className="text-xs font-medium text-panel-text">
							{t("userDialog.autoRenewTitle")}
						</span>
						<Switch
							checked={nextPlanEnabled}
							disabled={disabled}
							onCheckedChange={(checked) =>
								form.setValue("next_plan_enabled", checked)
							}
						/>
					</div>

					{nextPlanEnabled && (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
							<FormField label={t("userDialog.autoRenewData")}>
								<div className="relative flex items-center">
									<Input
										type="number"
										step="0.1"
										min={0}
										dir="ltr"
										disabled={disabled}
										placeholder={t("userDialog.unlimited")}
										className="h-9 rounded-xl border border-panel-border bg-panel-card text-xs text-panel-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pe-12"
										{...form.register("next_plan_data_limit", {
											setValueAs: (v) =>
												v === "" || v === null ? null : Number(v),
										})}
									/>
									<span className="absolute end-3 text-[11px] font-semibold text-panel-text-muted pointer-events-none select-none">
										GB
									</span>
								</div>
							</FormField>

							<FormField label={t("userDialog.autoRenewDays")}>
								<div className="relative flex items-center">
									<Input
										type="number"
										min={1}
										dir="ltr"
										disabled={disabled}
										placeholder="30"
										className="h-9 rounded-xl border border-panel-border bg-panel-card text-xs text-panel-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pe-12"
										{...form.register("next_plan_expire", {
											setValueAs: (v) =>
												v === "" || v === null ? null : Number(v),
										})}
									/>
									<span className="absolute end-3 text-[11px] font-medium text-panel-text-muted pointer-events-none select-none">
										{t("userDialog.days")}
									</span>
								</div>
							</FormField>

							<div className="flex flex-col gap-2 sm:col-span-2 pt-1">
								<label className="flex items-center gap-2 cursor-pointer select-none text-xs text-panel-text">
									<input
										type="checkbox"
										disabled={disabled}
										checked={addRemaining}
										onChange={(e) =>
											form.setValue(
												"next_plan_add_remaining_traffic",
												e.target.checked,
											)
										}
										className="size-4 rounded border-panel-border text-panel-accent focus:ring-panel-accent"
									/>
									<span>{t("userDialog.autoRenewCarryOver")}</span>
								</label>

								<label className="flex items-center gap-2 cursor-pointer select-none text-xs text-panel-text">
									<input
										type="checkbox"
										disabled={disabled}
										checked={fireOnEither}
										onChange={(e) =>
											form.setValue(
												"next_plan_fire_on_either",
												e.target.checked,
											)
										}
										className="size-4 rounded border-panel-border text-panel-accent focus:ring-panel-accent"
									/>
									<span>{t("userDialog.nextPlanFireOnEither")}</span>
								</label>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};
