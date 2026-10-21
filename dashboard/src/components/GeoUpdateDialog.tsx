import { FormControl, FormLabel } from "components/shadcn/field";
import { Input } from "components/shadcn/input";
import { Tooltip } from "components/shadcn/tooltip";
import { Button, IconButton } from "components/shadcn/button";
import { Checkbox, Radio, RadioGroup } from "components/shadcn/selection";
import { Alert, AlertDescription, AlertIcon } from "components/shadcn/alert";
import { withClass } from "components/shadcn/icon";
import { cn } from "lib/cn";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { AppDialog } from "components/dialogs/AppDialog";
import {
	ArrowPathIcon,
	MinusIcon,
	PlusIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetch as apiFetch } from "service/http";

type GeoFile = { id: string; name: string; url: string };

type GeoTemplate = {
	name: string;
	links?: Record<string, string>;
	files?: GeoFile[];
};

type GeoUpdateDialogProps = {
	isOpen: boolean;
	title: string;
	isSubmitting?: boolean;
	showMasterOptions?: boolean;
	defaultTemplateIndexUrl?: string;
	onSubmit: (payload: {
		mode: "template" | "manual";
		templateIndexUrl: string;
		templateName: string;
		files: GeoFile[];
		persistEnv: boolean;
		applyToNodes: boolean;
	}) => Promise<void>;
	onClose: () => void;
};

const DEFAULT_TEMPLATE_INDEX_URL =
	"https://raw.githubusercontent.com/ppouria/geo-templates/main/index.json";

const IconMinus = withClass(MinusIcon, "w-3.5 h-3.5");
const IconPlus = withClass(PlusIcon, "w-3.5 h-3.5");
const IconRefresh = withClass(ArrowPathIcon, "w-4 h-4");

const createGeoFile = (name: string, url: string): GeoFile => ({
	id:
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: `${name || "geo-file"}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
	name,
	url,
});

export const GeoUpdateDialog = ({
	isOpen,
	title,
	isSubmitting,
	showMasterOptions = false,
	defaultTemplateIndexUrl,
	onSubmit,
	onClose,
}: GeoUpdateDialogProps) => {
	const { t } = useTranslation();
	const [mode, setMode] = useState<"template" | "manual">("template");
	const [templateIndexUrl, setTemplateIndexUrl] = useState(
		DEFAULT_TEMPLATE_INDEX_URL,
	);
	const [selectedTemplate, setSelectedTemplate] = useState("");
	const [manualFiles, setManualFiles] = useState<GeoFile[]>([
		createGeoFile("geoip.dat", ""),
		createGeoFile("geosite.dat", ""),
	]);
	const [persistEnv, setPersistEnv] = useState(true);
	const [applyToNodes, setApplyToNodes] = useState(false);
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			setMode("template");
			setTemplateIndexUrl(
				defaultTemplateIndexUrl || DEFAULT_TEMPLATE_INDEX_URL,
			);
			setSelectedTemplate("");
			setManualFiles([
				createGeoFile("geoip.dat", ""),
				createGeoFile("geosite.dat", ""),
			]);
			setPersistEnv(true);
			setApplyToNodes(false);
			setSubmissionError(null);
		}
	}, [isOpen, defaultTemplateIndexUrl]);

	const templatesQuery = useQuery(
		["geo-templates", templateIndexUrl],
		() =>
			apiFetch<{ templates: GeoTemplate[] }>("/core/geo/templates", {
				query: templateIndexUrl ? { index_url: templateIndexUrl } : undefined,
			}),
		{
			enabled: isOpen && mode === "template" && Boolean(templateIndexUrl),
			staleTime: 10 * 60 * 1000,
		},
	);

	const templates = useMemo(
		() => templatesQuery.data?.templates ?? [],
		[templatesQuery.data],
	);

	useEffect(() => {
		if (templates.length > 0) {
			setSelectedTemplate((current) => current || templates[0].name);
		}
	}, [templates]);

	const manualBg = "bg-gray-50 dark:bg-whiteAlpha-50";

	const addManualFile = () => {
		setManualFiles((prev) => [...prev, createGeoFile("", "")]);
	};

	const updateManualFile = (
		index: number,
		key: keyof GeoFile,
		value: string,
	) => {
		setManualFiles((prev) =>
			prev.map((file, idx) =>
				idx === index ? { ...file, [key]: value } : file,
			),
		);
	};

	const removeManualFile = (index: number) => {
		setManualFiles((prev) => prev.filter((_, idx) => idx !== index));
	};

	const handleSubmit = async () => {
		const baseFiles: GeoFile[] =
			mode === "manual"
				? manualFiles.filter((file) => file.name.trim() && file.url.trim())
				: [];

		if (mode === "template") {
			if (!templateIndexUrl.trim()) {
				setSubmissionError(t("nodes.geoDialog.errors.missingTemplateUrl"));
				return;
			}
			if (!selectedTemplate) {
				setSubmissionError(t("nodes.geoDialog.errors.missingTemplateName"));
				return;
			}
		} else {
			if (baseFiles.length === 0) {
				setSubmissionError(t("nodes.geoDialog.errors.missingFiles"));
				return;
			}
			const invalidFile = baseFiles.find(
				(file) => !file.name.trim() || !file.url.trim(),
			);
			if (invalidFile) {
				setSubmissionError(t("nodes.geoDialog.errors.invalidFile"));
				return;
			}
		}

		setSubmissionError(null);
		const resolvedFiles = mode === "manual" ? baseFiles : [];

		try {
			await onSubmit({
				mode,
				templateIndexUrl: templateIndexUrl.trim(),
				templateName: selectedTemplate,
				files: resolvedFiles,
				persistEnv,
				applyToNodes,
			});
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: t("nodes.geoDialog.genericError");
			setSubmissionError(message);
		}
	};

	const renderManualRows = () => (
		<div className={cn("flex flex-col gap-3 p-4 rounded-md", manualBg)}>
			{manualFiles.map((file, index) => (
				<div key={file.id} className="border rounded-md p-3">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<FormControl isRequired>
							<FormLabel className="text-[0.875rem]">
								{t("nodes.geoDialog.fileNameLabel")}
							</FormLabel>
							<Input size="sm" value={file.name} placeholder="geosite.dat" onChange={(event) =>
									updateManualFile(index, "name", event.target.value)
								} />
						</FormControl>
						<FormControl isRequired>
							<FormLabel className="text-[0.875rem]">
								{t("nodes.geoDialog.fileUrlLabel")}
							</FormLabel>
							<Input size="sm" value={file.url} placeholder="https://example.com/geosite.dat" onChange={(event) =>
									updateManualFile(index, "url", event.target.value)
								} />
						</FormControl>
					</div>
					<div className="flex flex-row items-center gap-2 justify-end mt-3">
						<Tooltip label={t("remove")}>
							<IconButton aria-label={t("a11y.removeFile")} icon={<IconMinus />} variant="ghost" size="sm" onClick={() => removeManualFile(index)} isDisabled={manualFiles.length <= 1} />
						</Tooltip>
					</div>
				</div>
			))}
			<Button onClick={addManualFile} leftIcon={<IconPlus />} size="sm" variant="outline" className="self-start">
				{t("nodes.geoDialog.addFile")}
			</Button>
		</div>
	);

	return (
		<AppDialog
			isOpen={isOpen}
			onClose={onClose}
			isCentered
			size="xl"
			title={title}
			footer={
				<>
					<Button size="md" variant="ghost" onClick={onClose} className="mr-3">
						{t("cancel")}
					</Button>
					<Button size="md" colorScheme="primary" onClick={handleSubmit} isLoading={isSubmitting}>
						{t("nodes.geoDialog.confirmUpdate")}
					</Button>
				</>
			}
		>
					<div className="flex flex-col gap-4">
						<FormControl as="fieldset">
							<FormLabel as="legend" className="text-[0.875rem]">
								{t("nodes.geoDialog.modeLabel")}
							</FormLabel>
							<RadioGroup value={mode} onChange={(value) => setMode(value as "template" | "manual")}>
								<div className="flex flex-row items-center gap-4">
									<Radio value="template">
										{t("nodes.geoDialog.modeTemplate")}
									</Radio>
									<Radio value="manual">
										{t("nodes.geoDialog.modeManual")}
									</Radio>
								</div>
							</RadioGroup>
						</FormControl>

						{mode === "template" ? (
							<div className="flex flex-col gap-3">
								<FormControl isRequired>
									<FormLabel className="text-[0.875rem]">
										{t("nodes.geoDialog.templateIndexLabel")}
									</FormLabel>
									<Input size="sm" value={templateIndexUrl} onChange={(event) =>
											setTemplateIndexUrl(event.target.value)
										} />
								</FormControl>
								<FormControl isRequired>
									<FormLabel className="text-[0.875rem]">
										{t("nodes.geoDialog.templateNameLabel")}
									</FormLabel>
									<div className="flex flex-row items-center gap-2">
										<Select size="sm" value={selectedTemplate} onChange={(event) =>
												setSelectedTemplate(event.target.value)
											} isDisabled={templatesQuery.isLoading || !templates.length} placeholder={
												templatesQuery.isLoading
													? t("nodes.geoDialog.loadingTemplates")
													: t("nodes.geoDialog.selectTemplatePlaceholder")
											} className="flex-1">
											{templates.map((template) => (
												<option key={template.name} value={template.name}>
													{template.name}
												</option>
											))}
										</Select>
										<Tooltip label={t("nodes.geoDialog.refreshTemplates")}>
											<IconButton aria-label={t("a11y.refreshTemplates")} icon={<IconRefresh />} size="sm" variant="outline" onClick={() => templatesQuery.refetch()} isLoading={templatesQuery.isFetching} isDisabled={!templateIndexUrl.trim()} />
										</Tooltip>
									</div>
								</FormControl>
								{templatesQuery.isError && (
									<Alert status="error" className="rounded-md text-[0.875rem]">
										<AlertIcon />
										<AlertDescription>
											{t("nodes.geoDialog.failedToLoadTemplates")}
										</AlertDescription>
									</Alert>
								)}
							</div>
						) : (
							renderManualRows()
						)}

						{showMasterOptions && (
							<div className="flex flex-col gap-2">
								<Checkbox isChecked={persistEnv} onChange={(event) => setPersistEnv(event.target.checked)}>
									{t("nodes.geoDialog.persistAssets")}
								</Checkbox>
								<Checkbox isChecked={applyToNodes} onChange={(event) => setApplyToNodes(event.target.checked)}>
									{t("nodes.geoDialog.applyToNodes")}
								</Checkbox>
								<p className="text-[0.75rem] text-gray-500 dark:text-gray-400">
									{t("nodes.geoDialog.applyToNodesHint")}
								</p>
							</div>
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

export default GeoUpdateDialog;
