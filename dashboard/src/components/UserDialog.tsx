import { DeleteConfirmDialog } from "components/dialogs/ConfirmDialog";
import { userEntityPage } from "components/entityPage/EntityOverviews";
import { Alert, AlertDescription } from "components/ui/alert";
import { buttonVariants } from "components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "components/ui/tabs";
import { cn } from "lib/cn";
import { Ban, Check, Pencil, RotateCcw, Trash2, UserPlus } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { UserDetailsTab } from "./users/dialog/UserDetailsTab";
import { UserLinksTab } from "./users/dialog/UserLinksTab";
import { UserUsageTab } from "./users/dialog/UserUsageTab";
import type { UserDialogProps } from "./users/dialog/userDialog.types";
import { useUserDialogForm } from "./users/dialog/useUserDialogForm";

export type { FormType, UserDialogProps } from "./users/dialog/userDialog.types";

export const UserDialog: FC<UserDialogProps> = () => {
	const { t } = useTranslation();
	const dialog = useUserDialogForm();

	return (
		<Dialog
			section="users"
			page={
				dialog.editingUser && !dialog.isCreatingNewUser
					? userEntityPage(dialog.editingUser)
					: undefined
			}
			open={dialog.isOpen}
			onOpenChange={(open) => {
				if (!open && !dialog.loading) dialog.onClose();
			}}
		>
			<DialogContent
				dir={dialog.isRTL ? "rtl" : "ltr"}
				className="flex max-h-[min(640px,calc(100dvh-10rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl max-md:inset-x-3 max-md:w-auto max-md:top-[4.5rem] max-md:bottom-24 max-md:max-h-none max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0"
			>
				<form
					onSubmit={dialog.form.handleSubmit(dialog.submit)}
					className="flex min-h-0 flex-1 flex-col"
				>
					<DialogHeader className="flex-row items-center gap-3 border-b px-5 py-3.5 pe-12 text-start sm:text-start">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
							{dialog.isEditing ? (
								<Pencil className="size-4" />
							) : (
								<UserPlus className="size-4" />
							)}
						</div>
						<div className="min-w-0">
							<DialogTitle className="truncate text-base">
								{dialog.title}
							</DialogTitle>
							{dialog.isEditing &&
							dialog.hasPrivilegedRole &&
							dialog.editingUser?.admin_username ? (
								<DialogDescription className="truncate">
									{t("userDialog.createdBy")}:{" "}
									{dialog.editingUser.admin_username}
								</DialogDescription>
							) : null}
						</div>
					</DialogHeader>

					<Tabs
						value={dialog.tab}
						onValueChange={dialog.handleTabChange}
						className="flex min-h-0 flex-1 flex-col"
					>
						{dialog.isEditing ? (
							<div className="border-b px-5 pt-2.5 pb-2.5">
								<TabsList className="w-full">
									<TabsTrigger value="details">{t("details")}</TabsTrigger>
									{dialog.canViewTraffic ? (
										<TabsTrigger value="usage">
											{t("userDialog.tabs.usage")}
										</TabsTrigger>
									) : null}
									<TabsTrigger value="links">
										{t("userDialog.tabs.links")}
									</TabsTrigger>
								</TabsList>
							</div>
						) : null}

						<div
							ref={dialog.bodyRef}
							className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
						>
							{dialog.limitReached ? (
								<Alert variant="destructive" className="mb-4">
									<AlertDescription>
										{dialog.usersLimit && dialog.usersLimit > 0
											? t("userDialog.limitReachedBody", {
													limit: dialog.usersLimit,
													active: dialog.activeUsersCount ?? dialog.usersLimit,
												})
											: t("userDialog.limitReachedContent")}
									</AlertDescription>
								</Alert>
							) : null}

							<TabsContent value="details" className="mt-0">
								<UserDetailsTab
									form={dialog.form}
									isRTL={dialog.isRTL}
									isEditing={dialog.isEditing}
									disabled={dialog.disabled}
									serviceSelectionDisabled={dialog.serviceSelectionDisabled}
									statusNotice={dialog.statusNotice}
									isServiceManagedUser={dialog.isServiceManagedUser}
									editingServiceName={dialog.editingUser?.service_name}
									userManagementLocked={dialog.userManagementLocked}
									showServiceSelector={dialog.showServiceSelector}
									servicesLoading={dialog.servicesLoading}
									services={dialog.services}
									selectedServiceId={dialog.selectedServiceId}
									selectedService={dialog.selectedService}
									onSelectServiceId={dialog.setSelectedServiceId}
									usernameValue={dialog.usernameValue}
									randomUsernameLoading={dialog.randomUsernameLoading}
									onGenerateUsername={dialog.createRandomUsername}
									userStatus={dialog.userStatus}
									ipLimitEditable={dialog.ipLimitEditable}
									speedLimitEditable={dialog.speedLimitEditable}
									remainingDataInfo={dialog.remainingDataInfo}
									dataLimitSet={dialog.dataLimitSet}
									isOnHold={dialog.isOnHold}
									expireHelperText={dialog.expireHelperText}
									quickExpiryOptions={dialog.quickExpiryOptions}
									onToggleOnHold={dialog.toggleOnHold}
									canConfigurePeriodicUsageReset={
										dialog.canConfigurePeriodicUsageReset
									}
									hasExistingKey={dialog.hasExistingKey}
									canSetCustomKey={dialog.canSetCustomKey}
									manualKeyEntryEnabled={dialog.manualKeyEntryEnabled}
									autoRenewOpen={dialog.autoRenewOpen}
									onAutoRenewOpenChange={(open) => {
										dialog.setAutoRenewOpen(open);
										if (open) dialog.scrollBodyToEnd();
									}}
									autoRenewRules={dialog.autoRenewRules}
									ruleDraft={dialog.ruleDraft}
									setRuleDraft={dialog.setRuleDraft}
									onStartRuleDraft={dialog.startRuleDraft}
									onSaveRuleDraft={dialog.saveRuleDraft}
									onDeleteRule={dialog.deleteRule}
									otherInfoOpen={dialog.otherInfoOpen}
									onOtherInfoOpenChange={(open) => {
										dialog.setOtherInfoOpen(open);
										if (open) dialog.scrollBodyToEnd();
									}}
									knownUserTags={dialog.knownUserTags}
									error={dialog.error}
								/>
							</TabsContent>

							{dialog.isEditing && dialog.canViewTraffic ? (
								<TabsContent value="usage" className="mt-0">
									<UserUsageTab
										usageFilter={dialog.usageFilter}
										usage={dialog.usage}
										onFilterChange={(filter, query) => {
											dialog.setUsageFilter(filter);
											dialog.fetchUsageWithFilter(query);
										}}
									/>
								</TabsContent>
							) : null}

							{dialog.isEditing ? (
								<TabsContent value="links" className="mt-0">
									<UserLinksTab
										username={dialog.editingUser?.username ?? null}
										subscriptionLinks={dialog.subscriptionLinks}
										configItems={dialog.configItems}
										configLinksText={dialog.configLinksText}
										copiedKey={dialog.copiedKey}
										onCopy={dialog.copyValue}
										onOpenQr={(links, subLink) => {
											dialog.setQRCode(
												links,
												dialog.editingUser?.username ?? null,
											);
											dialog.setSubLink(subLink);
										}}
									/>
								</TabsContent>
							) : null}
						</div>
					</Tabs>

					<DialogFooter className="flex-row flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
						<div className="flex flex-wrap items-center gap-1.5">
							{dialog.isEditing && dialog.canDeleteUsersVisible ? (
								<DeleteConfirmDialog
									description={t("deleteUser.prompt", {
										username: dialog.editingUser?.username ?? "",
									})}
									loading={dialog.deleteLoading}
									onConfirm={dialog.handleDeleteUser}
								>
									<button
										type="button"
										aria-label={t("delete")}
										disabled={dialog.disabled}
										className={buttonVariants({
											variant: "ghost",
											size: "icon-sm",
										})}
									>
										<Trash2 className="text-destructive" />
									</button>
								</DeleteConfirmDialog>
							) : null}
							{dialog.isEditing && dialog.canResetUsageVisible ? (
								<button
									type="button"
									onClick={dialog.handleResetUsage}
									className={buttonVariants({ variant: "ghost", size: "sm" })}
								>
									<RotateCcw />
									{t("userDialog.resetUsage")}
								</button>
							) : null}
							{dialog.isEditing && dialog.canRevokeSubscriptionVisible ? (
								<button
									type="button"
									onClick={dialog.handleRevokeSubscription}
									className={buttonVariants({ variant: "ghost", size: "sm" })}
								>
									<Ban />
									{t("userDialog.revokeSubscription")}
								</button>
							) : null}
						</div>

						<button
							type="submit"
							disabled={dialog.submitDisabled}
							className={cn(buttonVariants({ size: "sm" }), "ms-auto")}
						>
							{dialog.submitStatus === "success" ? (
								<>
									<Check />
									{t("userDialog.submitSuccess")}
								</>
							) : dialog.loading ? (
								t("loading")
							) : dialog.isEditing ? (
								t("userDialog.editUser")
							) : (
								t("createUser")
							)}
						</button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
