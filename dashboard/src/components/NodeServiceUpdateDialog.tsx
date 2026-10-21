import { Button } from "components/shadcn/button";
import { FormControl, FormHelperText, FormLabel } from "components/shadcn/field";
import { Alert, AlertDescription, AlertIcon } from "components/shadcn/alert";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { AppDialog } from "components/dialogs/AppDialog";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	BuildVersionSelect,
	type BuildCatalog,
} from "./BuildVersionSelect";

export type NodeServiceUpdateChannel = "current" | "latest" | "dev";

type NodeServiceUpdateDialogProps = {
	isOpen: boolean;
	title: string;
	description?: string;
	currentChannel?: string;
	targetVersion?: string;
	devVersion?: string;
	latestVersion?: string;
	catalog?: BuildCatalog;
	isSubmitting?: boolean;
	onSubmit: (channel: NodeServiceUpdateChannel, version?: string) => Promise<void> | void;
	onClose: () => void;
};

export const NodeServiceUpdateDialog = ({
	isOpen,
	title,
	description,
	currentChannel,
	targetVersion,
	devVersion,
	latestVersion,
	catalog,
	isSubmitting = false,
	onSubmit,
	onClose,
}: NodeServiceUpdateDialogProps) => {
	const { t } = useTranslation();
	const [channel, setChannel] = useState<NodeServiceUpdateChannel>("current");
	const [version, setVersion] = useState("");

	useEffect(() => {
		if (isOpen) {
			setChannel("current");
			setVersion("");
		}
	}, [isOpen]);

	const selectedVersion =
		channel === "dev"
			? devVersion
			: channel === "latest"
				? latestVersion
				: targetVersion;
	const currentChannelLabel =
		currentChannel === "dev"
			? t("dashboard.maintenance.updateChannelDev")
			: currentChannel === "latest"
				? t("dashboard.maintenance.updateChannelLatest")
				: currentChannel;

	return (
		<AppDialog
			isOpen={isOpen}
			onClose={onClose}
			isCentered
			size="md"
			title={title}
			footer={
				<>
					<Button size="md" variant="ghost" onClick={onClose} isDisabled={isSubmitting} className="mr-3">
						{t("cancel")}
					</Button>
					<Button size="md" colorScheme="primary" onClick={() => onSubmit(channel, version || undefined)} isLoading={isSubmitting}>
						{t("nodes.updateServiceAction")}
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				{description && (
					<p className="text-panel-text-muted text-[0.875rem]">
						{description}
					</p>
				)}
				{currentChannel && (
					<p className="text-[0.75rem] text-panel-text-muted">
						{t("nodes.serviceUpdateCurrentChannel", {
							channel: currentChannelLabel,
						})}
					</p>
				)}
				<FormControl>
					<FormLabel>{t("dashboard.maintenance.updateChannel")}</FormLabel>
					<Select
						value={channel}
						onChange={(event) => {
							setChannel(event.target.value as NodeServiceUpdateChannel);
							setVersion("");
						}}
					>
						<option value="current">
							{t("dashboard.maintenance.updateChannelCurrent")}
						</option>
						<option value="latest">
							{t("dashboard.maintenance.updateChannelLatest")}
						</option>
						<option value="dev">
							{t("dashboard.maintenance.updateChannelDev")}
						</option>
					</Select>
					<FormHelperText>
						{selectedVersion
							? t("dashboard.maintenance.updateTargetHint", {
									version: selectedVersion,
								})
							: t("dashboard.maintenance.updateTargetUnknown")}
					</FormHelperText>
					</FormControl>
					<BuildVersionSelect
						catalog={catalog}
						value={version}
						onChange={(nextVersion) => {
							setVersion(nextVersion);
							const build = [...(catalog?.stable ?? []), ...(catalog?.dev ?? [])].find(
								(item) => item.version === nextVersion,
							);
							if (build) setChannel(build.channel === "dev" ? "dev" : "latest");
						}}
					/>
					{version && version !== targetVersion && (
						<Alert status="warning" className="rounded-xl text-[0.875rem]">
							<AlertIcon />
							<AlertDescription>
								{t("dashboard.maintenance.versionSwitchWarning")}
							</AlertDescription>
						</Alert>
					)}
				{channel === "dev" && (
					<Alert status="warning" className="rounded-xl text-[0.875rem]">
						<AlertIcon />
						<AlertDescription>
							{t("dashboard.maintenance.devChannelWarning")}
						</AlertDescription>
					</Alert>
				)}
			</div>
		</AppDialog>
	);
};

export default NodeServiceUpdateDialog;
