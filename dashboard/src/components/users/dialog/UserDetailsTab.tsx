import { GroupSelect } from "components/labels/GroupSelect";
import { TagsSelect } from "components/labels/TagsSelect";
import { Alert, AlertDescription } from "components/ui/alert";
import { Badge } from "components/ui/badge";
import { buttonVariants } from "components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "components/ui/collapsible";
import { DataSizeField } from "components/ui/data-size-field";
import { DateTimeField } from "components/ui/date-time-field";
import { FormField } from "components/ui/form-field";
import { Input } from "components/ui/input";
import { Label } from "components/ui/label";
import { NumberField } from "components/ui/number-field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectItemText,
	SelectTrigger,
	SelectValue,
} from "components/ui/select";
import { Switch } from "components/ui/switch";
import { Textarea } from "components/ui/textarea";
import { resetStrategy } from "constants/UserSettings";
import dayjs from "dayjs";
import { cn } from "lib/cn";
import { ChevronDown, LoaderCircle, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Dispatch, FC, SetStateAction } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { ServiceSummary } from "types/Service";
import type { Status } from "types/User";
import { addQuickExpiry } from "utils/expiry";
import { UnitInput } from "./UnitInput";
import {
	deriveDaysFromSeconds,
	isDecimalDraft,
	ON_HOLD_QUICK_DAYS,
} from "./userDialog.helpers";
import type {
	AutoRenewRule,
	FormType,
	RuleDraft,
} from "./userDialog.types";

type QuickExpiryOption = {
	label: string;
	amount: number;
	unit: "month" | "year";
};

type UserDetailsTabProps = {
	form: UseFormReturn<FormType>;
	isRTL: boolean;
	isEditing: boolean;
	disabled: boolean;
	serviceSelectionDisabled: boolean;
	statusNotice: string | null;
	isServiceManagedUser: boolean;
	editingServiceName?: string | null;
	userManagementLocked: boolean;
	showServiceSelector: boolean;
	servicesLoading: boolean;
	services: ServiceSummary[];
	selectedServiceId: number | null;
	selectedService: ServiceSummary | null;
	onSelectServiceId: (id: number) => void;
	usernameValue: string;
	randomUsernameLoading: boolean;
	onGenerateUsername: () => void;
	userStatus: Status;
	ipLimitEditable: boolean;
	speedLimitEditable: boolean;
	remainingDataInfo: string | null;
	dataLimitSet: boolean;
	isOnHold: boolean;
	expireHelperText: string | null;
	quickExpiryOptions: readonly QuickExpiryOption[];
	onToggleOnHold: () => void;
	canConfigurePeriodicUsageReset: boolean;
	hasExistingKey: boolean;
	canSetCustomKey: boolean;
	manualKeyEntryEnabled: boolean;
	autoRenewOpen: boolean;
	onAutoRenewOpenChange: (open: boolean) => void;
	autoRenewRules: AutoRenewRule[];
	ruleDraft: RuleDraft | null;
	setRuleDraft: Dispatch<SetStateAction<RuleDraft | null>>;
	onStartRuleDraft: (index: number | null) => void;
	onSaveRuleDraft: () => void;
	onDeleteRule: (index: number) => void;
	otherInfoOpen: boolean;
	onOtherInfoOpenChange: (open: boolean) => void;
	knownUserTags: string[];
	error: string | null;
};

export const UserDetailsTab: FC<UserDetailsTabProps> = ({
	form,
	isRTL,
	isEditing,
	disabled,
	serviceSelectionDisabled,
	statusNotice,
	isServiceManagedUser,
	editingServiceName,
	userManagementLocked,
	showServiceSelector,
	servicesLoading,
	services,
	selectedServiceId,
	selectedService,
	onSelectServiceId,
	usernameValue,
	randomUsernameLoading,
	onGenerateUsername,
	userStatus,
	ipLimitEditable,
	speedLimitEditable,
	remainingDataInfo,
	dataLimitSet,
	isOnHold,
	expireHelperText,
	quickExpiryOptions,
	onToggleOnHold,
	canConfigurePeriodicUsageReset,
	hasExistingKey,
	canSetCustomKey,
	manualKeyEntryEnabled,
	autoRenewOpen,
	onAutoRenewOpenChange,
	autoRenewRules,
	ruleDraft,
	setRuleDraft,
	onStartRuleDraft,
	onSaveRuleDraft,
	onDeleteRule,
	otherInfoOpen,
	onOtherInfoOpenChange,
	knownUserTags,
	error,
}) => {
	const { t } = useTranslation();
	const { errors } = form.formState;
	const hasServices = services.length > 0;
	const dataUnit = "GB";
	const speedUnit = "Mbps";
	const daysUnit = t("userDialog.days");

	return (
		<div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
			{statusNotice ? (
				<Alert className="sm:col-span-2">
					<AlertDescription>{statusNotice}</AlertDescription>
				</Alert>
			) : null}
			{isEditing && isServiceManagedUser ? (
				<Alert className="sm:col-span-2">
					<AlertDescription>
						{t("userDialog.serviceManagedNotice", {
							service: editingServiceName ?? "",
						})}
					</AlertDescription>
				</Alert>
			) : null}
			{userManagementLocked ? (
				<Alert variant="destructive" className="sm:col-span-2">
					<AlertDescription>
						{t("userDialog.managementLocked")}
					</AlertDescription>
				</Alert>
			) : null}
			{showServiceSelector && !servicesLoading && !hasServices ? (
				<Alert variant="destructive" className="sm:col-span-2">
					<AlertDescription>
						{`${t("userDialog.noServicesAvailable")} ${t("userDialog.createServiceToManage")}`}
					</AlertDescription>
				</Alert>
			) : null}

			<FormField
				label={t("username")}
				htmlFor="user-username"
				error={errors.username?.message}
				description={`${usernameValue?.length ?? 0}/32`}
				className={cn(!isEditing && "sm:col-span-2")}
			>
				<div className="relative">
					<Input
						id="user-username"
						dir={isRTL ? "rtl" : "ltr"}
						disabled={disabled || isEditing}
						aria-invalid={!!errors.username || undefined}
						className={cn(!isEditing && "pe-10")}
						{...form.register("username")}
					/>
					{!isEditing ? (
						<button
							type="button"
							aria-label={t("userDialog.generateUsername")}
							title={t("userDialog.generateUsername")}
							disabled={disabled || randomUsernameLoading}
							onClick={onGenerateUsername}
							className={cn(
								buttonVariants({ variant: "ghost", size: "icon-sm" }),
								"absolute inset-y-0.5 end-0.5",
							)}
						>
							{randomUsernameLoading ? (
								<LoaderCircle className="size-4 animate-spin" />
							) : (
								<Sparkles className="size-4" />
							)}
						</button>
					) : null}
				</div>
			</FormField>

			{isEditing ? (
				<FormField label={t("status")}>
					<div className="flex h-9 items-center justify-between rounded-md border px-3">
						<Badge variant="outline">{t(`status.${userStatus}`)}</Badge>
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
				</FormField>
			) : null}

			<Controller
				control={form.control}
				name="data_limit"
				render={({ field }) => (
					<FormField
						label={t("userDialog.dataLimit")}
						className={cn(!ipLimitEditable && "sm:col-span-2")}
						description={
							remainingDataInfo
								? `${t("userDialog.remainingDataLabel")}: ${remainingDataInfo}`
								: undefined
						}
						error={errors.data_limit?.message}
					>
						<DataSizeField
							id="user-data-limit"
							valueGb={field.value ? String(field.value) : ""}
							onChangeGb={(raw) => field.onChange(raw)}
							disabled={disabled}
							invalid={!!errors.data_limit}
						/>
					</FormField>
				)}
			/>

			{ipLimitEditable ? (
				<Controller
					control={form.control}
					name="ip_limit"
					rules={{
						validate: (value) => {
							if (value === null || value === undefined) return true;
							if (typeof value !== "number" || Number.isNaN(value))
								return t("userDialog.ipLimitValidation");
							return value >= 0 ? true : t("userDialog.ipLimitValidation");
						},
					}}
					render={({ field }) => (
						<FormField
							label={t("userDialog.ipLimitLabel")}
							error={errors.ip_limit?.message}
						>
							<NumberField
								id="user-ip-limit"
								inputMode="numeric"
								placeholder={t("userDialog.remainingDataUnlimited")}
								value={
									typeof field.value === "number" && field.value > 0
										? String(field.value)
										: ""
								}
								disabled={disabled}
								invalid={!!errors.ip_limit}
								onChange={(raw) => {
									const trimmed = raw.trim();
									if (!trimmed || trimmed === "-") {
										field.onChange(null);
										return;
									}
									const parsed = Number(trimmed);
									if (Number.isNaN(parsed)) return;
									field.onChange(parsed < 0 ? 0 : Math.floor(parsed));
								}}
							/>
						</FormField>
					)}
				/>
			) : null}

			{speedLimitEditable ? (
				<Controller
					control={form.control}
					name="speed_limit"
					render={({ field }) => (
						<FormField
							label={t("userDialog.speedLimitLabel")}
							error={errors.speed_limit?.message}
						>
							<UnitInput
								value={
									typeof field.value === "number" && field.value > 0
										? String(field.value)
										: ""
								}
								onChange={(raw) => {
									const parsed = Number(raw.trim());
									field.onChange(
										Number.isFinite(parsed) && parsed > 0
											? Math.round(parsed * 100) / 100
											: null,
									);
								}}
								unit={speedUnit}
								disabled={disabled}
								invalid={!!errors.speed_limit}
							/>
						</FormField>
					)}
				/>
			) : null}

			<div
				className={cn(
					"flex min-w-0 flex-col gap-2",
					!speedLimitEditable && "sm:col-span-2",
				)}
			>
				<Label>
					{isOnHold ? t("expires.days") : t("userDialog.expiryDate")}
				</Label>
				<div className="flex items-start gap-2">
					<div className="min-w-0 flex-1">
						{isOnHold ? (
							<Controller
								control={form.control}
								name="on_hold_expire_duration"
								render={({ field }) => (
									<UnitInput
										value={field.value ? String(field.value) : ""}
										unit={daysUnit}
										integer
										disabled={disabled}
										invalid={!!errors.on_hold_expire_duration}
										onChange={(raw) => {
											form.setValue("expire", null);
											if (!raw) {
												field.onChange(null);
												return;
											}
											if (!isDecimalDraft(raw)) return;
											const parsed = Number(raw);
											if (Number.isNaN(parsed) || parsed < 0) return;
											field.onChange(Math.round(parsed));
										}}
									/>
								)}
							/>
						) : (
							<Controller
								name="expire"
								control={form.control}
								render={({ field }) => {
									const selectedDate = field.value
										? dayjs.unix(field.value).toDate()
										: null;
									const handleDateChange = (next: Date | null) => {
										form.setValue("on_hold_expire_duration", null, {
											shouldDirty: false,
										});
										field.onChange(next ? dayjs(next).utc().unix() : null);
									};
									return (
										<>
											<DateTimeField
												id="user-expire"
												value={selectedDate}
												onChange={handleDateChange}
												placeholder={t("dateTimePicker.selectDate")}
												disabled={disabled}
												minDate={new Date()}
												quickSelects={quickExpiryOptions.map((option) => ({
													label: option.label,
													onClick: () =>
														handleDateChange(
															addQuickExpiry(
																selectedDate,
																option.amount,
																option.unit,
															),
														),
												}))}
											/>
											{expireHelperText ? (
												<p className="mt-1 text-xs text-muted-foreground">
													{expireHelperText}
												</p>
											) : null}
											{errors.expire?.message ? (
												<p role="alert" className="mt-1 text-xs text-destructive">
													{errors.expire.message}
												</p>
											) : null}
										</>
									);
								}}
							/>
						)}
					</div>
					<button
						type="button"
						disabled={disabled}
						onClick={onToggleOnHold}
						className={buttonVariants({
							variant: isOnHold ? "default" : "outline",
						})}
					>
						{t("onHold.button")}
					</button>
				</div>
				{isOnHold ? (
					<div className="grid grid-cols-6 gap-1 [&>button]:w-full [&>button]:px-0">
						{ON_HOLD_QUICK_DAYS.map((days) => (
							<button
								key={days}
								type="button"
								disabled={disabled}
								onClick={() => {
									form.setValue("expire", null);
									form.setValue("on_hold_expire_duration", days, {
										shouldDirty: true,
										shouldValidate: true,
									});
								}}
								className={buttonVariants({ variant: "outline", size: "sm" })}
							>
								{days}D
							</button>
						))}
					</div>
				) : null}
				{isOnHold && errors.on_hold_expire_duration?.message ? (
					<p role="alert" className="text-xs text-destructive">
						{errors.on_hold_expire_duration.message}
					</p>
				) : null}
			</div>

			{showServiceSelector ? (
				<FormField
					label={t("userDialog.selectServiceLabel")}
					className={cn(!dataLimitSet && "sm:col-span-2")}
					description={
						selectedService ? (
							<span className="flex flex-col gap-0.5">
								{selectedService.description ? (
									<span>{selectedService.description}</span>
								) : null}
								<span>
									{t("userDialog.serviceSummary", {
										hosts: selectedService.host_count,
										users: selectedService.user_count,
									})}
								</span>
							</span>
						) : undefined
					}
				>
					<Select
						value={selectedServiceId ? String(selectedServiceId) : ""}
						onValueChange={(value) => onSelectServiceId(Number(value))}
						disabled={serviceSelectionDisabled || servicesLoading}
					>
						<SelectTrigger
							id="user-service"
							aria-label={t("userDialog.selectServiceLabel")}
						>
							<SelectValue placeholder={t("userDialog.selectService")} />
						</SelectTrigger>
						<SelectContent>
							{services.map((service) => {
								const isBroken =
									service.broken === true || service.has_hosts === false;
								return (
									<SelectItem
										key={service.id}
										value={String(service.id)}
										disabled={isBroken}
									>
										<SelectItemText>{service.name}</SelectItemText>
										{service.description ? (
											<span className="line-clamp-2 text-xs text-muted-foreground">
												{service.description}
											</span>
										) : null}
										<span className="text-xs text-muted-foreground">
											{t("userDialog.serviceSummary", {
												hosts: service.host_count,
												users: service.user_count,
											})}
											{isBroken ? ` · ${t("userDialog.brokenService")}` : ""}
										</span>
									</SelectItem>
								);
							})}
						</SelectContent>
					</Select>
				</FormField>
			) : null}

			{dataLimitSet ? (
				<Controller
					control={form.control}
					name="data_limit_reset_strategy"
					render={({ field }) => (
						<FormField
							label={t("userDialog.periodicUsageReset")}
							className={cn(!showServiceSelector && "sm:col-span-2")}
						>
							<Select
								value={field.value}
								onValueChange={field.onChange}
								disabled={disabled || !canConfigurePeriodicUsageReset}
							>
								<SelectTrigger id="user-reset">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{resetStrategy.map((strategy) => (
										<SelectItem key={strategy.value} value={strategy.value}>
											<SelectItemText>
												{t(`userDialog.resetStrategy${strategy.title}`)}
											</SelectItemText>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormField>
					)}
				/>
			) : null}

			{hasExistingKey && canSetCustomKey ? (
				<div className="flex flex-col gap-2 sm:col-span-2">
					<Controller
						name="manual_key_entry"
						control={form.control}
						render={({ field }) => (
							<label className="flex items-center justify-between gap-3 text-sm">
								<span>{t("userDialog.allowManualKeyEntry")}</span>
								<Switch
									checked={field.value}
									disabled={disabled}
									onCheckedChange={(checked) => field.onChange(checked)}
								/>
							</label>
						)}
					/>
					{manualKeyEntryEnabled ? (
						<Controller
							name="credential_key"
							control={form.control}
							render={({ field }) => (
								<FormField
									label={t("userDialog.credentialKeyLabel")}
									description={t("userDialog.manualKeyHelper")}
									error={errors.credential_key?.message}
								>
									<Input
										placeholder="35e4e39c7d5c4f4b8b71558e4f37ff53"
										maxLength={32}
										dir="ltr"
										value={field.value ?? ""}
										disabled={disabled}
										onChange={(event) => field.onChange(event.target.value)}
									/>
								</FormField>
							)}
						/>
					) : null}
				</div>
			) : null}

			<Collapsible
				open={autoRenewOpen}
				onOpenChange={onAutoRenewOpenChange}
				className="flex flex-col gap-3 sm:col-span-2"
			>
				<CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
					{t("autoRenew.title")}
					{autoRenewRules.length > 0 ? (
						<Badge variant="secondary">{autoRenewRules.length}</Badge>
					) : null}
					<ChevronDown
						className={cn(
							"size-4 transition-transform",
							autoRenewOpen && "rotate-180",
						)}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent className="flex flex-col gap-3">
					{autoRenewRules.length === 0 && !ruleDraft ? (
						<p className="text-sm text-muted-foreground">
							{t("autoRenew.empty")}
						</p>
					) : null}
					{autoRenewRules.map((rule, idx) => {
						const dayText = deriveDaysFromSeconds(rule.expire);
						return (
							<div key={rule.id} className="flex flex-col gap-1">
								<div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
									<span>
										{rule.dataLimit !== null && rule.dataLimit !== undefined
											? `${rule.dataLimit} ${dataUnit}`
											: t("userDialog.autoRenewUnlimited")}{" "}
										·{" "}
										{dayText !== null
											? `${dayText} ${daysUnit}`
											: t("userDialog.autoRenewUnlimited")}
									</span>
									<div className="flex items-center">
										<button
											type="button"
											aria-label={t("edit")}
											disabled={disabled}
											onClick={() => onStartRuleDraft(idx)}
											className={buttonVariants({
												variant: "ghost",
												size: "icon-sm",
											})}
										>
											<Pencil />
										</button>
										<button
											type="button"
											aria-label={t("delete")}
											disabled={disabled}
											onClick={() => onDeleteRule(idx)}
											className={cn(
												buttonVariants({ variant: "ghost", size: "icon-sm" }),
												"text-destructive",
											)}
										>
											<Trash2 />
										</button>
									</div>
								</div>
								{idx > 0 ? (
									<p className="text-xs text-muted-foreground">
										{t("autoRenew.queuedNote")}
									</p>
								) : null}
							</div>
						);
					})}

					{ruleDraft ? (
						<div className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-2">
							<FormField label={t("userDialog.autoRenewDataLimit")}>
								<UnitInput
									value={ruleDraft.data}
									unit={dataUnit}
									disabled={disabled}
									onChange={(raw) => {
										if (raw === "" || isDecimalDraft(raw)) {
											setRuleDraft((draft) => draft && { ...draft, data: raw });
										}
									}}
								/>
							</FormField>
							<FormField label={t("userDialog.autoRenewTimeLimit")}>
								<UnitInput
									value={ruleDraft.days}
									unit={daysUnit}
									integer
									disabled={disabled}
									onChange={(raw) => {
										if (raw === "" || isDecimalDraft(raw)) {
											setRuleDraft((draft) => draft && { ...draft, days: raw });
										}
									}}
								/>
							</FormField>
							<div className="flex flex-wrap gap-2 sm:col-span-2">
								<button
									type="button"
									disabled={disabled}
									onClick={() =>
										setRuleDraft(
											(draft) =>
												draft && {
													...draft,
													addRemaining: !draft.addRemaining,
												},
										)
									}
									className={buttonVariants({
										variant: ruleDraft.addRemaining ? "default" : "outline",
										size: "sm",
									})}
								>
									{ruleDraft.addRemaining
										? t("userDialog.nextPlanAddRemainingTraffic")
										: t("userDialog.autoRenewResetUsage")}
								</button>
								<button
									type="button"
									disabled={disabled}
									onClick={() =>
										setRuleDraft(
											(draft) =>
												draft && {
													...draft,
													fireOnEither: !draft.fireOnEither,
												},
										)
									}
									className={buttonVariants({
										variant: ruleDraft.fireOnEither ? "default" : "outline",
										size: "sm",
									})}
								>
									{t("userDialog.nextPlanFireOnEither")}
								</button>
							</div>
							<div className="flex justify-end gap-2 sm:col-span-2">
								<button
									type="button"
									onClick={() => setRuleDraft(null)}
									className={buttonVariants({
										variant: "outline",
										size: "sm",
									})}
								>
									{t("cancel")}
								</button>
								<button
									type="button"
									disabled={disabled}
									onClick={onSaveRuleDraft}
									className={buttonVariants({ size: "sm" })}
								>
									{ruleDraft.index !== null ? t("save") : t("add")}
								</button>
							</div>
						</div>
					) : (
						<button
							type="button"
							disabled={disabled}
							onClick={() => onStartRuleDraft(null)}
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"self-start",
							)}
						>
							<Plus />
							{t("add")}
						</button>
					)}
				</CollapsibleContent>
			</Collapsible>

			<Collapsible
				open={otherInfoOpen}
				onOpenChange={onOtherInfoOpenChange}
				className="flex flex-col gap-3 sm:col-span-2"
			>
				<CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
					{t("otherInfo.title")}
					<ChevronDown
						className={cn(
							"size-4 transition-transform",
							otherInfoOpen && "rotate-180",
						)}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<FormField label={t("groups.group")}>
						<Controller
							control={form.control}
							name="group_id"
							render={({ field }) => (
								<GroupSelect
									type="user"
									value={field.value ?? null}
									onChange={field.onChange}
								/>
							)}
						/>
					</FormField>
					<FormField label={t("tags.title")}>
						<Controller
							control={form.control}
							name="tags"
							render={({ field }) => (
								<TagsSelect
									value={field.value ?? []}
									onChange={field.onChange}
									options={knownUserTags}
								/>
							)}
						/>
					</FormField>
					<FormField
						label={t("fields.note")}
						className="sm:col-span-2"
						error={errors.note?.message}
					>
						<Textarea {...form.register("note")} />
					</FormField>
					<FormField
						label={t("fields.telegramId")}
						error={errors.telegram_id?.message}
					>
						<Input dir="ltr" {...form.register("telegram_id")} />
					</FormField>
					<FormField
						label={t("fields.contactNumber")}
						error={errors.contact_number?.message}
					>
						<Input dir="ltr" {...form.register("contact_number")} />
					</FormField>
				</CollapsibleContent>
			</Collapsible>

			{error ? (
				<Alert variant="destructive" className="sm:col-span-2">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}
		</div>
	);
};
