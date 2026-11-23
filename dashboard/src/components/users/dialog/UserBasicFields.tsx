import { GroupSelect } from "components/labels/GroupSelect";
import { TagsSelect } from "components/labels/TagsSelect";
import { Badge } from "components/ui/badge";
import { FormField } from "components/ui/form-field";
import { Input } from "components/ui/input";
import { Switch } from "components/ui/switch";
import { cn } from "lib/cn";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { FC } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { FormType } from "./UserDialog.types";

type UserBasicFieldsProps = {
	form: UseFormReturn<FormType>;
	isEditing: boolean;
	disabled: boolean;
	randomUsernameLoading: boolean;
	onGenerateRandomUsername: () => void;
	knownTags: string[];
};

export const UserBasicFields: FC<UserBasicFieldsProps> = ({
	form,
	isEditing,
	disabled,
	randomUsernameLoading,
	onGenerateRandomUsername,
	knownTags,
}) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const { errors } = form.formState;
	const usernameValue = form.watch("username");
	const userStatus = form.watch("status");

	return (
		<div className="flex flex-col gap-3.5 rounded-2xl border border-panel-border bg-panel-surface p-4 shadow-xs">
			<div className="flex items-center justify-between pb-2 border-b border-panel-border/60">
				<div className="flex items-center gap-2">
					<span className="size-2 rounded-full bg-panel-accent" />
					<h4 className="text-xs font-semibold text-panel-text uppercase tracking-wider">
						{t("userDialog.basicInfo")}
					</h4>
				</div>
				{isEditing && (
					<div className="flex items-center gap-2">
						<Badge
							variant="outline"
							className={cn(
								"text-[10px] font-semibold px-2 py-0.5 rounded-lg border",
								userStatus === "active"
									? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
									: "border-panel-border bg-panel-elevated text-panel-text-muted",
							)}
						>
							{t(`status.${userStatus}`)}
						</Badge>
						<Controller
							name="status"
							control={form.control}
							render={({ field }) => (
								<Switch
									aria-label={t("status")}
									checked={field.value === "active"}
									disabled={disabled}
									onCheckedChange={(checked) =>
										field.onChange(checked ? "active" : "disabled")
									}
								/>
							)}
						/>
					</div>
				)}
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div
					className={cn(
						"flex flex-col gap-1.5",
						isEditing ? "sm:col-span-2" : "sm:col-span-2",
					)}
				>
					<FormField
						label={t("username")}
						htmlFor="user-username"
						error={errors.username?.message}
						description={`${usernameValue?.length ?? 0}/32`}
					>
						<div className="relative">
							<Input
								id="user-username"
								dir={isRTL ? "rtl" : "ltr"}
								disabled={disabled || isEditing}
								aria-invalid={Boolean(errors.username)}
								className={cn(
									"h-9 rounded-xl border border-panel-border bg-panel-card text-xs font-medium text-panel-text transition-colors",
									!isEditing && "pe-9",
								)}
								{...form.register("username")}
							/>
							{!isEditing && (
								<button
									type="button"
									aria-label={t("userDialog.generateUsername")}
									title={t("userDialog.generateUsername")}
									disabled={disabled || randomUsernameLoading}
									onClick={onGenerateRandomUsername}
									className="absolute inset-y-1 end-1 flex size-7 items-center justify-center rounded-lg text-panel-text-muted transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-accent cursor-pointer active:scale-95 disabled:pointer-events-none"
								>
									{randomUsernameLoading ? (
										<LoaderCircle className="size-3.5 animate-spin text-panel-accent" />
									) : (
										<Sparkles className="size-3.5" />
									)}
								</button>
							)}
						</div>
					</FormField>
				</div>

				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<FormField label={t("userDialog.note")} htmlFor="user-note">
						<Input
							id="user-note"
							placeholder={t("userDialog.optional")}
							disabled={disabled}
							className="h-9 rounded-xl border border-panel-border bg-panel-card text-xs text-panel-text placeholder:text-panel-text-muted"
							{...form.register("note")}
						/>
					</FormField>
				</div>

				<div className="flex flex-col gap-1.5">
					<FormField label={t("labels.group")} htmlFor="user-group">
						<Controller
							name="group_id"
							control={form.control}
							render={({ field }) => (
								<GroupSelect
									type="user"
									value={field.value}
									onChange={field.onChange}
									disabled={disabled}
								/>
							)}
						/>
					</FormField>
				</div>

				<div className="flex flex-col gap-1.5">
					<FormField label={t("labels.tags")} htmlFor="user-tags">
						<Controller
							name="tags"
							control={form.control}
							render={({ field }) => (
								<TagsSelect
									value={field.value ?? []}
									onChange={field.onChange}
									options={knownTags}
									placeholder={t("labels.selectTags")}
									disabled={disabled}
								/>
							)}
						/>
					</FormField>
				</div>
			</div>
		</div>
	);
};
