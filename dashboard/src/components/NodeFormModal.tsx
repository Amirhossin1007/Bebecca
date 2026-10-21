import { useToast } from "components/shadcn/toast";
import { useClipboard } from "hooks/useClipboard";
import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { Button, IconButton } from "components/shadcn/button";
import { Tooltip } from "components/shadcn/tooltip";
import { Collapse } from "components/shadcn/collapse";
import { Checkbox, Switch } from "components/shadcn/selection";
import { FormControl, FormErrorMessage, FormLabel } from "components/shadcn/field";
import { Textarea } from "components/shadcn/input";
import { withClass } from "components/shadcn/icon";
import { PanelSelect as Select } from "components/common/PanelSelect";
import {
	ArrowDownTrayIcon,
	DocumentDuplicateIcon,
	EyeIcon,
	EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	getNodeDefaultValues,
	NodeSchema,
	type NodeType,
} from "contexts/NodesContext";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { type Resolver, Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
	AnimatedSubmitButton,
	type AnimatedSubmitStatus,
} from "./common/AnimatedSubmitButton";
import { Input } from "./Input";
import {
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
	XrayModalHeader,
} from "./xray/XrayDialog";

const EyeIconStyled = withClass(EyeIcon, "w-4 h-4");
const EyeSlashIconStyled = withClass(EyeSlashIcon, "w-4 h-4");
const CopyIconStyled = withClass(DocumentDuplicateIcon, "w-4 h-4");
const DownloadIconStyled = withClass(ArrowDownTrayIcon, "w-4 h-4");

const BYTES_IN_GB = 1024 * 1024 * 1024;
const getInputError = (error: unknown): string | undefined => {
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		return typeof message === "string" ? message : undefined;
	}
	return undefined;
};

const getFirstInputError = (value: unknown): string | undefined => {
	const direct = getInputError(value);
	if (direct) return direct;
	if (!value || typeof value !== "object") return undefined;
	for (const nested of Object.values(value as Record<string, unknown>)) {
		const message = getFirstInputError(nested);
		if (message) return message;
	}
	return undefined;
};

const optionalPortSchema = z.preprocess(
	(value) => (value === "" || value === null ? undefined : value),
	z.coerce.number().int().min(1).max(65535).optional(),
);

const optionalNullablePortSchema = z.preprocess(
	(value) => (value === "" ? null : value),
	z.coerce.number().int().min(1).max(65535).nullable().optional(),
);

const toValidPort = (value: unknown): number | null => {
	const numeric = Number(value);
	return Number.isInteger(numeric) && numeric >= 1 && numeric <= 65535
		? numeric
		: null;
};

const buildNodeInstallBundle = (
	certificate?: string | null,
	certificateKey?: string | null,
) => {
	const cert = certificate?.trim() ?? "";
	const key = certificateKey?.trim() ?? "";
	if (cert && key) {
		return `${cert}\n${key}\n`;
	}
	return cert;
};

const EditableNodeSchema = z
	.object({
		name: z.string().trim().min(1).max(120),
		note: z.string().max(500).nullable().optional(),
		address: z.string().trim().min(1),
		port: z.coerce.number().int().min(1).max(65535),
		api_port: optionalPortSchema,
		usage_coefficient: z.coerce.number().positive(),
		data_limit: z.number().finite().nonnegative().nullable().optional(),
		proxy_enabled: z.boolean().optional(),
		proxy_type: z.enum(["http", "socks5"]).nullable().optional(),
		proxy_host: z.string().nullable().optional(),
		proxy_port: optionalNullablePortSchema,
		proxy_username: z.string().nullable().optional(),
		proxy_password: z.string().nullable().optional(),
	})
	.superRefine((value, ctx) => {
		if (!value.proxy_enabled) return;
		if (!value.proxy_type) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["proxy_type"],
				message: "Proxy type is required",
			});
		}
		if (!value.proxy_host?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["proxy_host"],
				message: "Proxy host is required",
			});
		}
		if (value.proxy_port === null || value.proxy_port === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["proxy_port"],
				message: "Proxy port must be between 1 and 65535",
			});
		}
	});
interface NodeFormModalProps {
	open: boolean;
	onClose: () => void;
	node?: NodeType;
	mutate: (
		data: any,
		options?: {
			onError?: (error: unknown) => void;
			onSuccess?: (data: NodeType) => void;
		},
	) => void;
	loading: boolean;
	isAddMode?: boolean;
	onSubmitSuccess?: (node: NodeType) => void;
}

export const NodeFormModal: FC<NodeFormModalProps> = ({
	open: isOpen,
	onClose,
	node,
	mutate,
	loading: isLoading,
	isAddMode = false,
	onSubmitSuccess,
}) => {
	const { t } = useTranslation();
	const toast = useToast();
	const [showCertificate, setShowCertificate] = useState(false);
	const [submitStatus, setSubmitStatus] =
		useState<AnimatedSubmitStatus>("idle");
	const submitResetTimerRef = useRef<number | null>(null);
	const successCloseTimerRef = useRef<number | null>(null);

	const formatDataLimitForInput = useCallback((value?: number | null) => {
		if (value === null || value === undefined) {
			return null;
		}
		const gbValue = value / BYTES_IN_GB;
		if (!Number.isFinite(gbValue)) {
			return null;
		}
		const rounded = Math.round(gbValue * 100) / 100;
		return rounded;
	}, []);

	const convertLimitToBytes = (value?: number | null) =>
		value === null || value === undefined
			? null
			: Math.round(value * BYTES_IN_GB);

	const buildMutationPayload = (data: NodeType) => {
		const apiPort = toValidPort(data.api_port);
		return {
			...(isAddMode ? {} : { id: node?.id ?? data.id }),
			name: data.name,
			note: data.note ?? "",
			address: data.address,
			control_port: Number(data.port),
			...(apiPort ? { api_port: apiPort } : {}),
			usage_coefficient: Number(data.usage_coefficient),
			data_limit: convertLimitToBytes(data.data_limit ?? null),
			proxy_enabled: Boolean(data.proxy_enabled),
			proxy_type: data.proxy_enabled ? data.proxy_type : null,
			proxy_host: data.proxy_enabled ? data.proxy_host : null,
			proxy_port: data.proxy_enabled ? toValidPort(data.proxy_port) : null,
			proxy_username: data.proxy_enabled ? data.proxy_username : null,
			proxy_password: data.proxy_enabled ? data.proxy_password : null,
		};
	};

	const baseDefaults = isAddMode
		? getNodeDefaultValues()
		: {
				...getNodeDefaultValues(),
				...node,
			};

	// The submit handler builds a NodeType payload, so that is the form's value type;
	// zod's input type is unknown and needs the bridge through the resolver cast.
	type NodeFormValues = Parameters<typeof buildMutationPayload>[0];
	const form = useForm<NodeFormValues>({
		resolver: zodResolver((isAddMode ? NodeSchema : EditableNodeSchema) as unknown as Parameters<typeof zodResolver>[0]) as unknown as Resolver<NodeFormValues>,
		defaultValues: {
			...baseDefaults,
			data_limit: formatDataLimitForInput(baseDefaults.data_limit ?? null),
		},
	});

	const nodeCertificateValue = !isAddMode
		? buildNodeInstallBundle(node?.node_certificate, node?.node_certificate_key)
		: "";
	const { onCopy: copyNodeCertificate, hasCopied: nodeCertificateCopied } =
		useClipboard(nodeCertificateValue);
	const proxyEnabled = form.watch("proxy_enabled");

	const clearSubmitTimers = useCallback(() => {
		if (submitResetTimerRef.current !== null) {
			window.clearTimeout(submitResetTimerRef.current);
			submitResetTimerRef.current = null;
		}
		if (successCloseTimerRef.current !== null) {
			window.clearTimeout(successCloseTimerRef.current);
			successCloseTimerRef.current = null;
		}
	}, []);

	useEffect(() => clearSubmitTimers, [clearSubmitTimers]);

	const showSubmitError = useCallback(() => {
		if (successCloseTimerRef.current !== null) {
			window.clearTimeout(successCloseTimerRef.current);
			successCloseTimerRef.current = null;
		}
		if (submitResetTimerRef.current !== null) {
			window.clearTimeout(submitResetTimerRef.current);
		}
		setSubmitStatus("error");
		submitResetTimerRef.current = window.setTimeout(() => {
			setSubmitStatus("idle");
			submitResetTimerRef.current = null;
		}, 900);
	}, []);

	useEffect(() => {
		if (!proxyEnabled) {
			return;
		}
		const currentType = form.getValues("proxy_type");
		if (!currentType) {
			form.setValue("proxy_type", "http");
		}
	}, [proxyEnabled, form]);

	useEffect(() => {
		if (isOpen) {
			clearSubmitTimers();
			setSubmitStatus("idle");
			const defaults = isAddMode
				? getNodeDefaultValues()
				: {
						...getNodeDefaultValues(),
						...node,
					};
			form.reset({
				...defaults,
				data_limit: formatDataLimitForInput(defaults.data_limit ?? null),
			});
			setShowCertificate(false);
		}
	}, [
		isOpen,
		isAddMode,
		node,
		form,
		formatDataLimitForInput,
		clearSubmitTimers,
	]);

	const handleSubmit = form.handleSubmit(
		(data) => {
			if (submitStatus !== "idle" || isLoading) return;
			clearSubmitTimers();
			setSubmitStatus("loading");
			const payload = buildMutationPayload(data);
			mutate(payload, {
				onError: () => {
					showSubmitError();
				},
				onSuccess: (createdOrUpdatedNode) => {
					setSubmitStatus("success");
					successCloseTimerRef.current = window.setTimeout(() => {
						successCloseTimerRef.current = null;
						handleClose();
						window.setTimeout(() => {
							onSubmitSuccess?.(createdOrUpdatedNode);
						}, 0);
					}, 1000);
				},
			});
		},
		(errors) => {
			if (submitStatus !== "idle") return;
			const message =
				getFirstInputError(errors) || "Please fix the node form fields.";
			toast({
				title: message,
				status: "error",
				isClosable: true,
				position: "top",
				duration: 3500,
			});
			showSubmitError();
		},
	);

	const handleCopyNodeCertificate = () => {
		if (!nodeCertificateValue) return;
		copyNodeCertificate();
		toast({
			title: t("copied"),
			status: "success",
			isClosable: true,
			position: "top",
			duration: 2000,
		});
	};

	const handleDownloadNodeCertificate = () => {
		if (!nodeCertificateValue) return;
		const blob = new Blob([nodeCertificateValue], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = "node_install_bundle.pem";
		anchor.click();
		URL.revokeObjectURL(url);
	};

	function handleClose() {
		clearSubmitTimers();
		setSubmitStatus("idle");
		setShowCertificate(false);
		onClose();
	}

	return (
		<Modal open={isOpen} onClose={handleClose} size="2xl" scrollBehavior="inside">
			<ModalOverlay className="bg-blackAlpha-400" />
			<XrayModalContent as="form" onSubmit={handleSubmit} className={"[.node-form-section_.chakra-simple-grid]:grid-cols-[1fr] [.node-form-section_.chakra-simple-grid]:md:grid-cols-[repeat(2,_minmax(0,_1fr))] [.node-form-section_.chakra-form-control]:block [.node-form-section_.node-switch-control]:flex [.node-form-section_.node-switch-control]:items-center [.node-form-section_.node-switch-control]:justify-between [.node-form-section_.node-switch-control]:gap-3 [.node-form-section_.chakra-form__label]:mb-1 [.node-form-section_.chakra-input__group,_.node-form-section_.chakra-numberinput,_.node-form-section_input,_.node-form-section_select]:w-full [.node-form-section_.chakra-form-control_>_.chakra-form__helper-text,_.node-form-section_.chakra-form-control_>_.chakra-form__error-message]:[grid-column:auto] mx-3"}>
				<XrayModalHeader>
					{isAddMode ? t("nodes.addNewRebeccaNode") : t("nodes.editNode")}
				</XrayModalHeader>
				<ModalCloseButton />
				<XrayModalBody>
					<div className="flex flex-col gap-4">
						{!isAddMode && nodeCertificateValue && (
							<div className="flex flex-col gap-3 xray-dialog-section">
								<div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
									<p className="font-medium min-w-0!">
										{t("nodes.certificate")}
									</p>
									<div className="flex flex-row items-center gap-2 flex-wrap justify-end">
										<Button size="xs" variant="outline" onClick={handleCopyNodeCertificate}>{<CopyIconStyled />}
											{nodeCertificateCopied ? t("copied") : t("copy")}
										</Button>
										<Button size="xs" variant="outline" onClick={handleDownloadNodeCertificate}>{<DownloadIconStyled />}
											{t("nodes.download-certificate")}
										</Button>
										<Tooltip placement="top" label={t(
												showCertificate
													? "nodes.hide-certificate"
													: "nodes.show-certificate",
											)}>
											<IconButton aria-label={t(
													showCertificate
														? "nodes.hide-certificate"
														: "nodes.show-certificate",
												)} onClick={() => setShowCertificate((prev) => !prev)} size="xs" variant="ghost">
												{showCertificate ? (
													<EyeSlashIconStyled />
												) : (
													<EyeIconStyled />
												)}
											</IconButton>
										</Tooltip>
									</div>
								</div>
								<Collapse in={showCertificate} animateOpacity>
									<div className="border rounded-md p-3 font-mono text-[0.75rem] max-h-[220px] overflow-auto bg-gray-50 dark:bg-whiteAlpha-100">
										{nodeCertificateValue}
									</div>
								</Collapse>
							</div>
						)}

						<div className="flex flex-col gap-3 xray-dialog-section node-form-section">
							<p className="text-[0.875rem] font-semibold">
								{t("nodes.connectionSettings")}
							</p>
							{isAddMode && (
								<Checkbox checked disabled className="pointer-events-none">
									{t("nodes.certInfoOption")}
								</Checkbox>
							)}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<Input
									label={t("nodes.nodeName")}
									size="sm"
									placeholder="Rebecca-S2"
									maxLength={120}
									{...form.register("name")}
									error={getInputError(form.formState?.errors?.name)}
								/>
								<Input
									label={t("nodes.nodeAddress")}
									size="sm"
									placeholder="192.168.1.1 or 2001:db8::1"
									{...form.register("address")}
									error={getInputError(form.formState?.errors?.address)}
								/>
							</div>
							<FormControl isInvalid={Boolean(form.formState?.errors?.note)}>
								<FormLabel>{t("fields.note")}</FormLabel>
								<Textarea size="sm" maxLength={500} rows={3} placeholder={t("nodes.notePlaceholder")} {...form.register("note")} />
								<FormErrorMessage>
									{getInputError(form.formState?.errors?.note)}
								</FormErrorMessage>
							</FormControl>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<Input
									label={t("nodes.controlPort")}
									size="sm"
									placeholder="62050"
									{...form.register("port")}
									error={getInputError(form.formState?.errors?.port)}
								/>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<Input
									label={t("nodes.usageCoefficient")}
									size="sm"
									placeholder="1"
									{...form.register("usage_coefficient")}
									error={getInputError(
										form.formState?.errors?.usage_coefficient,
									)}
								/>
								<FormControl>
									<Input
										label={t("nodes.dataLimitField")}
										size="sm"
										type="number"
										step={0.01}
										min={0}
										placeholder={t("nodes.dataLimitPlaceholder")}
										{...form.register("data_limit", {
											setValueAs: (value) => {
												if (
													value === "" ||
													value === null ||
													value === undefined
												) {
													return null;
												}
												const parsed = Number(value);
												return Number.isFinite(parsed) ? parsed : Number.NaN;
											},
											validate: (value) => {
												if (value === null || value === undefined) {
													return true;
												}
												if (Number.isNaN(value)) {
													return t("nodes.dataLimitValidation");
												}
												return value >= 0 || t("nodes.dataLimitPositive");
											},
										})}
										error={getInputError(form.formState?.errors?.data_limit)}
									/>
									<p className="text-[0.75rem] text-gray-500 mt-1">
										{t("nodes.dataLimitHint")}
									</p>
								</FormControl>
							</div>
							<FormControl className="node-switch-control rb-dialog-switch-row">
								<FormLabel className="mb-0">{t("nodes.useProxy")}</FormLabel>
								<Controller
									control={form.control}
									name="proxy_enabled"
									render={({ field }) => (
										<Switch checked={Boolean(field.value)} onChange={(event) => field.onChange(event.target.checked)} />
									)}
								/>
							</FormControl>
							<Collapse in={Boolean(proxyEnabled)} animateOpacity>
								<div className="flex flex-col gap-3 mt-2 xray-dialog-section node-form-section">
									<p className="text-[0.875rem] font-semibold">
										{t("nodes.proxySettings")}
									</p>
									<FormControl isInvalid={
											!!getInputError(form.formState?.errors?.proxy_type)
										}>
										<FormLabel>{t("nodes.proxyType")}</FormLabel>
										<Controller
											control={form.control}
											name="proxy_type"
											render={({ field }) => (
												<Select
													size="sm"
													placeholder={t("nodes.proxyTypePlaceholder")}
													name={field.name}
													value={field.value ?? ""}
													onBlur={field.onBlur}
													onValueChange={(value) =>
														field.onChange(value || null)
													}
													options={[
														{ value: "http", label: "HTTP" },
														{ value: "socks5", label: "SOCKS5" },
													]}
												/>
											)}
										/>
										<FormErrorMessage>
											{getInputError(form.formState?.errors?.proxy_type)}
										</FormErrorMessage>
									</FormControl>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<Input
											label={t("nodes.proxyHost")}
											size="sm"
											placeholder="proxy.example.com"
											{...form.register("proxy_host")}
											error={getInputError(form.formState?.errors?.proxy_host)}
										/>
										<Input
											label={t("nodes.proxyPort")}
											size="sm"
											type="number"
											min={1}
											max={65535}
											placeholder="8080"
											{...form.register("proxy_port", {
												setValueAs: (value) => {
													if (
														value === "" ||
														value === null ||
														value === undefined
													) {
														return null;
													}
													const parsed = Number(value);
													return Number.isFinite(parsed) ? parsed : Number.NaN;
												},
											})}
											error={getInputError(form.formState?.errors?.proxy_port)}
										/>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<Input
											label={t("nodes.proxyUsername")}
											size="sm"
											placeholder="user"
											{...form.register("proxy_username")}
											error={getInputError(
												form.formState?.errors?.proxy_username,
											)}
										/>
										<Input
											label={t("nodes.proxyPassword")}
											size="sm"
											type="password"
											placeholder="••••••••"
											{...form.register("proxy_password")}
											error={getInputError(
												form.formState?.errors?.proxy_password,
											)}
										/>
									</div>
									<p className="text-[0.75rem] text-gray-500">
										{t("nodes.proxyHint")}
									</p>
								</div>
							</Collapse>
						</div>
					</div>
				</XrayModalBody>
				<XrayModalFooter className="justify-end">
					<Button variant="outline" size="sm" onClick={handleClose}>
						{t("cancel")}
					</Button>
					<AnimatedSubmitButton status={submitStatus} idleContent={isAddMode ? t("nodes.addNode") : t("nodes.editNode")} successLabel={t("userDialog.submitSuccess")} disabled={isLoading} type="submit" containerProps={{ className: "w-full sm:w-[180px]" }} />
				</XrayModalFooter>
			</XrayModalContent>
		</Modal>
	);
};
