import { useToast } from "components/shadcn/toast";
import { useDisclosure } from "hooks/useDisclosure";
import { Badge } from "components/shadcn/badge";
import { Button, IconButton } from "components/shadcn/button";
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from "components/shadcn/dialog";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "components/shadcn/tabs";
import { FormControl, FormHelperText, FormLabel } from "components/shadcn/field";
import { Input, Textarea } from "components/shadcn/input";
import { Checkbox, Switch } from "components/shadcn/selection";
import { Alert, AlertIcon } from "components/shadcn/alert";
import { Collapse } from "components/shadcn/collapse";
import { cn } from "lib/cn";
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
			sortValue: (config) => (config.enabled ? 1 : 0),
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
			icon: <PowerIcon className="w-16" />,
			isDisabled: toggleEnabled.isLoading,
			onClick: () => toggleEnabled.mutate({ config, enabled: !config.enabled }),
		},
		{
			id: "edit",
			label: t("edit"),
			icon: <PencilSquareIcon className="w-16" />,
			onClick: () => openEdit(config),
		},
		{
			id: "delete",
			label:
				deleteArmed === config.id ? t("haproxy.confirmDelete") : t("delete"),
			icon: <TrashIcon className="w-16" />,
			isDanger: true,
			isDisabled: remove.isLoading,
			onClick: () =>
				deleteArmed === config.id
					? remove.mutate(config.id)
					: setDeleteArmed(config.id),
		},
	];

	return (
		<div className="flex flex-col items-stretch gap-5">
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
					<div className="flex flex-row items-center gap-2">
						<Button size="md" variant="outline" leftIcon={<BookOpenIcon className="w-17" />} onClick={() =>
								navigate(
									`/tutorials?doc=${encodeURIComponent("admin/haproxy/")}`,
								)
							}>
							{t("haproxy.tutorial")}
						</Button>
						<Button size="md" colorScheme="pink" leftIcon={<PlusIcon className="w-17" />} onClick={openCreate}>
							{t("haproxy.create")}
						</Button>
					</div>
				}
			>
				<p className="text-panel-text-secondary">{t("haproxy.description")}</p>
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
					<p className="text-panel-text-muted text-center">
						{t("haproxy.empty")}
					</p>
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
		</div>
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
			<Modal isOpen={isOpen} onClose={onClose} size="6xl" isCentered scrollBehavior="inside">
				<ModalOverlay className="bg-blackAlpha-600" />
				<ModalContent className="bg-panel-surface border border-panel-border! max-h-[92vh]">
					<ModalHeader>
						{draft.id ? t("haproxy.editConfig") : t("haproxy.create")}
					</ModalHeader>
					<ModalCloseButton />
					<ModalBody className="px-3 md:px-6">
						<Tabs isLazy lazyBehavior="keepMounted" colorScheme="pink" onChange={(index) => index === 2 && previewMutation.mutate(draft)}>
							<TabList className="overflow-x-auto">
								<Tab>{t("haproxy.form")}</Tab>
								<Tab>{t("haproxy.advanced")}</Tab>
								<Tab>{t("haproxy.editor")}</Tab>
								<Tab>{t("haproxy.json")}</Tab>
							</TabList>
							<TabPanels>
								<TabPanel className="px-0">
									<div className="flex flex-col items-stretch gap-5">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<FormControl isRequired>
												<FormLabel>{t("haproxy.name")}</FormLabel>
												<Input value={draft.name} onChange={(event) =>
														setDraft({ ...draft, name: event.target.value })
													} />
											</FormControl>
											<FormControl>
												<FormLabel>{t("haproxy.enabled")}</FormLabel>
												<div className="flex flex-row items-center gap-2 h-[40px]">
													<Switch isChecked={draft.enabled} onChange={(event) =>
															setDraft({
																...draft,
																enabled: event.target.checked,
															})
														} />
													<p className="text-panel-text-secondary">
														{t("haproxy.enabledHelp")}
													</p>
												</div>
											</FormControl>
										</div>
										<Alert status="info" className="rounded-xl">
											<AlertIcon />
											<p className="text-[0.875rem]">{t("haproxy.matcherNotice")}</p>
										</Alert>
										<div className="flex flex-row gap-2 items-end flex-wrap">
											<FormControl className="max-w-full md:max-w-[360px]">
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
															<div className="flex flex-row items-center gap-2">
																<p>
																	{node.name ||
																		t("haproxy.nodeFallback", { id: node.id })}
																</p>
																<p className="text-[0.75rem] text-panel-text-secondary">
																	{node.status === "disabled"
																		? t("haproxy.disabledNode")
																		: node.status}
																</p>
															</div>
														),
													}))}
													placeholder={t("haproxy.selectNode")}
												/>
											</FormControl>
											<Button variant="solid" size="md" leftIcon={<PlusIcon className="w-16" />} onClick={addTarget} isDisabled={!targetOption}>
												{t("haproxy.addTarget")}
											</Button>
										</div>
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
											<p className="text-panel-text-secondary text-center py-8">
												{t("haproxy.noTargets")}
											</p>
										)}
										<div className="border border-panel-border! rounded-xl p-4">
											<h2 className="font-heading font-bold text-[1rem] leading-[1.2] mb-3">
												{t("haproxy.uploadTemplate")}
											</h2>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
												<FormControl>
													<FormLabel>{t("haproxy.templateName")}</FormLabel>
													<Input value={archiveName} onChange={(event) =>
															setArchiveName(event.target.value)
														} />
												</FormControl>
												<FormControl>
													<FormLabel>{t("haproxy.zipArchive")}</FormLabel>
													<Input type="file" accept=".zip,application/zip" onChange={(event) =>
															setArchive(event.target.files?.[0] ?? null)
														} className="p-1" />
												</FormControl>
												<Button variant="solid" size="md" leftIcon={<ArrowUpTrayIcon className="w-16" />} isDisabled={!archive} isLoading={upload.isLoading} onClick={() => upload.mutate()}>
													{t("upload")}
												</Button>
											</div>
											<p className="mt-2 text-[0.875rem] text-panel-text-secondary">
												{t("haproxy.uploadHelp")}
											</p>
										</div>
									</div>
								</TabPanel>
								<TabPanel className="px-0">
									<AdvancedSettings
										settings={draft.settings}
										update={updateSettings}
									/>
								</TabPanel>
								<TabPanel className="px-0">
									<div className="flex flex-col items-stretch gap-4">
										<div className="flex flex-row items-center gap-2 justify-between">
											<p className="text-panel-text-secondary">
												{t("haproxy.editorHelp")}
											</p>
											<Button variant="solid" size="sm" onClick={() => previewMutation.mutate(draft)} isLoading={previewMutation.isLoading}>
												{t("refresh")}
											</Button>
										</div>
										{preview?.targets.map((target) => (
											<div key={target.node_id}>
												<h2 className="font-heading font-bold text-[1rem] leading-[1.2] mb-2">
													{nodes.find((node) => node.id === target.node_id)
														?.name || target.node_id}
												</h2>
												<Textarea value={target.generated_config || ""} readOnly className="min-h-[420px] font-mono text-[0.875rem] whitespace-pre" />
											</div>
										))}
										{!preview && !previewMutation.isLoading && (
											<p className="text-center text-panel-text-secondary py-12">
												{t("haproxy.previewEmpty")}
											</p>
										)}
									</div>
								</TabPanel>
								<TabPanel className="px-0">
									<div className="flex flex-col items-stretch gap-3">
										<p className="text-panel-text-secondary">
											{t("haproxy.jsonHelp")}
										</p>
										<JsonEditor json={draft} onChange={() => undefined} readOnly minHeight="520px" />
									</div>
								</TabPanel>
							</TabPanels>
						</Tabs>
					</ModalBody>
					<ModalFooter className="gap-3">
						<Button size="md" variant="ghost" onClick={onClose}>
							{t("cancel")}
						</Button>
						<Button size="md" colorScheme="pink" onClick={onSave} isLoading={isSaving} isDisabled={!draft.name.trim() || draft.targets.length === 0}>
							{t("save")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<Modal isOpen={Boolean(cloneSource)} onClose={() => !cloningNodeID && setCloneSource(null)} size="lg" isCentered>
				<ModalOverlay className="bg-blackAlpha-600" />
				<ModalContent className="bg-panel-surface border border-panel-border!">
					<ModalHeader>{t("haproxy.cloneDialogTitle")}</ModalHeader>
					<ModalCloseButton isDisabled={Boolean(cloningNodeID)} />
					<ModalBody>
						<div className="flex flex-col items-stretch gap-4">
							<Checkbox isChecked={randomizeTemplates} onChange={(event) =>
									setRandomizeTemplates(event.target.checked)
								}>
								{t("haproxy.randomizeTemplates")}
							</Checkbox>
							<hr className="w-full border-0 border-b border-panel-border! opacity-60" />
							<Checkbox isChecked={cloneAllNodes} onChange={(event) => setCloneAllNodes(event.target.checked)}>
								{t("haproxy.cloneAllAvailableNodes")}
							</Checkbox>
							{!cloneAllNodes && (
								<div className="border border-panel-border! rounded-xl p-3 max-h-[280px] overflow-y-auto">
									<p className="text-[0.875rem] font-semibold mb-3">
										{t("haproxy.cloneChooseNodes")}
									</p>
									<div className="flex flex-col gap-2 items-stretch">
										{cloneCandidates.map((node) => (
											<Checkbox key={node.id} isChecked={cloneNodeIDs.has(node.id)} onChange={(event) =>
													setCloneNodeIDs((current) => {
														const next = new Set(current);
														event.target.checked
															? next.add(node.id)
															: next.delete(node.id);
														return next;
													})
												}>
												{node.name ||
													t("haproxy.nodeFallback", { id: node.id })}
											</Checkbox>
										))}
									</div>
								</div>
							)}
						</div>
					</ModalBody>
					<ModalFooter className="gap-3">
						<Button size="md" variant="ghost" onClick={() => setCloneSource(null)} isDisabled={Boolean(cloningNodeID)}>
							{t("cancel")}
						</Button>
						<Button size="md" colorScheme="pink" leftIcon={<DocumentDuplicateIcon className="w-16" />} isLoading={Boolean(cloningNodeID)} isDisabled={
								!cloneSource ||
								cloneCandidates.length === 0 ||
								(!cloneAllNodes && cloneNodeIDs.size === 0)
							} onClick={() =>
								cloneSource &&
								cloneTarget(
									cloneSource,
									randomizeTemplates,
									cloneAllNodes
										? cloneCandidates.map((node) => node.id)
										: [...cloneNodeIDs],
								)
							}>
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
		<div className="border border-panel-border! rounded-2xl p-3 md:p-4">
			<div className={cn("flex flex-col lg:flex-row justify-between lg:items-center gap-3", expanded ? "mb-4" : "mb-0")}>
				<div>
					<div className="flex flex-row items-center gap-2">
						<h2 className="font-heading font-bold text-[1rem] leading-[1.2]">
							{node?.name || t("haproxy.nodeFallback", { id: target.node_id })}
						</h2>
						{node?.status === "disabled" && (
							<Badge colorScheme="red">{t("haproxy.disabledNode")}</Badge>
						)}
					</div>
					<p className="text-[0.875rem] text-panel-text-secondary">
						{target.listeners.length} {t("haproxy.listeners")}
					</p>
				</div>
				<div className="flex flex-col md:flex-row md:items-center gap-3">
					<Button size="sm" variant="outline" leftIcon={<DocumentDuplicateIcon className="w-16" />} onClick={onClone} isLoading={isCloning} isDisabled={!canClone}>
						{t("haproxy.clone")}
					</Button>
					<IconButton aria-label={t(
							expanded ? "haproxy.collapseSettings" : "haproxy.expandSettings",
						)} icon={
							expanded ? (
								<ChevronUpIcon className="w-17" />
							) : (
								<ChevronDownIcon className="w-17" />
							)
						} size="sm" variant="ghost" onClick={() => onExpandedChange(!expanded)} />
					<IconButton size="md" aria-label={t("haproxy.removeTarget")} icon={<TrashIcon className="w-17" />} variant="ghost" colorScheme="red" onClick={onRemove} />
				</div>
			</div>
			<Collapse in={expanded} animateOpacity>
				<div className="flex flex-col items-stretch gap-4">
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
					<Button size="md" variant="outline" leftIcon={<PlusIcon className="w-16" />} onClick={() =>
							onChange({
								...target,
								listeners: [
									...target.listeners,
									emptyListener(target.listeners.length),
								],
							})
						}>
						{t("haproxy.addListener")}
					</Button>
				</div>
			</Collapse>
		</div>
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
		<div className="bg-panel-surface-muted border border-panel-border! rounded-xl p-3 md:p-4">
			<div className={cn("flex flex-row items-center gap-2 justify-between", expanded ? "mb-4" : "mb-0")}>
				<div className="flex flex-row items-center gap-2">
					<h2 className="font-heading font-bold text-[0.875rem] leading-[1.2]">{listener.name || t("haproxy.listener")}</h2>
					<Badge>{listener.listen_port}</Badge>
				</div>
				<div className="flex flex-row items-center gap-2">
					<IconButton aria-label={t(
							expanded ? "haproxy.collapseSettings" : "haproxy.expandSettings",
						)} icon={
							expanded ? (
								<ChevronUpIcon className="w-16" />
							) : (
								<ChevronDownIcon className="w-16" />
							)
						} size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} />
					<IconButton aria-label={t("haproxy.removeListener")} icon={<TrashIcon className="w-16" />} size="sm" variant="ghost" colorScheme="red" onClick={onRemove} />
				</div>
			</div>
			<Collapse in={expanded} animateOpacity>
				<div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<FormControl>
							<FormLabel>{t("haproxy.listenerName")}</FormLabel>
							<Input value={listener.name} onChange={(event) =>
									onChange({ ...listener, name: event.target.value })
								} />
						</FormControl>
						<FormControl>
							<FormLabel>{t("haproxy.listenAddress")}</FormLabel>
							<Input value={listener.listen_address} onChange={(event) =>
									onChange({ ...listener, listen_address: event.target.value })
								} />
						</FormControl>
						<FormControl>
							<FormLabel>{t("haproxy.listenPort")}</FormLabel>
							<Input type="number" min={1} max={65535} value={listener.listen_port} onChange={(event) =>
									onChange({
										...listener,
										listen_port: Number(event.target.value),
									})
								} />
						</FormControl>
					</div>
					<div className="flex flex-row items-center gap-2 my-3">
						<Switch isChecked={listener.accept_proxy_protocol} onChange={(event) =>
								onChange({
									...listener,
									accept_proxy_protocol: event.target.checked,
								})
							} />
						<p className="text-[0.875rem]">{t("haproxy.acceptProxy")}</p>
					</div>
					<hr className="my-4 w-full border-0 border-b border-panel-border! opacity-60" />
					<FormControl>
						<FormLabel>{t("haproxy.compatibleInbound")}</FormLabel>
						<div className="flex flex-col lg:flex-row lg:items-center gap-3">
							<PanelSelect showSearch value={candidateOption} onValueChange={(value) => setCandidateOption(String(value))} options={candidateOptions} placeholder={t("haproxy.selectInbound")} className="flex-1" />
							<Button variant="solid" size="md" onClick={addCandidate} isDisabled={
									!candidateOption ||
									candidateOptions.some(
										(option) =>
											option.value === candidateOption && option.disabled,
									)
								} leftIcon={<PlusIcon className="w-16" />}>
								{t("haproxy.addInbound")}
							</Button>
							<Button size="md" variant="outline" onClick={() =>
									onChange({
										...listener,
										routes: [
											...listener.routes,
											externalRoute(listener.routes.length, hasDefaultSite),
										],
									})
								}>
								{t("haproxy.addExternal")}
							</Button>
						</div>
						<FormHelperText>{t("haproxy.matcherPriorityHelp")}</FormHelperText>
					</FormControl>
					<div className="flex flex-col items-stretch gap-2 mt-3">
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
					</div>
					<hr className="my-4 w-full border-0 border-b border-panel-border! opacity-60" />
					<div className="flex flex-row items-center gap-2 justify-between">
						<div>
							<p className="font-semibold">{t("haproxy.websites")}</p>
							<p className="text-[0.875rem] text-panel-text-secondary">
								{t("haproxy.websitesHelp")}
							</p>
						</div>
						<Button variant="solid" size="sm" leftIcon={<PlusIcon className="w-15" />} onClick={() =>
								onChange({
									...listener,
									sites: [...sites, emptySite(sites.length)],
									site: undefined,
								})
							}>
							{t("haproxy.addWebsite")}
						</Button>
					</div>
					<div className="flex flex-col items-stretch gap-3 mt-3">
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
					</div>
				</div>
			</Collapse>
		</div>
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
		<div className="border border-panel-border! rounded-xl p-3">
			<div className={cn("flex flex-col md:flex-row justify-between md:items-center gap-3", site.enabled && expanded ? "mb-3" : "mb-0")}>
				<div className="flex flex-row items-center gap-2">
					<Switch isChecked={site.enabled} onChange={(event) =>
							onChange({
								...site,
								enabled: event.target.checked,
								is_default: event.target.checked ? site.is_default : false,
							})
						} />
					<p className="font-semibold">{site.name || t("haproxy.website")}</p>
					<Badge>
						{site.is_default
							? t("haproxy.websiteModeHTTPAndHTTPS")
							: tlsMode === "none"
								? t("haproxy.websiteModeHTTP")
								: t("haproxy.websiteModeTLSSNI")}
					</Badge>
				</div>
				<div className="flex flex-row items-center gap-4">
					{isFirst && (
						<Checkbox isChecked={Boolean(site.is_default)} isDisabled={!site.enabled || defaultUnavailable} title={
								defaultUnavailable ? t("haproxy.defaultAlreadyUsed") : undefined
							} onChange={(event) =>
								onChange({ ...site, is_default: event.target.checked })
							}>
							{t("haproxy.defaultWebsite")}
						</Checkbox>
					)}
					<IconButton aria-label={t(
							site.enabled && expanded
								? "haproxy.collapseSettings"
								: "haproxy.expandSettings",
						)} icon={
							site.enabled && expanded ? (
								<ChevronUpIcon className="w-15" />
							) : (
								<ChevronDownIcon className="w-15" />
							)
						} size="sm" variant="ghost" isDisabled={!site.enabled} onClick={() => setExpanded(!expanded)} />
					<IconButton aria-label={t("haproxy.removeWebsite")} icon={<TrashIcon className="w-15" />} size="sm" variant="ghost" colorScheme="red" onClick={onRemove} />
				</div>
			</div>
			<Collapse in={site.enabled && expanded} animateOpacity>
				<div className="flex flex-col items-stretch gap-3">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<FormControl>
							<FormLabel>{t("haproxy.websiteName")}</FormLabel>
							<Input value={site.name || ""} onChange={(event) =>
									onChange({ ...site, name: event.target.value })
								} />
						</FormControl>
						<FormControl isRequired={
								(tlsMode !== "none" && !site.is_default) || hostnameRequired
							}>
							<FormLabel>{t("haproxy.hostname")}</FormLabel>
							<Input value={site.hostname || ""} placeholder="site.example.com" onChange={(event) =>
									onChange({ ...site, hostname: event.target.value })
								} />
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
					</div>
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
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<FormControl isRequired>
								<FormLabel>{t("haproxy.certificatePath")}</FormLabel>
								<Input value={site.certificate_path || ""} placeholder="/etc/ssl/fullchain.pem" onChange={(event) =>
										onChange({ ...site, certificate_path: event.target.value })
									} />
							</FormControl>
							<FormControl isRequired>
								<FormLabel>{t("haproxy.privateKeyPath")}</FormLabel>
								<Input value={site.private_key_path || ""} placeholder="/etc/ssl/privkey.pem" onChange={(event) =>
										onChange({ ...site, private_key_path: event.target.value })
									} />
							</FormControl>
						</div>
					)}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
					</div>
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
							<Input value={site.template_url || ""} placeholder="https://templatemo.com/tm-632-machina" onChange={(event) =>
									onChange({
										...site,
										template_url: event.target.value,
										template_id: event.target.value ? "" : site.template_id,
									})
								} />
							<FormHelperText>{t("haproxy.templateMoURLHelp")}</FormHelperText>
						</FormControl>
					)}
					{previewURL && (
						<a href={previewURL} target="_blank" rel="noopener noreferrer" className="text-blue-300 text-[0.875rem]">
							<div className="flex flex-row items-center gap-2">
								<ArrowTopRightOnSquareIcon className="w-15" />
								<p>{t("haproxy.previewTemplate")}</p>
							</div>
						</a>
					)}
					<FormControl>
						<FormLabel>{t("haproxy.notFoundHTML")}</FormLabel>
						<Textarea value={site.not_found_html || ""} onChange={(event) =>
								onChange({ ...site, not_found_html: event.target.value })
							} placeholder="<!doctype html>..." className="min-h-[100px] font-mono" />
						<FormHelperText>{t("haproxy.notFoundHelp")}</FormHelperText>
					</FormControl>
				</div>
			</Collapse>
		</div>
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
			<div className="border border-panel-border! rounded-lg p-3">
				<div className="flex flex-row gap-2 justify-between items-start">
					<div>
						<div className="flex flex-row items-center gap-2">
							<p className="font-semibold">{route.name}</p>
							<Badge colorScheme="blue">Xray</Badge>
							<code className="rounded-xs bg-gray-100 px-[0.2em] py-[0.1em] font-mono text-[0.875em] dark:bg-whiteAlpha-200">
								{route.match_type}
								{route.match_value ? `: ${route.match_value}` : ""}
							</code>
						</div>
						<p className="text-[0.75rem] text-panel-text-secondary">
							127.0.0.1:{route.backend_port} · {route.protocol}
						</p>
					</div>
					<IconButton aria-label={t("haproxy.removeRoute")} icon={<TrashIcon className="w-15" />} size="sm" variant="ghost" onClick={onRemove} />
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
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
				</div>
			</div>
		);
	}
	return (
		<div className="border border-panel-border! rounded-lg p-3">
			<div className="grid grid-cols-1 md:grid-cols-5 gap-2">
				<FormControl>
					<FormLabel>{t("haproxy.routeName")}</FormLabel>
					<Input size="sm" value={route.name} onChange={(event) =>
							onChange({ ...route, name: event.target.value })
						} />
				</FormControl>
				<FormControl>
					<FormLabel>{t("haproxy.backendHost")}</FormLabel>
					<Input size="sm" value={route.backend_host} onChange={(event) =>
							onChange({ ...route, backend_host: event.target.value })
						} />
				</FormControl>
				<FormControl>
					<FormLabel>{t("haproxy.backendPort")}</FormLabel>
					<Input size="sm" type="number" value={route.backend_port} onChange={(event) =>
							onChange({ ...route, backend_port: Number(event.target.value) })
						} />
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
				<div className="flex flex-row gap-2 items-end">
					<FormControl isDisabled={route.match_type === "default"}>
						<FormLabel>{t("haproxy.matchValue")}</FormLabel>
						<Input size="sm" value={route.match_value || ""} onChange={(event) =>
								onChange({ ...route, match_value: event.target.value })
							} />
					</FormControl>
					<IconButton aria-label={t("haproxy.removeRoute")} icon={<TrashIcon className="w-15" />} size="sm" variant="ghost" onClick={onRemove} />
				</div>
			</div>
		</div>
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
			<Input type="number" min={min} max={max} value={settings[key] as number} onChange={(event) => update(key, Number(event.target.value) as never)} />
		</FormControl>
	);
	return (
		<div className="flex flex-col items-stretch gap-5">
			<Alert status="warning" className="rounded-xl">
				<AlertIcon />
				<p className="text-[0.875rem]">{t("haproxy.advancedWarning")}</p>
			</Alert>
			<div className="border border-panel-border! rounded-xl p-4">
				<h2 className="font-heading font-bold text-[1rem] leading-[1.2] mb-4">
					{t("haproxy.connectionSettings")}
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
				</div>
			</div>
			<div className="border border-panel-border! rounded-xl p-4">
				<h2 className="font-heading font-bold text-[1rem] leading-[1.2] mb-4">
					{t("haproxy.healthChecks")}
				</h2>
				<div className="flex flex-row items-center gap-2 mb-4">
					<Switch isChecked={settings.health_check} onChange={(event) => update("health_check", event.target.checked)} />
					<p>{t("haproxy.healthCheck")}</p>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{number("check_interval_ms", t("haproxy.checkInterval"), 100, 60000)}
					{number("check_rise", t("haproxy.checkRise"), 1, 10)}
					{number("check_fall", t("haproxy.checkFall"), 1, 10)}
				</div>
			</div>
			<div className="border border-panel-border! rounded-xl p-4">
				<h2 className="font-heading font-bold text-[1rem] leading-[1.2] mb-4">
					{t("haproxy.loggingAndTCP")}
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
					<div className="flex flex-row items-center gap-2">
						<Switch isChecked={settings.tcp_keep_alive} onChange={(event) =>
								update("tcp_keep_alive", event.target.checked)
							} />
						<p>{t("haproxy.tcpKeepAlive")}</p>
					</div>
					<div className="flex flex-row items-center gap-2">
						<Switch isChecked={settings.dont_log_null} onChange={(event) =>
								update("dont_log_null", event.target.checked)
							} />
						<p>{t("haproxy.dontLogNull")}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
