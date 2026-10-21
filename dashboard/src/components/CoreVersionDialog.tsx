import { Button } from "components/shadcn/button";
import { FormControl, FormLabel } from "components/shadcn/field";
import { Spinner } from "components/shadcn/feedback";
import { Input } from "components/shadcn/input";
import { Checkbox } from "components/shadcn/selection";
import { Alert, AlertDescription, AlertIcon } from "components/shadcn/alert";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { AppDialog } from "components/dialogs/AppDialog";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetch as apiFetch } from "service/http";

type CoreVersionDialogProps = {
	isOpen: boolean;
	title: string;
	description?: string;
	currentVersion?: string | null;
	allowPersist?: boolean;
	isSubmitting?: boolean;
	onSubmit: (payload: { version: string; persist?: boolean }) => Promise<void>;
	onClose: () => void;
};

const RELEASE_LIMIT = 10;

export const CoreVersionDialog = ({
	isOpen,
	title,
	description,
	currentVersion,
	allowPersist = false,
	isSubmitting,
	onSubmit,
	onClose,
}: CoreVersionDialogProps) => {
	const { t } = useTranslation();
	const [version, setVersion] = useState("");
	const [persist, setPersist] = useState(false);
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const releasesQuery = useQuery(
		["core-xray-releases"],
		() =>
			apiFetch<{ tags: string[] }>("/core/xray/releases", {
				query: { limit: RELEASE_LIMIT },
			}),
		{
			enabled: isOpen,
			staleTime: 5 * 60 * 1000,
		},
	);

	useEffect(() => {
		if (isOpen) {
			setVersion(currentVersion || "");
			setPersist(Boolean(allowPersist));
			setSubmissionError(null);
		}
	}, [isOpen, currentVersion, allowPersist]);

	const releaseOptions = useMemo(
		() => releasesQuery.data?.tags ?? [],
		[releasesQuery.data],
	);

	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setVersion(event.target.value);
	};

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setVersion(event.target.value);
	};

	const handleSubmit = async () => {
		if (!version) {
			setSubmissionError(t("validation.required"));
			return;
		}
		try {
			setSubmissionError(null);
			await onSubmit({ version, persist: allowPersist ? persist : undefined });
		} catch (err) {
			if (err instanceof Error) {
				setSubmissionError(err.message);
			} else {
				setSubmissionError(t("core.generalErrorMessage"));
			}
		}
	};

	const isLoadingReleases = releasesQuery.isLoading;

	return (
		<AppDialog
			isOpen={isOpen}
			onClose={onClose}
			isCentered
			size="lg"
			title={title}
			footer={
				<>
					<Button size="md" variant="ghost" onClick={onClose} className="mr-3">
						{t("cancel")}
					</Button>
					<Button size="md" colorScheme="primary" onClick={handleSubmit} isLoading={isSubmitting}>
						{t("nodes.coreVersionDialog.confirmUpdate")}
					</Button>
				</>
			}
		>
					<div className="flex flex-col gap-4">
						{description && (
							<p className="text-[0.875rem] text-gray-600 dark:text-gray-300">
								{description}
							</p>
						)}
						<FormControl>
							<FormLabel>
								{t("nodes.coreVersionDialog.latestReleases")}
							</FormLabel>
							<Select
								placeholder={
									isLoadingReleases
										? t("nodes.coreVersionDialog.loadingReleases")
										: t("nodes.coreVersionDialog.selectVersionPlaceholder")
								}
								value={
									version && releaseOptions.includes(version) ? version : ""
								}
								onChange={handleSelectChange}
								isDisabled={isLoadingReleases || releaseOptions.length === 0}
								size="sm"
							>
								{releaseOptions.map((item) => (
									<option key={item} value={item}>
										{item}
									</option>
								))}
							</Select>
							{isLoadingReleases && (
								<div className="flex flex-row items-center gap-2 mt-2">
									<Spinner size="sm" />
									<p className="text-[0.75rem] text-gray-500 dark:text-gray-400">
										{t("nodes.coreVersionDialog.fetchingFromGithub")}
									</p>
								</div>
							)}
							{releasesQuery.isError && (
								<p className="text-[0.75rem] text-red-500 mt-1">
									{t("nodes.coreVersionDialog.failedToLoadReleases")}
								</p>
							)}
						</FormControl>
						<FormControl isRequired>
							<FormLabel>
								{t("nodes.coreVersionDialog.customVersionLabel")}
							</FormLabel>
							<Input value={version} placeholder={t(
									"nodes.coreVersionDialog.customVersionPlaceholder",
								)} onChange={handleInputChange} size="sm" />
							<p className="text-[0.75rem] text-gray-500 dark:text-gray-400 mt-1">
								{t("nodes.coreVersionDialog.customVersionHelper")}
							</p>
						</FormControl>
						{allowPersist && (
							<Checkbox isChecked={persist} onChange={(event) => setPersist(event.target.checked)}>
								{t("nodes.coreVersionDialog.persistExecutable")}
							</Checkbox>
						)}
						{submissionError && (
							<Alert status="error" className="rounded-md text-[0.875rem]">
								<AlertIcon />
								<AlertDescription>{submissionError}</AlertDescription>
							</Alert>
						)}
					</div>
		</AppDialog>
	);
};

export default CoreVersionDialog;
