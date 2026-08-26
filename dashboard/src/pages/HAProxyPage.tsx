import {
	Alert,
	AlertIcon,
	Badge,
	Box,
	Button,
	Checkbox,
	Code,
	Collapse,
	Divider,
	FormControl,
	FormHelperText,
	FormLabel,
	Heading,
	HStack,
	IconButton,
	Input,
	Link,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	SimpleGrid,
	Stack,
	Switch,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Text,
	Textarea,
	useDisclosure,
	useToast,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowTopRightOnSquareIcon,
	ArrowUpTrayIcon,
	BookOpenIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	DocumentDuplicateIcon,
	PencilSquareIcon,
	PlusIcon,
	PowerIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { PanelSelect } from "components/common/PanelSelect";
import { JsonEditor } from "components/JsonEditor";
import {
	DataTable,
	type DataTableColumn,
	type DataTableRowAction,
	ResourceListCard,
} from "components/ui";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import {
	cloneHAProxyTargetForNode,
	createHAProxyConfig,
	deleteHAProxyConfig,
	getHAProxyCandidates,
	getHAProxyOverview,
	type HAProxyCandidate,
	type HAProxyCertificate,
	type HAProxyConfig,
	type HAProxyListener,
	type HAProxyNode,
	type HAProxyRoute,
	type HAProxySettings,
	type HAProxySite,
	type HAProxyTarget,
	type HAProxyTemplate,
	haproxyMatcherPriority,
	preferredHAProxyMatcher,
	previewHAProxyConfig,
	updateHAProxyConfig,
	uploadHAProxyTemplate,
} from "service/haproxy";

const defaultSettings = (): HAProxySettings => ({
	max_connections: 8192,
	inspect_delay_ms: 5000,
	connect_timeout_ms: 5000,
	client_timeout_seconds: 3600,
	server_timeout_seconds: 3600,
	health_check: true,
	check_interval_ms: 2000,
	check_rise: 2,
	check_fall: 3,
	retries: 3,
	tcp_keep_alive: true,
	dont_log_null: true,
	log_level: "info",
});

const emptyConfig = (): HAProxyConfig => ({
	id: 0,
	name: "HAProxy",
	enabled: false,
	settings: defaultSettings(),
	targets: [],
});

const emptyListener = (index: number): HAProxyListener => ({
	name: `listener-${index + 1}`,
	listen_address: "0.0.0.0",
	listen_port: index === 0 ? 443 : 550 + index - 1,
	accept_proxy_protocol: false,
	routes: [],
	sites: [],
});

const emptySite = (index: number) => ({
	enabled: true,
	is_default: false,
	name: `website-${index + 1}`,
	hostname: "",
	source: "builtin" as const,
	template_id: "builtin",
	template_url: "",
	tls_mode: "none" as const,
	certificate_domain: "",
	certificate_path: "",
	private_key_path: "",
	not_found_html: "",
});

const externalRoute = (
	index: number,
	defaultUnavailable = false,
): HAProxyRoute => ({
	name: `external-${index + 1}`,
	source: "external",
	backend_host: "127.0.0.1",
	backend_port: 1194,
	match_type: defaultUnavailable ? "sni" : "default",
	match_value: "",
});

const cloneConfig = (config: HAProxyConfig) => {
	const cloned = JSON.parse(JSON.stringify(config)) as HAProxyConfig;
	for (const target of cloned.targets) {
		for (const listener of target.listeners) {
			listener.sites =
				listener.sites ?? (listener.site?.enabled ? [listener.site] : []);
			delete listener.site;
		}
	}
	return cloned;
};

const errorText = (error: unknown) => {
	const value = error as { data?: { detail?: string }; message?: string };
	return value?.data?.detail || value?.message || String(error);
};

export default function HAProxyPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const toast = useToast();
	const queryClient = useQueryClient();
	const dialog = useDisclosure();
	const [draft, setDraft] = useState<HAProxyConfig>(emptyConfig);
	const [deleteArmed, setDeleteArmed] = useState(0);
	const overview = useQuery("haproxy-overview", getHAProxyOverview, {
		refetchOnWindowFocus: false,
	});
	const save = useMutation(
		(config: HAProxyConfig) =>
			config.id ? updateHAProxyConfig(config) : createHAProxyConfig(config),
		{
			onSuccess: async () => {
				await queryClient.invalidateQueries("haproxy-overview");
				dialog.onClose();
				toast({ title: t("haproxy.saved"), status: "success" });
			},
			onError: (error) => {
				toast({
					title: t("haproxy.saveFailed"),
					description: errorText(error),
					status: "error",
				});
			},
		},
	);
	const remove = useMutation(deleteHAProxyConfig, {
		onSuccess: async () => {
			setDeleteArmed(0);
			await queryClient.invalidateQueries("haproxy-overview");
		},
		onError: (error) => {
			toast({ title: errorText(error), status: "error" });
		},
	});
	const toggleEnabled = useMutation(
		({ config, enabled }: { config: HAProxyConfig; enabled: boolean }) =>
			updateHAProxyConfig({ ...cloneConfig(config), enabled }),
		{
			onSuccess: async (_config, variables) => {
				await queryClient.invalidateQueries("haproxy-overview");
				toast({
					title: t("haproxy.toggleSaved", {
						status: t(variables.enabled ? "haproxy.enabled" : "disabled"),
					}),
					status: "success",
				});
			},
			onError: (error) => {
				toast({
					title: t("haproxy.saveFailed"),
					description: errorText(error),
					status: "error",
				});
			},
		},
	);

	const openCreate = () => {
		setDraft(emptyConfig());
		dialog.onOpen();
	};
	const openEdit = (config: HAProxyConfig) => {
		setDraft(cloneConfig(config));
		dialog.onOpen();
	};
	const tableColumns: DataTableColumn<HAProxyConfig>[] = [
		{
			id: "name",
			header: t("haproxy.name"),
			accessor: "name",
			isPrimary: true,
			priority: "primary",
			mobilePriority: 0,
		},
		{
			id: "enabled",
			header: t("haproxy.enabled"),
			priority: "high",
			width: "120px",
			mobilePriority: 1,
			cell: (config) => {
				const isToggling =
					toggleEnabled.isLoading &&
					toggleEnabled.variables?.config.id === config.id;
				const enabled = isToggling
					? Boolean(toggleEnabled.variables?.enabled)
					: config.enabled;
				return (
					<Badge colorScheme={enabled ? "green" : "gray"}>
						{t(enabled ? "haproxy.enabled" : "disabled")}
					</Badge>
				);
			},
		},
		{
			id: "targets",
			header: t("haproxy.targets"),
			accessor: (config) => config.targets.length,
			priority: "high",
			width: "100px",
			mobilePriority: 2,
		},
		{
			id: "listeners",
			header: t("haproxy.listeners"),
			accessor: (config) =>
				config.targets.reduce(
					(total, target) => total + target.listeners.length,
					0,
				),
			priority: "medium",
			width: "110px",
			mobilePriority: 3,
		},
		{
			id: "bindings",
			header: t("haproxy.bindings"),
			accessor: (config) =>
				config.targets
					.flatMap((target) =>
						target.listeners.map(
							(listener) =>
								`${overview.data?.nodes.find((node) => node.id === target.node_id)?.name || target.node_id}:${listener.listen_port}`,
						),
					)
					.join(" · "),
			priority: "medium",
			multiline: true,
			mobilePriority: 4,
		},
	];
	const tableRowActions = (
		config: HAProxyConfig,
	): DataTableRowAction<HAProxyConfig>[] => [
		{
			id: "toggle",
			label: t(
				config.enabled ? "haproxy.disableAction" : "haproxy.enableAction",
			),
			icon: <PowerIcon width={16} />,
			isDisabled: toggleEnabled.isLoading,
			onClick: () => toggleEnabled.mutate({ config, enabled: !config.enabled }),
		},
		{
			id: "edit",
			label: t("edit"),
			icon: <PencilSquareIcon width={16} />,
			onClick: () => openEdit(config),
		},
		{
			id: "delete",
			label:
				deleteArmed === config.id ? t("haproxy.confirmDelete") : t("delete"),
			icon: <TrashIcon width={16} />,
			isDanger: true,
			isDisabled: remove.isLoading,
			onClick: () =>
				deleteArmed === config.id
					? remove.mutate(config.id)
					: setDeleteArmed(config.id),
		},
	];

	return (
		<VStack align="stretch" spacing={5}>
			<ResourceListCard
				title={t("haproxy.title")}
				summaryItems={[
					{
						label: t("haproxy.configurations"),
						value: overview.data?.configs.length ?? 0,
					},
					{
						label: t("haproxy.nodes"),
						value: overview.data?.nodes.length ?? 0,
						colorScheme: "blue",
					},
				]}
				actions={
					<HStack>
						<Button
							variant="outline"
							leftIcon={<BookOpenIcon width={17} />}
							onClick={() =>
								navigate(
									`/tutorials?doc=${encodeURIComponent("admin/haproxy/")}`,
								)
							}
						>
							{t("haproxy.tutorial")}
						</Button>
						<Button
							colorScheme="pink"
							leftIcon={<PlusIcon width={17} />}
							onClick={openCreate}
						>
							{t("haproxy.create")}
						</Button>
					</HStack>
				}
			>
				<Text color="panel.textSecondary">{t("haproxy.description")}</Text>
			</ResourceListCard>

			<DataTable
				ariaLabel={t("haproxy.configurations")}
				data={overview.data?.configs ?? []}
				columns={tableColumns}
				getRowId={(config) => String(config.id)}
				isLoading={overview.isLoading}
				loadingRows={5}
				error={overview.isError ? errorText(overview.error) : undefined}
				emptyState={
					<Text color="panel.textMuted" textAlign="center">
						{t("haproxy.empty")}
					</Text>
				}
				rowActions={tableRowActions}
				actionsDisplay="menu"
				actionsPlacement="end"
				actionsColumnWidth="60px"
				showActionsOnHover
				mobileBreakpoint="md"
			/>

			{overview.data && (
				<HAProxyDialog
					isOpen={dialog.isOpen}
					onClose={dialog.onClose}
					draft={draft}
					setDraft={setDraft}
					nodes={overview.data.nodes}
					templates={overview.data.templates}
					uploadedTemplates={overview.data.uploaded_templates}
					certificates={overview.data.certificates}
					onSave={() => save.mutate(draft)}
					isSaving={save.isLoading}
				/>
			)}
		</VStack>
	);
}

type DialogProps = {
	isOpen: boolean;
	onClose: () => void;
	draft: HAProxyConfig;
	setDraft: (config: HAProxyConfig) => void;
	nodes: HAProxyNode[];
	templates: HAProxyTemplate[];
	uploadedTemplates: HAProxyTemplate[];
	certificates: HAProxyCertificate[];
	onSave: () => void;
	isSaving: boolean;
};

function HAProxyDialog({
	isOpen,
	onClose,
	draft,
	setDraft,
	nodes,
	templates,
	uploadedTemplates,
	certificates,
	onSave,
	isSaving,
}: DialogProps) {
	const { t } = useTranslation();
	const toast = useToast();
	const queryClient = useQueryClient();
	const [targetOption, setTargetOption] = useState("");
	const [preview, setPreview] = useState<HAProxyConfig | null>(null);
	const [archive, setArchive] = useState<File | null>(null);
	const [archiveName, setArchiveName] = useState("");
	const [expandedTargets, setExpandedTargets] = useState<Set<number>>(
		new Set(),
	);
	const [cloningNodeID, setCloningNodeID] = useState(0);
	const [cloneSource, setCloneSource] = useState<HAProxyTarget | null>(null);
	const [cloneAllNodes, setCloneAllNodes] = useState(true);
	const [cloneNodeIDs, setCloneNodeIDs] = useState<Set<number>>(new Set());
	const [randomizeTemplates, setRandomizeTemplates] = useState(false);
	const previewMutation = useMutation(previewHAProxyConfig, {
		onSuccess: setPreview,
		onError: (error) => {
			toast({ title: errorText(error), status: "error" });
		},
	});
	const upload = useMutation(
		() =>
			uploadHAProxyTemplate(
				archiveName || archive?.name || "template",
				archive as File,
			),
		{
			onSuccess: async () => {
				setArchive(null);
				setArchiveName("");
				await queryClient.invalidateQueries("haproxy-overview");
				toast({ title: t("haproxy.templateUploaded"), status: "success" });
			},
			onError: (error) => {
				toast({ title: errorText(error), status: "error" });
			},
		},
	);
	const availableNodes = nodes.filter(
		(node) =>
			!draft.targets.some((target) => target.node_id === node.id) &&
			(!node.haproxy_config_id || node.haproxy_config_id === draft.id),
	);
	const firstTargetID = draft.targets[0]?.node_id;
	useEffect(() => {
		if (isOpen) {
			setExpandedTargets(new Set(firstTargetID ? [firstTargetID] : []));
		}
	}, [isOpen, firstTargetID]);
	const updateSettings = <K extends keyof HAProxySettings>(
		key: K,
		value: HAProxySettings[K],
	) => setDraft({ ...draft, settings: { ...draft.settings, [key]: value } });
	const addTarget = () => {
		const nodeID = Number(targetOption);
		if (!nodeID) return;
		setDraft({
			...draft,
			targets: [
				...draft.targets,
				{ node_id: nodeID, listeners: [emptyListener(0)] },
			],
		});
		setTargetOption("");
		setExpandedTargets((current) => new Set(current).add(nodeID));
	};
	const cloneTarget = async (
		source: HAProxyTarget,
		randomizeTemplates: boolean,
		destinationNodeIDs: number[],
	) => {
		const destinations = availableNodes.filter(
			(node) =>
				node.status !== "disabled" && destinationNodeIDs.includes(node.id),
		);
		if (destinations.length === 0) {
			toast({ title: t("haproxy.noCloneTargets"), status: "warning" });
			return;
		}
		setCloningNodeID(source.node_id);
		const results = await Promise.all(
			destinations.map(async (node) => {
				try {
					const { candidates } = await getHAProxyCandidates(node.id);
					return {
						node,
						...cloneHAProxyTargetForNode(
							source,
							node.id,
							candidates,
							templates,
							randomizeTemplates,
						),
					};
				} catch {
					return {
						node,
						target: undefined,
						missingInbounds: [] as string[],
						failed: true,
					};
				}
			}),
		);
		setCloningNodeID(0);
		const targets = results.flatMap((result) =>
			result.target ? [result.target] : [],
		);
		if (targets.length) {
			setDraft({ ...draft, targets: [...draft.targets, ...targets] });
		}
		const skipped = results.filter((result) => !result.target);
		const details = skipped
			.slice(0, 5)
			.map((result) =>
				result.failed
					? t("haproxy.cloneInspectFailed", { node: result.node.name })
					: t("haproxy.cloneMissingInbound", {
							node: result.node.name,
							inbound: result.missingInbounds.join(", "),
						}),
			)
			.join("\n");
		toast({
			title: targets.length
				? t("haproxy.cloneSuccess", { count: targets.length })
				: t("haproxy.cloneNone"),
			description: details || undefined,
			status: skipped.length ? "warning" : "success",
			duration: skipped.length ? 9000 : 4000,
		});
		setCloneSource(null);
	};
	const cloneCandidates = availableNodes.filter(
		(node) => node.status !== "disabled",
	);
	const openCloneDialog = (source: HAProxyTarget) => {
		setCloneSource(source);
		setCloneAllNodes(true);
		setCloneNodeIDs(new Set());
		setRandomizeTemplates(false);
	};

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				size="6xl"
				isCentered
				scrollBehavior="inside"
			>
				<ModalOverlay backdropFilter="blur(8px)" bg="blackAlpha.600" />
				<ModalContent
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					maxH="92vh"
				>
					<ModalHeader>
						{draft.id ? t("haproxy.editConfig") : t("haproxy.create")}
					</ModalHeader>
					<ModalCloseButton />
					<ModalBody px={{ base: 3, md: 6 }}>
						<Tabs
							colorScheme="pink"
							onChange={(index) => index === 2 && previewMutation.mutate(draft)}
						>
							<TabList overflowX="auto">
								<Tab>{t("haproxy.form")}</Tab>
								<Tab>{t("haproxy.advanced")}</Tab>
								<Tab>{t("haproxy.editor")}</Tab>
								<Tab>{t("haproxy.json")}</Tab>
							</TabList>
							<TabPanels>
								<TabPanel px={0}>
									<VStack align="stretch" spacing={5}>
										<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
											<FormControl isRequired>
												<FormLabel>{t("haproxy.name")}</FormLabel>
												<Input
													value={draft.name}
													onChange={(event) =>
														setDraft({ ...draft, name: event.target.value })
													}
												/>
											</FormControl>
											<FormControl>
												<FormLabel>{t("haproxy.enabled")}</FormLabel>
												<HStack h="40px">
													<Switch
														isChecked={draft.enabled}
														onChange={(event) =>
															setDraft({
																...draft,
																enabled: event.target.checked,
															})
														}
													/>
													<Text color="panel.textSecondary">
														{t("haproxy.enabledHelp")}
													</Text>
												</HStack>
											</FormControl>
										</SimpleGrid>
										<Alert status="info" borderRadius="xl">
											<AlertIcon />
											<Text fontSize="sm">{t("haproxy.matcherNotice")}</Text>
										</Alert>
										<HStack align="end" flexWrap="wrap">
											<FormControl maxW={{ base: "full", md: "360px" }}>
												<FormLabel>{t("haproxy.targetNode")}</FormLabel>
												<PanelSelect
													value={targetOption}
													onValueChange={(value) =>
														setTargetOption(String(value))
													}
													options={availableNodes.map((node) => ({
														value: String(node.id),
														disabled: node.status === "disabled",
														searchLabel: `${node.name} ${node.status}`,
														label: (
															<HStack>
																<Text>
																	{node.name ||
																		t("haproxy.nodeFallback", { id: node.id })}
																</Text>
																<Text fontSize="xs" color="panel.textSecondary">
																	{node.status === "disabled"
																		? t("haproxy.disabledNode")
																		: node.status}
																</Text>
															</HStack>
														),
													}))}
													placeholder={t("haproxy.selectNode")}
												/>
											</FormControl>
											<Button
												leftIcon={<PlusIcon width={16} />}
												onClick={addTarget}
												isDisabled={!targetOption}
											>
												{t("haproxy.addTarget")}
											</Button>
										</HStack>
										{draft.targets.map((target, targetIndex) => (
											<TargetEditor
												key={target.node_id}
												target={target}
												node={nodes.find((node) => node.id === target.node_id)}
												templates={templates}
												uploadedTemplates={uploadedTemplates}
												certificates={certificates}
												expanded={expandedTargets.has(target.node_id)}
												isCloning={cloningNodeID === target.node_id}
												canClone={availableNodes.some(
													(node) => node.status !== "disabled",
												)}
												onExpandedChange={(expanded) =>
													setExpandedTargets((current) => {
														const next = new Set(current);
														expanded
															? next.add(target.node_id)
															: next.delete(target.node_id);
														return next;
													})
												}
												onClone={() => openCloneDialog(target)}
												onChange={(next) =>
													setDraft({
														...draft,
														targets: draft.targets.map((item, index) =>
															index === targetIndex ? next : item,
														),
													})
												}
												onRemove={() =>
													setDraft({
														...draft,
														targets: draft.targets.filter(
															(_, index) => index !== targetIndex,
														),
													})
												}
											/>
										))}
										{draft.targets.length === 0 && (
											<Text
												color="panel.textSecondary"
												textAlign="center"
												py={8}
											>
												{t("haproxy.noTargets")}
											</Text>
										)}
										<Box
											borderWidth="1px"
											borderColor="panel.border"
											borderRadius="xl"
											p={4}
										>
											<Heading size="sm" mb={3}>
												{t("haproxy.uploadTemplate")}
											</Heading>
											<SimpleGrid
												columns={{ base: 1, md: 3 }}
												spacing={3}
												alignItems="end"
											>
												<FormControl>
													<FormLabel>{t("haproxy.templateName")}</FormLabel>
													<Input
														value={archiveName}
														onChange={(event) =>
															setArchiveName(event.target.value)
														}
													/>
												</FormControl>
												<FormControl>
													<FormLabel>{t("haproxy.zipArchive")}</FormLabel>
													<Input
														type="file"
														accept=".zip,application/zip"
														p={1}
														onChange={(event) =>
															setArchive(event.target.files?.[0] ?? null)
														}
													/>
												</FormControl>
												<Button
													leftIcon={<ArrowUpTrayIcon width={16} />}
													isDisabled={!archive}
													isLoading={upload.isLoading}
													onClick={() => upload.mutate()}
												>
													{t("upload")}
												</Button>
											</SimpleGrid>
											<Text mt={2} fontSize="sm" color="panel.textSecondary">
												{t("haproxy.uploadHelp")}
											</Text>
										</Box>
									</VStack>
								</TabPanel>
								<TabPanel px={0}>
									<AdvancedSettings
										settings={draft.settings}
										update={updateSettings}
									/>
								</TabPanel>
								<TabPanel px={0}>
									<VStack align="stretch" spacing={4}>
										<HStack justify="space-between">
											<Text color="panel.textSecondary">
												{t("haproxy.editorHelp")}
											</Text>
											<Button
												size="sm"
												onClick={() => previewMutation.mutate(draft)}
												isLoading={previewMutation.isLoading}
											>
												{t("refresh")}
											</Button>
										</HStack>
										{preview?.targets.map((target) => (
											<Box key={target.node_id}>
												<Heading size="sm" mb={2}>
													{nodes.find((node) => node.id === target.node_id)
														?.name || target.node_id}
												</Heading>
												<Textarea
													value={target.generated_config || ""}
													readOnly
													minH="420px"
													fontFamily="mono"
													fontSize="sm"
													whiteSpace="pre"
												/>
											</Box>
										))}
										{!preview && !previewMutation.isLoading && (
											<Text
												textAlign="center"
												color="panel.textSecondary"
												py={12}
											>
												{t("haproxy.previewEmpty")}
											</Text>
										)}
									</VStack>
								</TabPanel>
								<TabPanel px={0}>
									<VStack align="stretch" spacing={3}>
										<Text color="panel.textSecondary">
											{t("haproxy.jsonHelp")}
										</Text>
										<JsonEditor
											json={draft}
											onChange={() => undefined}
											readOnly
											minHeight="520px"
										/>
									</VStack>
								</TabPanel>
							</TabPanels>
						</Tabs>
					</ModalBody>
					<ModalFooter gap={3}>
						<Button variant="ghost" onClick={onClose}>
							{t("cancel")}
						</Button>
						<Button
							colorScheme="pink"
							onClick={onSave}
							isLoading={isSaving}
							isDisabled={!draft.name.trim() || draft.targets.length === 0}
						>
							{t("save")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<Modal
				isOpen={Boolean(cloneSource)}
				onClose={() => !cloningNodeID && setCloneSource(null)}
				size="lg"
				isCentered
			>
				<ModalOverlay backdropFilter="blur(8px)" bg="blackAlpha.600" />
				<ModalContent
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
				>
					<ModalHeader>{t("haproxy.cloneDialogTitle")}</ModalHeader>
					<ModalCloseButton isDisabled={Boolean(cloningNodeID)} />
					<ModalBody>
						<VStack align="stretch" spacing={4}>
							<Checkbox
								isChecked={randomizeTemplates}
								onChange={(event) =>
									setRandomizeTemplates(event.target.checked)
								}
							>
								{t("haproxy.randomizeTemplates")}
							</Checkbox>
							<Divider />
							<Checkbox
								isChecked={cloneAllNodes}
								onChange={(event) => setCloneAllNodes(event.target.checked)}
							>
								{t("haproxy.cloneAllAvailableNodes")}
							</Checkbox>
							{!cloneAllNodes && (
								<Box
									borderWidth="1px"
									borderColor="panel.border"
									borderRadius="xl"
									p={3}
									maxH="280px"
									overflowY="auto"
								>
									<Text fontSize="sm" fontWeight="semibold" mb={3}>
										{t("haproxy.cloneChooseNodes")}
									</Text>
									<VStack align="stretch">
										{cloneCandidates.map((node) => (
											<Checkbox
												key={node.id}
												isChecked={cloneNodeIDs.has(node.id)}
												onChange={(event) =>
													setCloneNodeIDs((current) => {
														const next = new Set(current);
														event.target.checked
															? next.add(node.id)
															: next.delete(node.id);
														return next;
													})
												}
											>
												{node.name ||
													t("haproxy.nodeFallback", { id: node.id })}
											</Checkbox>
										))}
									</VStack>
								</Box>
							)}
						</VStack>
					</ModalBody>
					<ModalFooter gap={3}>
						<Button
							variant="ghost"
							onClick={() => setCloneSource(null)}
							isDisabled={Boolean(cloningNodeID)}
						>
							{t("cancel")}
						</Button>
						<Button
							colorScheme="pink"
							leftIcon={<DocumentDuplicateIcon width={16} />}
							isLoading={Boolean(cloningNodeID)}
							isDisabled={
								!cloneSource ||
								cloneCandidates.length === 0 ||
								(!cloneAllNodes && cloneNodeIDs.size === 0)
							}
							onClick={() =>
								cloneSource &&
								cloneTarget(
									cloneSource,
									randomizeTemplates,
									cloneAllNodes
										? cloneCandidates.map((node) => node.id)
										: [...cloneNodeIDs],
								)
							}
						>
							{t("haproxy.clone")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	);
}

function TargetEditor({
	target,
	node,
	templates,
	uploadedTemplates,
	certificates,
	expanded,
	isCloning,
	canClone,
	onExpandedChange,
	onClone,
	onChange,
	onRemove,
}: {
	target: HAProxyTarget;
	node?: HAProxyNode;
	templates: HAProxyTemplate[];
	uploadedTemplates: HAProxyTemplate[];
	certificates: HAProxyCertificate[];
	expanded: boolean;
	isCloning: boolean;
	canClone: boolean;
	onExpandedChange: (expanded: boolean) => void;
	onClone: () => void;
	onChange: (target: HAProxyTarget) => void;
	onRemove: () => void;
}) {
	const { t } = useTranslation();
	const candidates = useQuery(
		["haproxy-candidates", target.node_id],
		() => getHAProxyCandidates(target.node_id),
		{ refetchOnWindowFocus: false, enabled: expanded },
	);
	return (
		<Box
			borderWidth="1px"
			borderColor="panel.border"
			borderRadius="2xl"
			p={{ base: 3, md: 4 }}
		>
			<Stack
				direction={{ base: "column", lg: "row" }}
				justify="space-between"
				align={{ lg: "center" }}
				spacing={3}
				mb={expanded ? 4 : 0}
			>
				<Box>
					<HStack>
						<Heading size="sm">
							{node?.name || t("haproxy.nodeFallback", { id: target.node_id })}
						</Heading>
						{node?.status === "disabled" && (
							<Badge colorScheme="red">{t("haproxy.disabledNode")}</Badge>
						)}
					</HStack>
					<Text fontSize="sm" color="panel.textSecondary">
						{target.listeners.length} {t("haproxy.listeners")}
					</Text>
				</Box>
				<Stack
					direction={{ base: "column", md: "row" }}
					align={{ md: "center" }}
					spacing={3}
				>
					<Button
						size="sm"
						variant="outline"
						leftIcon={<DocumentDuplicateIcon width={16} />}
						onClick={onClone}
						isLoading={isCloning}
						isDisabled={!canClone}
					>
						{t("haproxy.clone")}
					</Button>
					<IconButton
						aria-label={t(
							expanded ? "haproxy.collapseSettings" : "haproxy.expandSettings",
						)}
						icon={
							expanded ? (
								<ChevronUpIcon width={17} />
							) : (
								<ChevronDownIcon width={17} />
							)
						}
						size="sm"
						variant="ghost"
						onClick={() => onExpandedChange(!expanded)}
					/>
					<IconButton
						aria-label={t("haproxy.removeTarget")}
						icon={<TrashIcon width={17} />}
						variant="ghost"
						colorScheme="red"
						onClick={onRemove}
					/>
				</Stack>
			</Stack>
			<Collapse in={expanded} animateOpacity>
				<VStack align="stretch" spacing={4}>
					{target.listeners.map((listener, index) => (
						<ListenerEditor
							key={`${listener.name}-${index}`}
							listener={listener}
							candidates={candidates.data?.candidates ?? []}
							templates={templates}
							uploadedTemplates={uploadedTemplates}
							certificates={certificates}
							onChange={(next) =>
								onChange({
									...target,
									listeners: target.listeners.map((item, itemIndex) =>
										itemIndex === index ? next : item,
									),
								})
							}
							onRemove={() =>
								onChange({
									...target,
									listeners: target.listeners.filter(
										(_, itemIndex) => itemIndex !== index,
									),
								})
							}
						/>
					))}
					<Button
						variant="outline"
						leftIcon={<PlusIcon width={16} />}
						onClick={() =>
							onChange({
								...target,
								listeners: [
									...target.listeners,
									emptyListener(target.listeners.length),
								],
							})
						}
					>
						{t("haproxy.addListener")}
					</Button>
				</VStack>
			</Collapse>
		</Box>
	);
}

function ListenerEditor({
	listener,
	candidates,
	templates,
	uploadedTemplates,
	certificates,
	onChange,
	onRemove,
}: {
	listener: HAProxyListener;
	candidates: HAProxyCandidate[];
	templates: HAProxyTemplate[];
	uploadedTemplates: HAProxyTemplate[];
	certificates: HAProxyCertificate[];
	onChange: (listener: HAProxyListener) => void;
	onRemove: () => void;
}) {
	const { t } = useTranslation();
	const [candidateOption, setCandidateOption] = useState("");
	const [expanded, setExpanded] = useState(true);
	const sites =
		listener.sites ?? (listener.site?.enabled ? [listener.site] : []);
	const hasDefaultSite = sites.some((site) => site.enabled && site.is_default);
	const hasDefaultRoute = listener.routes.some(
		(route) => route.match_type === "default",
	);
	const candidateOptions = useMemo(
		() =>
			candidates
				.filter(
					(candidate) =>
						!listener.routes.some(
							(route) => route.inbound_tag === candidate.tag,
						),
				)
				.map((candidate) => {
					const matchers = candidate.matchers.filter(
						(matcher) => !hasDefaultSite || matcher.type !== "default",
					);
					const matcher = preferredHAProxyMatcher(matchers);
					const displayedMatcher =
						matcher ?? preferredHAProxyMatcher(candidate.matchers);
					return {
						value: candidate.tag,
						label: `${candidate.tag} · ${candidate.protocol}/${candidate.network} · ${displayedMatcher?.type}${displayedMatcher?.value ? `: ${displayedMatcher.value}` : ""}${matchers.length > 1 ? ` (+${matchers.length - 1})` : ""}`,
						disabled: !matcher,
					};
				}),
		[candidates, listener.routes, hasDefaultSite],
	);
	const addCandidate = () => {
		const candidate = candidates.find((item) => item.tag === candidateOption);
		const matcher =
			candidate &&
			preferredHAProxyMatcher(
				candidate.matchers.filter(
					(item) => !hasDefaultSite || item.type !== "default",
				),
			);
		if (!candidate || !matcher) return;
		onChange({
			...listener,
			routes: [
				...listener.routes,
				{
					name: candidate.tag,
					source: "xray",
					inbound_tag: candidate.tag,
					protocol: candidate.protocol,
					backend_host: "127.0.0.1",
					backend_port: candidate.port,
					match_type: matcher.type,
					match_value: matcher.value,
				},
			],
		});
		setCandidateOption("");
	};
	return (
		<Box
			bg="panel.surfaceMuted"
			borderWidth="1px"
			borderColor="panel.border"
			borderRadius="xl"
			p={{ base: 3, md: 4 }}
		>
			<HStack justify="space-between" mb={expanded ? 4 : 0}>
				<HStack>
					<Heading size="xs">{listener.name || t("haproxy.listener")}</Heading>
					<Badge>{listener.listen_port}</Badge>
				</HStack>
				<HStack>
					<IconButton
						aria-label={t(
							expanded ? "haproxy.collapseSettings" : "haproxy.expandSettings",
						)}
						icon={
							expanded ? (
								<ChevronUpIcon width={16} />
							) : (
								<ChevronDownIcon width={16} />
							)
						}
						size="sm"
						variant="ghost"
						onClick={() => setExpanded(!expanded)}
					/>
					<IconButton
						aria-label={t("haproxy.removeListener")}
						icon={<TrashIcon width={16} />}
						size="sm"
						variant="ghost"
						colorScheme="red"
						onClick={onRemove}
					/>
				</HStack>
			</HStack>
			<Collapse in={expanded} animateOpacity>
				<Box>
					<SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
						<FormControl>
							<FormLabel>{t("haproxy.listenerName")}</FormLabel>
							<Input
								value={listener.name}
								onChange={(event) =>
									onChange({ ...listener, name: event.target.value })
								}
							/>
						</FormControl>
						<FormControl>
							<FormLabel>{t("haproxy.listenAddress")}</FormLabel>
							<Input
								value={listener.listen_address}
								onChange={(event) =>
									onChange({ ...listener, listen_address: event.target.value })
								}
							/>
						</FormControl>
						<FormControl>
							<FormLabel>{t("haproxy.listenPort")}</FormLabel>
							<Input
								type="number"
								min={1}
								max={65535}
								value={listener.listen_port}
								onChange={(event) =>
									onChange({
										...listener,
										listen_port: Number(event.target.value),
									})
								}
							/>
						</FormControl>
					</SimpleGrid>
					<HStack my={3}>
						<Switch
							isChecked={listener.accept_proxy_protocol}
							onChange={(event) =>
								onChange({
									...listener,
									accept_proxy_protocol: event.target.checked,
								})
							}
						/>
						<Text fontSize="sm">{t("haproxy.acceptProxy")}</Text>
					</HStack>
					<Divider borderColor="panel.border" my={4} />
					<FormControl>
						<FormLabel>{t("haproxy.compatibleInbound")}</FormLabel>
						<Stack
							direction={{ base: "column", lg: "row" }}
							align={{ lg: "center" }}
							spacing={3}
						>
							<PanelSelect
								flex="1"
								showSearch
								value={candidateOption}
								onValueChange={(value) => setCandidateOption(String(value))}
								options={candidateOptions}
								placeholder={t("haproxy.selectInbound")}
							/>
							<Button
								onClick={addCandidate}
								isDisabled={
									!candidateOption ||
									candidateOptions.some(
										(option) =>
											option.value === candidateOption && option.disabled,
									)
								}
								leftIcon={<PlusIcon width={16} />}
							>
								{t("haproxy.addInbound")}
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									onChange({
										...listener,
										routes: [
											...listener.routes,
											externalRoute(listener.routes.length, hasDefaultSite),
										],
									})
								}
							>
								{t("haproxy.addExternal")}
							</Button>
						</Stack>
						<FormHelperText>{t("haproxy.matcherPriorityHelp")}</FormHelperText>
					</FormControl>
					<VStack align="stretch" spacing={2} mt={3}>
						{listener.routes.map((route, index) => (
							<RouteEditor
								key={`${route.name}-${index}`}
								route={route}
								candidate={candidates.find(
									(candidate) => candidate.tag === route.inbound_tag,
								)}
								defaultUnavailable={hasDefaultSite}
								onChange={(next) =>
									onChange({
										...listener,
										routes: listener.routes.map((item, itemIndex) =>
											itemIndex === index ? next : item,
										),
									})
								}
								onRemove={() =>
									onChange({
										...listener,
										routes: listener.routes.filter(
											(_, itemIndex) => itemIndex !== index,
										),
									})
								}
							/>
						))}
					</VStack>
					<Divider borderColor="panel.border" my={4} />
					<HStack justify="space-between">
						<Box>
							<Text fontWeight="semibold">{t("haproxy.websites")}</Text>
							<Text fontSize="sm" color="panel.textSecondary">
								{t("haproxy.websitesHelp")}
							</Text>
						</Box>
						<Button
							size="sm"
							leftIcon={<PlusIcon width={15} />}
							onClick={() =>
								onChange({
									...listener,
									sites: [...sites, emptySite(sites.length)],
									site: undefined,
								})
							}
						>
							{t("haproxy.addWebsite")}
						</Button>
					</HStack>
					<VStack align="stretch" spacing={3} mt={3}>
						{sites.map((site, index) => (
							<SiteEditor
								key={`${site.name || "site"}-${index}`}
								site={site}
								templates={templates}
								uploadedTemplates={uploadedTemplates}
								certificates={certificates}
								isFirst={index === 0}
								defaultUnavailable={hasDefaultRoute}
								hostnameRequired={hasDefaultSite && !site.is_default}
								onChange={(next) =>
									onChange({
										...listener,
										sites: sites.map((item, itemIndex) =>
											itemIndex === index ? next : item,
										),
										site: undefined,
									})
								}
								onRemove={() =>
									onChange({
										...listener,
										sites: sites.filter((_, itemIndex) => itemIndex !== index),
										site: undefined,
									})
								}
							/>
						))}
					</VStack>
				</Box>
			</Collapse>
		</Box>
	);
}

function SiteEditor({
	site,
	templates,
	uploadedTemplates,
	certificates,
	isFirst,
	defaultUnavailable,
	hostnameRequired,
	onChange,
	onRemove,
}: {
	site: HAProxySite;
	templates: HAProxyTemplate[];
	uploadedTemplates: HAProxyTemplate[];
	certificates: HAProxyCertificate[];
	isFirst: boolean;
	defaultUnavailable: boolean;
	hostnameRequired: boolean;
	onChange: (site: HAProxySite) => void;
	onRemove: () => void;
}) {
	const { t } = useTranslation();
	const [expanded, setExpanded] = useState(true);
	const [templateMode, setTemplateMode] = useState<"catalog" | "url">(
		site.template_url ? "url" : "catalog",
	);
	const sourceTemplates =
		site.source === "upload" ? uploadedTemplates : templates;
	const selectedTemplate = sourceTemplates.find(
		(item) => item.id === site.template_id,
	);
	const previewURL = site.template_url || selectedTemplate?.preview_url;
	const tlsMode = site.tls_mode || "none";
	return (
		<Box borderWidth="1px" borderColor="panel.border" borderRadius="xl" p={3}>
			<Stack
				direction={{ base: "column", md: "row" }}
				justify="space-between"
				align={{ md: "center" }}
				spacing={3}
				mb={site.enabled && expanded ? 3 : 0}
			>
				<HStack>
					<Switch
						isChecked={site.enabled}
						onChange={(event) =>
							onChange({
								...site,
								enabled: event.target.checked,
								is_default: event.target.checked ? site.is_default : false,
							})
						}
					/>
					<Text fontWeight="semibold">{site.name || t("haproxy.website")}</Text>
					<Badge>
						{site.is_default
							? t("haproxy.websiteModeHTTPAndHTTPS")
							: tlsMode === "none"
								? t("haproxy.websiteModeHTTP")
								: t("haproxy.websiteModeTLSSNI")}
					</Badge>
				</HStack>
				<HStack spacing={4}>
					{isFirst && (
						<Checkbox
							isChecked={Boolean(site.is_default)}
							isDisabled={!site.enabled || defaultUnavailable}
							title={
								defaultUnavailable ? t("haproxy.defaultAlreadyUsed") : undefined
							}
							onChange={(event) =>
								onChange({ ...site, is_default: event.target.checked })
							}
						>
							{t("haproxy.defaultWebsite")}
						</Checkbox>
					)}
					<IconButton
						aria-label={t(
							site.enabled && expanded
								? "haproxy.collapseSettings"
								: "haproxy.expandSettings",
						)}
						icon={
							site.enabled && expanded ? (
								<ChevronUpIcon width={15} />
							) : (
								<ChevronDownIcon width={15} />
							)
						}
						size="sm"
						variant="ghost"
						isDisabled={!site.enabled}
						onClick={() => setExpanded(!expanded)}
					/>
					<IconButton
						aria-label={t("haproxy.removeWebsite")}
						icon={<TrashIcon width={15} />}
						size="sm"
						variant="ghost"
						colorScheme="red"
						onClick={onRemove}
					/>
				</HStack>
			</Stack>
			<Collapse in={site.enabled && expanded} animateOpacity>
				<VStack align="stretch" spacing={3}>
					<SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
						<FormControl>
							<FormLabel>{t("haproxy.websiteName")}</FormLabel>
							<Input
								value={site.name || ""}
								onChange={(event) =>
									onChange({ ...site, name: event.target.value })
								}
							/>
						</FormControl>
						<FormControl
							isRequired={
								(tlsMode !== "none" && !site.is_default) || hostnameRequired
							}
						>
							<FormLabel>{t("haproxy.hostname")}</FormLabel>
							<Input
								value={site.hostname || ""}
								placeholder="site.example.com"
								onChange={(event) =>
									onChange({ ...site, hostname: event.target.value })
								}
							/>
						</FormControl>
						<FormControl>
							<FormLabel>{t("haproxy.tlsMode")}</FormLabel>
							<PanelSelect
								value={tlsMode}
								onValueChange={(value) =>
									onChange({
										...site,
										tls_mode: String(value) as HAProxySite["tls_mode"],
									})
								}
								options={[
									{ value: "none", label: t("haproxy.noTLS") },
									{ value: "self_signed", label: t("haproxy.selfSigned") },
									{ value: "managed", label: t("haproxy.managedCertificate") },
									{ value: "custom", label: t("haproxy.customCertificate") },
								]}
							/>
						</FormControl>
					</SimpleGrid>
					{tlsMode === "managed" && (
						<FormControl isRequired>
							<FormLabel>{t("haproxy.managedCertificate")}</FormLabel>
							<PanelSelect
								showSearch
								value={site.certificate_domain || ""}
								onValueChange={(value) =>
									onChange({ ...site, certificate_domain: String(value) })
								}
								options={certificates
									.filter((certificate) => certificate.status === "active")
									.map((certificate) => ({
										value: certificate.domain,
										label: certificate.domain,
									}))}
								placeholder={t("haproxy.selectCertificate")}
							/>
						</FormControl>
					)}
					{tlsMode === "custom" && (
						<SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
							<FormControl isRequired>
								<FormLabel>{t("haproxy.certificatePath")}</FormLabel>
								<Input
									value={site.certificate_path || ""}
									placeholder="/etc/ssl/fullchain.pem"
									onChange={(event) =>
										onChange({ ...site, certificate_path: event.target.value })
									}
								/>
							</FormControl>
							<FormControl isRequired>
								<FormLabel>{t("haproxy.privateKeyPath")}</FormLabel>
								<Input
									value={site.private_key_path || ""}
									placeholder="/etc/ssl/privkey.pem"
									onChange={(event) =>
										onChange({ ...site, private_key_path: event.target.value })
									}
								/>
							</FormControl>
						</SimpleGrid>
					)}
					<SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
						<FormControl>
							<FormLabel>{t("haproxy.templateSource")}</FormLabel>
							<PanelSelect
								value={site.source}
								onValueChange={(value) => {
									const source = String(value) as HAProxySite["source"];
									setTemplateMode("catalog");
									onChange({
										...site,
										source,
										template_id:
											source === "builtin"
												? "builtin"
												: source === "templatemo"
													? templates[0]?.id || ""
													: uploadedTemplates[0]?.id || "",
										template_url: "",
									});
								}}
								options={[
									{ value: "builtin", label: t("haproxy.builtinTemplate") },
									{ value: "templatemo", label: "TemplateMo" },
									{ value: "upload", label: t("haproxy.uploadedTemplate") },
								]}
							/>
						</FormControl>
						{site.source === "templatemo" && (
							<FormControl>
								<FormLabel>{t("haproxy.templateChoice")}</FormLabel>
								<PanelSelect
									value={templateMode}
									onValueChange={(value) => {
										const mode = String(value) as "catalog" | "url";
										setTemplateMode(mode);
										onChange({
											...site,
											template_id:
												mode === "catalog"
													? site.template_id || templates[0]?.id || ""
													: "",
											template_url: "",
										});
									}}
									options={[
										{
											value: "catalog",
											label: t("haproxy.templateFromList"),
										},
										{
											value: "url",
											label: t("haproxy.templateFromURL"),
										},
									]}
								/>
							</FormControl>
						)}
						{site.source === "upload" && (
							<FormControl>
								<FormLabel>{t("haproxy.template")}</FormLabel>
								<PanelSelect
									showSearch
									value={site.template_id}
									onValueChange={(value) =>
										onChange({
											...site,
											template_id: String(value),
											template_url: "",
										})
									}
									options={sourceTemplates.map((template) => ({
										value: template.id,
										label: template.name,
									}))}
									placeholder={t("haproxy.selectTemplate")}
								/>
							</FormControl>
						)}
					</SimpleGrid>
					{site.source === "templatemo" && templateMode === "catalog" && (
						<FormControl>
							<FormLabel>{t("haproxy.template")}</FormLabel>
							<PanelSelect
								showSearch
								value={site.template_id}
								onValueChange={(value) =>
									onChange({
										...site,
										template_id: String(value),
										template_url: "",
									})
								}
								options={templates.map((template) => ({
									value: template.id,
									label: template.name,
								}))}
								placeholder={t("haproxy.selectTemplate")}
							/>
						</FormControl>
					)}
					{site.source === "templatemo" && templateMode === "url" && (
						<FormControl>
							<FormLabel>{t("haproxy.templateMoURL")}</FormLabel>
							<Input
								value={site.template_url || ""}
								placeholder="https://templatemo.com/tm-632-machina"
								onChange={(event) =>
									onChange({
										...site,
										template_url: event.target.value,
										template_id: event.target.value ? "" : site.template_id,
									})
								}
							/>
							<FormHelperText>{t("haproxy.templateMoURLHelp")}</FormHelperText>
						</FormControl>
					)}
					{previewURL && (
						<Link href={previewURL} isExternal color="blue.300" fontSize="sm">
							<HStack>
								<ArrowTopRightOnSquareIcon width={15} />
								<Text>{t("haproxy.previewTemplate")}</Text>
							</HStack>
						</Link>
					)}
					<FormControl>
						<FormLabel>{t("haproxy.notFoundHTML")}</FormLabel>
						<Textarea
							value={site.not_found_html || ""}
							onChange={(event) =>
								onChange({ ...site, not_found_html: event.target.value })
							}
							minH="100px"
							fontFamily="mono"
							placeholder="<!doctype html>..."
						/>
						<FormHelperText>{t("haproxy.notFoundHelp")}</FormHelperText>
					</FormControl>
				</VStack>
			</Collapse>
		</Box>
	);
}

function RouteEditor({
	route,
	candidate,
	defaultUnavailable,
	onChange,
	onRemove,
}: {
	route: HAProxyRoute;
	candidate?: HAProxyCandidate;
	defaultUnavailable: boolean;
	onChange: (route: HAProxyRoute) => void;
	onRemove: () => void;
}) {
	const { t } = useTranslation();
	if (route.source === "xray") {
		const matchers = candidate?.matchers.length
			? candidate.matchers
			: [{ type: route.match_type, value: route.match_value || "" }];
		const availableTypes = new Set(matchers.map((matcher) => matcher.type));
		const values = Array.from(
			new Set(
				matchers
					.filter((matcher) => matcher.type === route.match_type)
					.map((matcher) => matcher.value),
			),
		);
		return (
			<Box borderWidth="1px" borderColor="panel.border" borderRadius="lg" p={3}>
				<HStack justify="space-between" align="start">
					<Box>
						<HStack>
							<Text fontWeight="semibold">{route.name}</Text>
							<Badge colorScheme="blue">Xray</Badge>
							<Code>
								{route.match_type}
								{route.match_value ? `: ${route.match_value}` : ""}
							</Code>
						</HStack>
						<Text fontSize="xs" color="panel.textSecondary">
							127.0.0.1:{route.backend_port} · {route.protocol}
						</Text>
					</Box>
					<IconButton
						aria-label={t("haproxy.removeRoute")}
						icon={<TrashIcon width={15} />}
						size="sm"
						variant="ghost"
						onClick={onRemove}
					/>
				</HStack>
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={2} mt={3}>
					<FormControl>
						<FormLabel>{t("haproxy.matchType")}</FormLabel>
						<PanelSelect
							value={route.match_type}
							onValueChange={(value) => {
								const matcher = matchers.find(
									(item) => item.type === String(value),
								);
								if (matcher)
									onChange({
										...route,
										match_type: matcher.type,
										match_value: matcher.value,
									});
							}}
							options={haproxyMatcherPriority.map((type) => ({
								value: type,
								label: type,
								disabled:
									!availableTypes.has(type) ||
									(defaultUnavailable && type === "default"),
							}))}
						/>
					</FormControl>
					<FormControl isDisabled={values.length <= 1}>
						<FormLabel>{t("haproxy.matchValue")}</FormLabel>
						{values.length > 1 ? (
							<PanelSelect
								value={route.match_value || ""}
								onValueChange={(value) =>
									onChange({ ...route, match_value: String(value) })
								}
								options={values}
							/>
						) : (
							<Input value={values[0] || ""} readOnly />
						)}
					</FormControl>
				</SimpleGrid>
			</Box>
		);
	}
	return (
		<Box borderWidth="1px" borderColor="panel.border" borderRadius="lg" p={3}>
			<SimpleGrid columns={{ base: 1, md: 5 }} spacing={2}>
				<FormControl>
					<FormLabel>{t("haproxy.routeName")}</FormLabel>
					<Input
						size="sm"
						value={route.name}
						onChange={(event) =>
							onChange({ ...route, name: event.target.value })
						}
					/>
				</FormControl>
				<FormControl>
					<FormLabel>{t("haproxy.backendHost")}</FormLabel>
					<Input
						size="sm"
						value={route.backend_host}
						onChange={(event) =>
							onChange({ ...route, backend_host: event.target.value })
						}
					/>
				</FormControl>
				<FormControl>
					<FormLabel>{t("haproxy.backendPort")}</FormLabel>
					<Input
						size="sm"
						type="number"
						value={route.backend_port}
						onChange={(event) =>
							onChange({ ...route, backend_port: Number(event.target.value) })
						}
					/>
				</FormControl>
				<FormControl>
					<FormLabel>{t("haproxy.matchType")}</FormLabel>
					<PanelSelect
						value={route.match_type}
						onValueChange={(value) =>
							onChange({
								...route,
								match_type: String(value) as HAProxyRoute["match_type"],
								match_value:
									String(value) === "default" ? "" : route.match_value,
							})
						}
						options={haproxyMatcherPriority.map((type) => ({
							value: type,
							label: type,
							disabled: defaultUnavailable && type === "default",
						}))}
					/>
				</FormControl>
				<HStack align="end">
					<FormControl isDisabled={route.match_type === "default"}>
						<FormLabel>{t("haproxy.matchValue")}</FormLabel>
						<Input
							size="sm"
							value={route.match_value || ""}
							onChange={(event) =>
								onChange({ ...route, match_value: event.target.value })
							}
						/>
					</FormControl>
					<IconButton
						aria-label={t("haproxy.removeRoute")}
						icon={<TrashIcon width={15} />}
						size="sm"
						variant="ghost"
						onClick={onRemove}
					/>
				</HStack>
			</SimpleGrid>
		</Box>
	);
}

function AdvancedSettings({
	settings,
	update,
}: {
	settings: HAProxySettings;
	update: <K extends keyof HAProxySettings>(
		key: K,
		value: HAProxySettings[K],
	) => void;
}) {
	const { t } = useTranslation();
	const number = (
		key: keyof HAProxySettings,
		label: string,
		min: number,
		max: number,
	) => (
		<FormControl>
			<FormLabel>{label}</FormLabel>
			<Input
				type="number"
				min={min}
				max={max}
				value={settings[key] as number}
				onChange={(event) => update(key, Number(event.target.value) as never)}
			/>
		</FormControl>
	);
	return (
		<VStack align="stretch" spacing={5}>
			<Alert status="warning" borderRadius="xl">
				<AlertIcon />
				<Text fontSize="sm">{t("haproxy.advancedWarning")}</Text>
			</Alert>
			<Box borderWidth="1px" borderColor="panel.border" borderRadius="xl" p={4}>
				<Heading size="sm" mb={4}>
					{t("haproxy.connectionSettings")}
				</Heading>
				<SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
					{number("max_connections", t("haproxy.maxConnections"), 128, 1000000)}
					{number("inspect_delay_ms", t("haproxy.inspectDelay"), 100, 30000)}
					{number(
						"connect_timeout_ms",
						t("haproxy.connectTimeout"),
						100,
						60000,
					)}
					{number(
						"client_timeout_seconds",
						t("haproxy.clientTimeout"),
						1,
						86400,
					)}
					{number(
						"server_timeout_seconds",
						t("haproxy.serverTimeout"),
						1,
						86400,
					)}
					{number("retries", t("haproxy.retries"), 0, 10)}
				</SimpleGrid>
			</Box>
			<Box borderWidth="1px" borderColor="panel.border" borderRadius="xl" p={4}>
				<Heading size="sm" mb={4}>
					{t("haproxy.healthChecks")}
				</Heading>
				<HStack mb={4}>
					<Switch
						isChecked={settings.health_check}
						onChange={(event) => update("health_check", event.target.checked)}
					/>
					<Text>{t("haproxy.healthCheck")}</Text>
				</HStack>
				<SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
					{number("check_interval_ms", t("haproxy.checkInterval"), 100, 60000)}
					{number("check_rise", t("haproxy.checkRise"), 1, 10)}
					{number("check_fall", t("haproxy.checkFall"), 1, 10)}
				</SimpleGrid>
			</Box>
			<Box borderWidth="1px" borderColor="panel.border" borderRadius="xl" p={4}>
				<Heading size="sm" mb={4}>
					{t("haproxy.loggingAndTCP")}
				</Heading>
				<SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
					<FormControl>
						<FormLabel>{t("haproxy.logLevel")}</FormLabel>
						<PanelSelect
							value={settings.log_level}
							onValueChange={(value) => update("log_level", String(value))}
							options={[
								"silent",
								"emerg",
								"alert",
								"crit",
								"err",
								"warning",
								"notice",
								"info",
								"debug",
							]}
						/>
					</FormControl>
					<HStack>
						<Switch
							isChecked={settings.tcp_keep_alive}
							onChange={(event) =>
								update("tcp_keep_alive", event.target.checked)
							}
						/>
						<Text>{t("haproxy.tcpKeepAlive")}</Text>
					</HStack>
					<HStack>
						<Switch
							isChecked={settings.dont_log_null}
							onChange={(event) =>
								update("dont_log_null", event.target.checked)
							}
						/>
						<Text>{t("haproxy.dontLogNull")}</Text>
					</HStack>
				</SimpleGrid>
			</Box>
		</VStack>
	);
}
