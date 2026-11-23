import { ConfirmDialog } from "components/dialogs/ConfirmDialog";
import { Button } from "components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "components/ui/dialog";
import { useDashboard } from "contexts/DashboardContext";
import { cn } from "lib/cn";
import {
	KeyRound,
	LoaderCircle,
	Plus,
	RefreshCw,
	Trash2,
	X,
} from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserAutoRenewFields } from "./UserAutoRenewFields";
import { UserBasicFields } from "./UserBasicFields";
import { UserLimitsFields } from "./UserLimitsFields";
import { UserLinksTab } from "./UserLinksTab";
import { UserServiceFields } from "./UserServiceFields";
import { UserUsageTab } from "./UserUsageTab";
import { useUserFormLogic } from "./useUserFormLogic";

export const UserFormDialog: FC = () => {
	const { t, i18n } = useTranslation();
	const _isRTL = i18n.dir(i18n.language) === "rtl";
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	const {
		form,
		isOpen,
		isEditing,
		editingUser,
		disabled,
		loading,
		deleteLoading,
		tab,
		setTab,
		randomUsernameLoading,
		generateRandomUsername,
		submit,
		onClose,
		handleDeleteUser,
		services,
		knownTags,
		canSetCustomKey,
		canDeleteUsers,
		canResetUsage,
		canRevokeSub,
		canConfigurePeriodicReset,
		speedLimitEditable,
		ipLimitEditable,
		usageConfig,
		usageFilter,
		setUsageFilter,
		links,
		setQRCode,
	} = useUserFormLogic();

	if (!isOpen) return null;

	const title = isEditing
		? `${t("userDialog.editUserTitle")}${editingUser?.username ? ` ${editingUser.username}` : ""}`
		: t("createNewUser");

	return (
		<>
			<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<DialogContent className="max-h-[90dvh] w-full max-w-2xl gap-0 overflow-hidden rounded-[20px] border border-panel-border bg-panel-card p-0 shadow-2xl z-[1500]">
					<DialogHeader className="flex flex-row items-center justify-between border-b border-panel-border px-6 py-4">
						<div className="flex items-center gap-3">
							<div className="flex size-9 items-center justify-center rounded-xl bg-panel-accent/10 text-panel-accent">
								{isEditing ? (
									<RefreshCw className="size-4" />
								) : (
									<Plus className="size-4" />
								)}
							</div>
							<div>
								<DialogTitle className="text-sm font-bold text-panel-text">
									{title}
								</DialogTitle>
								{isEditing && editingUser?.admin_username && (
									<p className="text-[11px] text-panel-text-secondary">
										{t("userDialog.createdBy")}: {editingUser.admin_username}
									</p>
								)}
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

					{isEditing && (
						<div className="border-b border-panel-border px-6 py-2.5 bg-panel-surface/40">
							<div className="flex items-center rounded-xl border border-panel-border bg-panel-surface p-1">
								<button
									type="button"
									onClick={() => setTab("details")}
									className={cn(
										"flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer",
										tab === "details"
											? "bg-panel-accent text-white shadow-xs"
											: "text-panel-text-secondary min-[769px]:hover:text-panel-text",
									)}
								>
									{t("userDialog.tabs.details", "Details")}
								</button>
								<button
									type="button"
									onClick={() => setTab("usage")}
									className={cn(
										"flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer",
										tab === "usage"
											? "bg-panel-accent text-white shadow-xs"
											: "text-panel-text-secondary min-[769px]:hover:text-panel-text",
									)}
								>
									{t("userDialog.tabs.usage", "Usage")}
								</button>
								<button
									type="button"
									onClick={() => setTab("links")}
									className={cn(
										"flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer",
										tab === "links"
											? "bg-panel-accent text-white shadow-xs"
											: "text-panel-text-secondary min-[769px]:hover:text-panel-text",
									)}
								>
									{t("userDialog.tabs.links", "Links")}
								</button>
							</div>
						</div>
					)}

					<div className="max-h-[calc(90dvh-140px)] overflow-y-auto px-6 py-4">
						{tab === "details" && (
							<form
								id="user-dialog-form"
								onSubmit={form.handleSubmit(submit)}
								className="flex flex-col gap-4"
							>
								<UserBasicFields
									form={form}
									isEditing={isEditing}
									disabled={disabled}
									randomUsernameLoading={randomUsernameLoading}
									onGenerateRandomUsername={generateRandomUsername}
									knownTags={knownTags}
								/>

								<UserLimitsFields
									form={form}
									disabled={disabled}
									ipLimitEditable={ipLimitEditable}
									speedLimitEditable={speedLimitEditable}
									remainingBytes={
										editingUser?.data_limit
											? Math.max(
													0,
													editingUser.data_limit -
														(editingUser.used_traffic ?? 0),
												)
											: null
									}
								/>

								<UserServiceFields
									form={form}
									disabled={disabled}
									serviceSelectionDisabled={disabled}
									showServiceSelector={!isEditing || !editingUser?.service_id}
									serviceOptions={services}
									isServiceManagedUser={Boolean(editingUser?.service_id)}
									serviceName={editingUser?.service_name ?? undefined}
									canConfigurePeriodicReset={canConfigurePeriodicReset}
									canSetCustomKey={canSetCustomKey}
								/>

								<UserAutoRenewFields form={form} disabled={disabled} />
							</form>
						)}

						{tab === "usage" && editingUser && (
							<UserUsageTab
								user={editingUser}
								usageConfig={usageConfig}
								usageFilter={usageFilter}
								onUsageFilterChange={setUsageFilter}
								loading={loading}
							/>
						)}

						{tab === "links" && editingUser && (
							<UserLinksTab
								links={links}
								onOpenQr={(url) => setQRCode([url], editingUser.username)}
							/>
						)}
					</div>

					<div className="flex items-center justify-between border-t border-panel-border px-6 py-3.5 bg-panel-surface/60">
						{isEditing && (
							<div className="flex items-center gap-2">
								{canDeleteUsers && (
									<button
										type="button"
										onClick={() => setDeleteConfirmOpen(true)}
										className="flex size-9 items-center justify-center rounded-xl border border-red-500/30 text-red-500 transition-colors min-[769px]:hover:bg-red-500/10 cursor-pointer active:scale-95"
										title={t("delete")}
									>
										<Trash2 className="size-4" />
									</button>
								)}
								{canResetUsage && (
									<button
										type="button"
										onClick={() => {
											useDashboard.setState({
												resetUsageUser: editingUser as any,
											});
										}}
										className="flex size-9 items-center justify-center rounded-xl border border-panel-border text-panel-text-secondary transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent cursor-pointer active:scale-95"
										title={t("userDialog.resetUsage")}
									>
										<RefreshCw className="size-4" />
									</button>
								)}
								{canRevokeSub && (
									<button
										type="button"
										onClick={() => {
											useDashboard.setState({
												revokeSubscriptionUser: editingUser as any,
											});
										}}
										className="flex size-9 items-center justify-center rounded-xl border border-panel-border text-panel-text-secondary transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent cursor-pointer active:scale-95"
										title={t("userDialog.revokeSubscription")}
									>
										<KeyRound className="size-4" />
									</button>
								)}
							</div>
						)}

						<div className="flex items-center gap-2 ms-auto">
							<Button
								type="button"
								variant="outline"
								onClick={onClose}
								className="h-9 rounded-xl border-panel-border bg-panel-surface px-4 text-xs font-medium text-panel-text"
							>
								{t("cancel")}
							</Button>
							{tab === "details" && (
								<Button
									type="submit"
									form="user-dialog-form"
									disabled={disabled || loading}
									className="h-9 gap-1.5 rounded-xl bg-panel-accent px-5 text-xs font-semibold text-white shadow-xs transition-colors min-[769px]:hover:bg-panel-accent/90 cursor-pointer active:scale-95"
								>
									{loading && (
										<LoaderCircle className="size-3.5 animate-spin" />
									)}
									<span>
										{isEditing
											? t("userDialog.editUser")
											: t("userDialog.createUser", "Create User")}
									</span>
								</Button>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{isEditing && editingUser && (
				<ConfirmDialog
					open={deleteConfirmOpen}
					loading={deleteLoading}
					colorScheme="red"
					title={t("deleteUser.title", "Delete User")}
					description={t("deleteUser.description", {
						username: editingUser.username,
					})}
					onClose={() => setDeleteConfirmOpen(false)}
					onConfirm={handleDeleteUser}
				/>
			)}
		</>
	);
};
