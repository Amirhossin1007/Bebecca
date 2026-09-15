import {
	Box,
	Button,
	Checkbox,
	Collapse,
	chakra,
	FormControl,
	FormErrorMessage,
	FormLabel,
	HStack,
	IconButton,
	Modal,
	ModalCloseButton,
	ModalOverlay,
	SimpleGrid,
	Stack,
	Switch,
	Text,
	Textarea,
	Tooltip,
	useClipboard,
	useToast,
} from "@chakra-ui/react";
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
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
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

const EyeIconStyled = chakra(EyeIcon, { baseStyle: { w: 4, h: 4 } });
const EyeSlashIconStyled = chakra(EyeSlashIcon, { baseStyle: { w: 4, h: 4 } });
const CopyIconStyled = chakra(DocumentDuplicateIcon, {
	baseStyle: { w: 4, h: 4 },
});
const DownloadIconStyled = chakra(ArrowDownTrayIcon, {
	baseStyle: { w: 4, h: 4 },
});

const BYTES_IN_GB = 1024 * 1024 * 1024;
const getInputError = (error: unknown): string | undefined => {
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		return typeof message === "string" ? message : undefined;
	}
	return undefined;
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
interface NodeFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	node?: NodeType;
	mutate: (
		data: any,
		options?: {
			onError?: (error: unknown) => void;
			onSuccess?: (data: NodeType) => void;
		},
	) => void;
	isLoading: boolean;
	isAddMode?: boolean;
	onSubmitSuccess?: (node: NodeType) => void;
}

export const NodeFormModal: FC<NodeFormModalProps> = ({
	isOpen,
	onClose,
	node,
	mutate,
	isLoading,
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

	const buildMutationPayload = (data: NodeType) => ({
		...(isAddMode ? {} : { id: node?.id ?? data.id }),
		name: data.name,
		note: data.note ?? "",
		address: data.address,
		control_port: Number(data.port),
		...(Number.isFinite(Number(data.api_port))
			? { api_port: Number(data.api_port) }
			: {}),
		usage_coefficient: Number(data.usage_coefficient),
		data_limit: convertLimitToBytes(data.data_limit ?? null),
		proxy_enabled: Boolean(data.proxy_enabled),
		proxy_type: data.proxy_enabled ? data.proxy_type : null,
		proxy_host: data.proxy_enabled ? data.proxy_host : null,
		proxy_port:
			data.proxy_enabled &&
			data.proxy_port !== null &&
			data.proxy_port !== undefined
				? Number(data.proxy_port)
				: null,
		proxy_username: data.proxy_enabled ? data.proxy_username : null,
		proxy_password: data.proxy_enabled ? data.proxy_password : null,
	});

	const baseDefaults = isAddMode
		? getNodeDefaultValues()
		: {
				...getNodeDefaultValues(),
				...node,
			};

	const form = useForm({
		resolver: zodResolver(NodeSchema),
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
		() => {
			if (submitStatus !== "idle") return;
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
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			size="2xl"
			scrollBehavior="inside"
		>
			<ModalOverlay bg="blackAlpha.400" />
			<XrayModalContent
				mx="3"
				as="form"
				onSubmit={handleSubmit}
				sx={{
					".node-form-section .chakra-simple-grid": {
						gridTemplateColumns: {
							base: "1fr",
							md: "repeat(2, minmax(0, 1fr))",
						},
					},
					".node-form-section .chakra-form-control": {
						display: "block",
					},
					".node-form-section .node-switch-control": {
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 3,
					},
					".node-form-section .chakra-form__label": {
						mb: 1,
					},
					".node-form-section .chakra-input__group, .node-form-section .chakra-numberinput, .node-form-section input, .node-form-section select":
						{
							w: "full",
							width: "100%",
						},
					".node-form-section .chakra-form-control > .chakra-form__helper-text, .node-form-section .chakra-form-control > .chakra-form__error-message":
						{
							gridColumn: "auto",
						},
				}}
			>
				<XrayModalHeader>
					{isAddMode ? t("nodes.addNewRebeccaNode") : t("nodes.editNode")}
				</XrayModalHeader>
				<ModalCloseButton />
				<XrayModalBody>
					<Stack spacing={4}>
						{!isAddMode && nodeCertificateValue && (
							<Stack className="xray-dialog-section" spacing={3}>
								<Stack
									direction={{ base: "column", sm: "row" }}
									justify="space-between"
									align={{ base: "stretch", sm: "center" }}
									spacing={2}
								>
									<Text fontWeight="medium" minW={0}>
										{t("nodes.certificate")}
									</Text>
									<HStack spacing={2} flexWrap="wrap" justify="flex-end">
										<Button
											size="xs"
											variant="outline"
											leftIcon={<CopyIconStyled />}
											onClick={handleCopyNodeCertificate}
										>
											{nodeCertificateCopied ? t("copied") : t("copy")}
										</Button>
										<Button
											size="xs"
											variant="outline"
											leftIcon={<DownloadIconStyled />}
											onClick={handleDownloadNodeCertificate}
										>
											{t("nodes.download-certificate")}
										</Button>
										<Tooltip
											placement="top"
											label={t(
												showCertificate
													? "nodes.hide-certificate"
													: "nodes.show-certificate",
											)}
										>
											<IconButton
												aria-label={t(
													showCertificate
														? "nodes.hide-certificate"
														: "nodes.show-certificate",
												)}
												onClick={() => setShowCertificate((prev) => !prev)}
												size="xs"
												variant="ghost"
											>
												{showCertificate ? (
													<EyeSlashIconStyled />
												) : (
													<EyeIconStyled />
												)}
											</IconButton>
										</Tooltip>
									</HStack>
								</Stack>
								<Collapse in={showCertificate} animateOpacity>
									<Box
										borderWidth="1px"
										borderRadius="md"
										p={3}
										fontFamily="mono"
										fontSize="xs"
										maxH="220px"
										overflow="auto"
										bg="gray.50"
										_dark={{ bg: "whiteAlpha.100" }}
									>
										{nodeCertificateValue}
									</Box>
								</Collapse>
							</Stack>
						)}

						<Stack
							className="xray-dialog-section node-form-section"
							spacing={3}
						>
							<Text fontSize="sm" fontWeight="semibold">
								{t("nodes.connectionSettings")}
							</Text>
							{isAddMode && (
								<Checkbox isChecked isReadOnly isDisabled pointerEvents="none">
									{t("nodes.certInfoOption")}
								</Checkbox>
							)}
							<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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
							</SimpleGrid>
							<FormControl isInvalid={Boolean(form.formState?.errors?.note)}>
								<FormLabel>{t("fields.note")}</FormLabel>
								<Textarea
									size="sm"
									maxLength={500}
									rows={3}
									placeholder={t("nodes.notePlaceholder")}
									{...form.register("note")}
								/>
								<FormErrorMessage>
									{getInputError(form.formState?.errors?.note)}
								</FormErrorMessage>
							</FormControl>
							<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
								<Input
									label={t("nodes.controlPort")}
									size="sm"
									placeholder="62050"
									{...form.register("port")}
									error={getInputError(form.formState?.errors?.port)}
								/>
							</SimpleGrid>
							<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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
									<Text fontSize="xs" color="gray.500" mt={1}>
										{t("nodes.dataLimitHint")}
									</Text>
								</FormControl>
							</SimpleGrid>
							<FormControl className="node-switch-control rb-dialog-switch-row">
								<FormLabel mb={0}>{t("nodes.useProxy")}</FormLabel>
								<Controller
									control={form.control}
									name="proxy_enabled"
									render={({ field }) => (
										<Switch
											isChecked={Boolean(field.value)}
											onChange={(event) => field.onChange(event.target.checked)}
										/>
									)}
								/>
							</FormControl>
							<Collapse in={Boolean(proxyEnabled)} animateOpacity>
								<Stack
									className="xray-dialog-section node-form-section"
									spacing={3}
									mt={2}
								>
									<Text fontSize="sm" fontWeight="semibold">
										{t("nodes.proxySettings")}
									</Text>
									<FormControl
										isInvalid={
											!!getInputError(form.formState?.errors?.proxy_type)
										}
									>
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
									<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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
									</SimpleGrid>
									<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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
									</SimpleGrid>
									<Text fontSize="xs" color="gray.500">
										{t("nodes.proxyHint")}
									</Text>
								</Stack>
							</Collapse>
						</Stack>
					</Stack>
				</XrayModalBody>
				<XrayModalFooter justifyContent="flex-end">
					<Button variant="outline" size="sm" onClick={handleClose}>
						{t("cancel")}
					</Button>
					<AnimatedSubmitButton
						status={submitStatus}
						idleContent={isAddMode ? t("nodes.addNode") : t("nodes.editNode")}
						successLabel={t("userDialog.submitSuccess")}
						isDisabled={isLoading}
						type="submit"
						containerProps={{ w: { base: "full", sm: "180px" } }}
					/>
				</XrayModalFooter>
			</XrayModalContent>
		</Modal>
	);
};
