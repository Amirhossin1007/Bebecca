import { useToast } from "components/shadcn/toast";
import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { Badge } from "components/shadcn/badge";
import { Checkbox, Radio, RadioGroup } from "components/shadcn/selection";
import { Button, IconButton } from "components/shadcn/button";
import { Tooltip } from "components/shadcn/tooltip";
import { useDisclosure } from "hooks/useDisclosure";
import { FormControl, FormHelperText, FormLabel } from "components/shadcn/field";
import { Alert, AlertDescription, AlertIcon } from "components/shadcn/alert";
import { cn } from "lib/cn";
import {
	ArrowDownIcon,
	ArrowPathIcon,
	ArrowUpIcon,
	ChevronDoubleUpIcon,
	EyeIcon,
	PencilSquareIcon,
	PlusIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { AppleEmojiText } from "components/common/AppleEmojiText";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { SearchInput } from "components/common/SearchInput";
import { Input } from "components/Input";
import { AppDialog } from "components/dialogs/AppDialog";
import { ConfirmDialog } from "components/dialogs/ConfirmDialog";
import {
	DataTable,
	PageHeader,
	PageLoadingSkeleton,
	ResourceListCard,
	TabSystem,
	type DataTableColumn,
	type DataTableRowAction,
	type ResourceSummaryItem,
} from "components/ui";
import {
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
	XrayModalHeader,
} from "components/xray/XrayDialog";
import { useAdminsStore } from "contexts/AdminsContext";
import {
	fetchInbounds,
	type Inbounds,
	useDashboard,
} from "contexts/DashboardContext";
import { useHosts } from "contexts/HostsContext";
import {
	type ServiceListParams,
	useServicesStore,
} from "contexts/ServicesContext";
import { Pagination } from "components/Pagination";
import { motion } from "framer-motion";
import useGetUser from "hooks/useGetUser";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import type { Admin, AdminPermissions } from "types/Admin";
import { AdminTrafficLimitMode } from "types/Admin";
import type {
	ServiceCreatePayload,
	ServiceAdmin,
	ServiceDeletePayload,
	ServiceDetail,
	ServiceHost,
	ServiceHostAssignment,
	ServiceSummary,
} from "types/Service";
import { formatBytes } from "utils/formatByte";
import {
	DEFAULT_SEARCH_MATCH_OPTIONS,
	matchesAnySearch,
} from "utils/searchMatch";

type HostOption = {
	id: number;
	label: string;
	inboundTag: string;
	protocol: string;
	disabled: boolean;
};

type ServiceDialogProps = {
	open: boolean;
	onClose: () => void;
	onSubmit: (
		payload: ServiceCreatePayload,
		serviceId?: number,
	) => Promise<void>;
	isSaving: boolean;
	allHosts: HostOption[];
	allAdmins: { id: number; username: string }[];
	initialService?: ServiceDetail | null;
	inbounds: Inbounds;
	refreshInbounds: () => Promise<void>;
	refreshHosts: () => void;
};

const GB_IN_BYTES = 1024 * 1024 * 1024;
const MB_IN_BYTES = 1024 * 1024;

const formatGigabytes = (
	bytes?: number | null,
	unlimitedLabel = "Unlimited",
) => {
	const value = Number(bytes ?? 0);
	if (!Number.isFinite(value) || value <= 0) {
		return unlimitedLabel;
	}
	const gb = value / GB_IN_BYTES;
	return `${Number.isInteger(gb) ? gb : Number(gb.toFixed(2))} GB`;
};

const sanitizeIntegerInput = (value: string) => value.replace(/\D/g, "");

const sanitizeDecimalInput = (value: string, maxDecimals = 2) => {
	const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
	const [integerPart = "", ...decimalParts] = normalized.split(".");
	const decimalPart = decimalParts.join("").slice(0, maxDecimals);
	if (normalized.includes(".")) {
		return `${integerPart || "0"}.${decimalPart}`;
	}
	return integerPart;
};

const formatUnitInputValue = (bytes?: number | null, unit = GB_IN_BYTES) => {
	const value = Number(bytes ?? 0);
	if (!Number.isFinite(value) || value <= 0) {
		return "";
	}
	const unitValue = value / unit;
	return String(Number(unitValue.toFixed(2)));
};

const parseDecimalInput = (value: string) => {
	const sanitized = sanitizeDecimalInput(value);
	return sanitized && sanitized !== "0." ? Number(sanitized) : null;
};

const parseCoefficientInput = (value: string) => {
	const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
	const parsed = Number(normalized);
	return normalized && normalized !== "." && Number.isFinite(parsed)
		? Math.round(parsed * 100) / 100
		: null;
};

const parseIntegerInput = (value: string) => {
	const sanitized = sanitizeIntegerInput(value);
	return sanitized ? Number.parseInt(sanitized, 10) : null;
};

const adminCanDeleteUsers = (admin?: Admin) =>
	Boolean(admin?.permissions?.users?.delete);

const withDeleteUserPermission = (permissions: AdminPermissions) => ({
	...permissions,
	users: {
		...permissions.users,
		delete: true,
	},
});

const ServiceDialog: FC<ServiceDialogProps> = ({
	open: isOpen,
	onClose,
	onSubmit,
	isSaving,
	allHosts,
	allAdmins,
	initialService,
	inbounds,
	refreshInbounds,
	refreshHosts,
}) => {
	const { t } = useTranslation();
	const borderColor = "border-blackAlpha-200! dark:border-whiteAlpha-200!";
	const selectedBg = "bg-primary-50 dark:bg-whiteAlpha-100";
	const labelColor = "text-gray-500 dark:text-gray-400";
	const [name, setName] = useState(initialService?.name ?? "");
	const [description, setDescription] = useState(
		initialService?.description ?? "",
	);
	const [usageCoefficient, setUsageCoefficient] = useState(
		String(initialService?.usage_coefficient ?? 1),
	);
	const [selectedAdmins, setSelectedAdmins] = useState<number[]>(
		initialService?.admin_ids ?? [],
	);
	const [selectedHosts, setSelectedHosts] = useState<number[]>(
		initialService?.hosts.map((host) => host.id) ?? [],
	);
	const [adminSearch, setAdminSearch] = useState("");
	const [hostSearch, setHostSearch] = useState("");
	const [adminSearchMatch, setAdminSearchMatch] = useState(
		DEFAULT_SEARCH_MATCH_OPTIONS,
	);
	const [hostSearchMatch, setHostSearchMatch] = useState(
		DEFAULT_SEARCH_MATCH_OPTIONS,
	);
	const [hoveredHost, setHoveredHost] = useState<number | null>(null);
	const [autoInboundBusy, setAutoInboundBusy] = useState(false);
	const toast = useToast();

	const autoInboundTag = initialService?.id
		? `setservice-${initialService.id}`
		: null;

	const autoInboundExists = useMemo(() => {
		if (!autoInboundTag) {
			return false;
		}
		for (const inboundList of inbounds.values()) {
			if (inboundList.some((inbound) => inbound.tag === autoInboundTag)) {
				return true;
			}
		}
		return false;
	}, [autoInboundTag, inbounds]);

	useEffect(() => {
		if (isOpen) {
			setName(initialService?.name ?? "");
			setDescription(initialService?.description ?? "");
			setUsageCoefficient(String(initialService?.usage_coefficient ?? 1));
			setSelectedAdmins(initialService?.admin_ids ?? []);
			setSelectedHosts(initialService?.hosts.map((host) => host.id) ?? []);
			setAdminSearch("");
			setHostSearch("");
			setAutoInboundBusy(false);
		}
	}, [isOpen, initialService]);

	const hostMap = useMemo(() => {
		return new Map(allHosts.map((host) => [host.id, host]));
	}, [allHosts]);

	const availableHosts = useMemo(() => {
		return allHosts.filter(
			(host) => !selectedHosts.includes(host.id) && !host.disabled,
		);
	}, [allHosts, selectedHosts]);

	const filteredAvailableHosts = useMemo(() => {
		if (!hostSearch.trim()) {
			return availableHosts;
		}
		return availableHosts.filter((host) =>
			matchesAnySearch(
				[host.label, host.inboundTag, host.protocol],
				hostSearch,
				hostSearchMatch,
			),
			);
	}, [availableHosts, hostSearch, hostSearchMatch]);

	const filteredAdmins = useMemo(() => {
		if (!adminSearch.trim()) {
			return allAdmins;
		}
		return allAdmins.filter((admin) =>
			matchesAnySearch([admin.username], adminSearch, adminSearchMatch),
		);
	}, [adminSearch, adminSearchMatch, allAdmins]);

	const selectedAdminsSet = useMemo(
		() => new Set(selectedAdmins),
		[selectedAdmins],
	);

	const handleToggleAllAdmins = () => {
		const hasAllSelected =
			selectedAdmins.length === allAdmins.length && allAdmins.length > 0;
		setSelectedAdmins(hasAllSelected ? [] : allAdmins.map((admin) => admin.id));
	};

	const handleAdminToggle = (adminId: number) => {
		setSelectedAdmins((prev) =>
			prev.includes(adminId)
				? prev.filter((id) => id !== adminId)
				: [...prev, adminId],
		);
	};

	const handleHostToggle = (hostId: number) => {
		setSelectedHosts((prev) =>
			prev.includes(hostId)
				? prev.filter((id) => id !== hostId)
				: [...prev, hostId],
		);
	};

	const moveHost = (hostId: number, direction: "up" | "down" | "top") => {
		setSelectedHosts((prev) => {
			const index = prev.indexOf(hostId);
			if (index === -1) return prev;
			if (direction === "top") {
				return index === 0
					? prev
					: [hostId, ...prev.filter((id) => id !== hostId)];
			}
			const swapWith = direction === "up" ? index - 1 : index + 1;
			if (swapWith < 0 || swapWith >= prev.length) {
				return prev;
			}
			const updated = [...prev];
			[updated[index], updated[swapWith]] = [updated[swapWith], updated[index]];
			return updated;
		});
	};

	const submit = async () => {
		if (!name.trim()) {
			toast({
				status: "warning",
				title: t("services.validation.nameRequired"),
			});
			return;
		}
		if (!selectedHosts.length) {
			toast({
				status: "warning",
				title: t("services.validation.hostRequired"),
			});
			return;
		}

		const coefficient =
			usageCoefficient.trim() === ""
				? 1
				: parseCoefficientInput(usageCoefficient);
		if (coefficient === null || coefficient < 0.01 || coefficient > 100) {
			toast({
				status: "warning",
				title: t("services.validation.usageCoefficientInvalid"),
			});
			return;
		}
		const assignments: ServiceHostAssignment[] = selectedHosts.map(
			(hostId, index) => ({
				host_id: hostId,
				sort: index,
			}),
		);

		await onSubmit(
			{
				name: name.trim(),
				description: description?.trim() || null,
				admin_ids: selectedAdmins,
				usage_coefficient: coefficient,
				hosts: assignments,
			},
			initialService?.id,
		);
	};

	const handleCreateAutoInbound = async () => {
		if (!initialService?.id || autoInboundExists) {
			return;
		}
		setAutoInboundBusy(true);
		try {
			await fetch(`/v2/services/${initialService.id}/auto-inbound`, {
				method: "POST",
			});
			await refreshInbounds();
			refreshHosts();
			toast({
				status: "success",
				title: t("services.autoInbound.created"),
			});
		} catch (error: any) {
			toast({
				status: "error",
				title: error?.data?.detail ?? t("services.autoInbound.createFailed"),
			});
		} finally {
			setAutoInboundBusy(false);
		}
	};

	const handleDeleteAutoInbound = async () => {
		if (!initialService?.id || !autoInboundExists) {
			return;
		}
		setAutoInboundBusy(true);
		try {
			await fetch(`/v2/services/${initialService.id}/auto-inbound`, {
				method: "DELETE",
			});
			await refreshInbounds();
			refreshHosts();
			toast({
				status: "success",
				title: t("services.autoInbound.deleted"),
			});
		} catch (error: any) {
			toast({
				status: "error",
				title: error?.data?.detail ?? t("services.autoInbound.deleteFailed"),
			});
		} finally {
			setAutoInboundBusy(false);
		}
	};

	return (
		<Modal open={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
			<ModalOverlay className="bg-blackAlpha-400" />
			<XrayModalContent className="mx-3">
				<XrayModalHeader>
					{initialService ? t("services.editTitle") : t("services.createTitle")}
				</XrayModalHeader>
				<ModalCloseButton />
				<XrayModalBody>
					<div className="flex flex-col gap-4">
						<div className="xray-dialog-section service-dialog-section">
							<p className="text-[0.875rem] font-semibold mb-3">
								{t("services.basicInfo")}
							</p>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<Input
									label={t("services.fields.name")}
									value={name}
									onChange={(event) => setName(event.target.value)}
									maxLength={128}
									required
								/>
								<Input
									label={t("services.fields.description")}
									value={description ?? ""}
									onChange={(event) => setDescription(event.target.value)}
									maxLength={256}
								/>
								<Input
									label={t("services.fields.usageCoefficient")}
									type="number"
									inputMode="decimal"
									min={0.01}
									max={100}
									step={0.01}
									precision={2}
									value={usageCoefficient}
									onChange={(event) => setUsageCoefficient(event.target.value)}
								/>
							</div>
						</div>

						<div className="xray-dialog-section service-dialog-section">
							<div className="flex justify-between items-center gap-3 mb-3">
								<p className="text-[0.875rem] font-semibold">
									{t("services.fields.admins")}
								</p>
								<Badge variant="subtle" colorScheme="primary" className="rounded-md">
									{selectedAdmins.length} / {allAdmins.length}
								</Badge>
							</div>
							<div className="flex flex-col gap-2">
								<Checkbox checked={
										selectedAdmins.length === allAdmins.length &&
										allAdmins.length > 0
									} onChange={handleToggleAllAdmins} disabled={allAdmins.length === 0}>
									{t("services.selectAllAdmins")}
								</Checkbox>
								<SearchInput
									value={adminSearch}
									onChange={(event) => setAdminSearch(event.target.value)}
									placeholder={t("services.searchAdmins")}
									matchOptions={adminSearchMatch}
									onMatchOptionsChange={setAdminSearchMatch}
									onClear={() => setAdminSearch("")}
								/>
								<div className="flex flex-col items-stretch gap-1.5 max-h-[170px] overflow-y-auto border rounded-md p-2 service-dialog-list">
									{allAdmins.length === 0 ? (
										<p className={cn(labelColor, "text-[0.875rem]")}>
											{t("services.noAdminsFound")}
										</p>
									) : filteredAdmins.length === 0 ? (
										<p className={cn(labelColor, "text-[0.875rem]")}>
											{t("services.noAdminsMatching")}
										</p>
									) : (
										filteredAdmins.map((admin) => {
											const isSelected = selectedAdminsSet.has(admin.id);
											return (
												// biome-ignore lint/a11y/useSemanticElements: card holds block content and handles keys in onKeyDown; a native button should not hold it
												<div key={admin.id} onClick={() => handleAdminToggle(admin.id)} onKeyDown={(event) => {
														if (event.key === "Enter" || event.key === " ") {
															event.preventDefault();
															handleAdminToggle(admin.id);
														}
													}} role="button" tabIndex={0} className={cn(isSelected ? "border-primary-400!" : borderColor, "border rounded-md px-2.5 py-2 hover:border-primary-300! hover:cursor-pointer [transition:background-color_0.1s_ease-in-out,_border-color_0.1s_ease-in-out]", isSelected ? (selectedBg) : "bg-transparent")}>
													<div className="flex items-center justify-between gap-3">
														<p className="font-medium truncate">
															{admin.username}
														</p>
														{isSelected && (
															<Badge colorScheme="primary" className="rounded-md">
																{t("services.selected")}
															</Badge>
														)}
													</div>
												</div>
											);
										})
									)}
								</div>
							</div>
							<p className={cn(labelColor, "text-[0.75rem] mt-2")}>
								{t("services.adminHint")}
							</p>
						</div>

						<div className="xray-dialog-section service-dialog-section">
							<div className="flex justify-between items-start md:items-center gap-3 flex-wrap mb-3">
								<div className="min-w-0!">
									<p className="text-[0.875rem] font-semibold">
										{t("services.autoInbound.title")}
									</p>
									<p className={cn(labelColor, "font-mono text-[0.75rem] mt-1")}>
										{autoInboundTag ?? t("services.autoInbound.pendingTag")}
									</p>
								</div>
								<Badge colorScheme={autoInboundExists ? "green" : "gray"} className="rounded-md">
									{autoInboundExists
										? t("services.autoInbound.statusCreated")
										: t("services.autoInbound.statusMissing")}
								</Badge>
							</div>
							<div className="flex flex-row items-center gap-2 flex-wrap">
								<Button variant="solid" size="sm" onClick={handleCreateAutoInbound} disabled={
										!initialService?.id || autoInboundExists || autoInboundBusy
									} loading={autoInboundBusy}>
									{t("services.autoInbound.create")}
								</Button>
								<Button size="sm" variant="outline" colorScheme="red" onClick={handleDeleteAutoInbound} disabled={
										!initialService?.id || !autoInboundExists || autoInboundBusy
									} loading={autoInboundBusy}>
									{t("services.autoInbound.delete")}
								</Button>
							</div>
							<p className={cn(labelColor, "text-[0.75rem] mt-2")}>
								{t("services.autoInbound.helper")}
							</p>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div className="xray-dialog-section service-dialog-section">
								<p className="text-[0.875rem] font-semibold mb-3">
									{t("services.availableHosts")}
								</p>
								<div className="flex flex-col gap-2">
									<SearchInput
										value={hostSearch}
										onChange={(event) => setHostSearch(event.target.value)}
										placeholder={t("services.searchHosts")}
										matchOptions={hostSearchMatch}
										onMatchOptionsChange={setHostSearchMatch}
										onClear={() => setHostSearch("")}
									/>
									<div className="flex flex-col items-stretch gap-1.5 max-h-[260px] overflow-y-auto border rounded-md p-2 service-dialog-list">
										{availableHosts.length === 0 ? (
											<p className={cn(labelColor, "text-[0.875rem]")}>
												{t("services.noHostsLeft")}
											</p>
										) : filteredAvailableHosts.length === 0 ? (
											<p className={cn(labelColor, "text-[0.875rem]")}>
												{t("services.noHostsMatching")}
											</p>
										) : (
											filteredAvailableHosts.map((host) => (
												// biome-ignore lint/a11y/noStaticElementInteractions: host card click target, unchanged from HEAD, where the Chakra box had no keyboard handler
												// biome-ignore lint/a11y/useKeyWithClickEvents: host card click target, unchanged from HEAD, where the Chakra box had no keyboard handler
												<div key={host.id} onMouseEnter={() => setHoveredHost(host.id)} onMouseLeave={() => setHoveredHost(null)} onClick={() => handleHostToggle(host.id)} className={cn(hoveredHost === host.id ? "border-primary-400!" : borderColor, "border rounded-md px-2.5 py-2 hover:border-primary-300! hover:cursor-pointer")}>
													<p className="font-medium truncate">
														<AppleEmojiText>{host.label}</AppleEmojiText>
													</p>
													<p className={cn(labelColor, "text-[0.75rem]")}>
														{host.protocol.toUpperCase()} - {host.inboundTag}
													</p>
												</div>
											))
										)}
									</div>
								</div>
							</div>

							<div className="xray-dialog-section service-dialog-section">
								<div className="flex justify-between items-center gap-3 mb-3">
									<p className="text-[0.875rem] font-semibold">
										{t("services.selectedHosts")}
									</p>
									<Badge variant="subtle" className="rounded-md">
										{selectedHosts.length}
									</Badge>
								</div>
								<div className="flex flex-col items-stretch gap-1.5 max-h-[300px] overflow-y-auto border rounded-md p-2 service-dialog-list">
									{selectedHosts.length === 0 && (
										<p className={cn(labelColor, "text-[0.875rem]")}>
											{t("services.noHostsSelected")}
										</p>
									)}
									{selectedHosts.map((hostId, index) => {
										const host = hostMap.get(hostId);
										if (!host) return null;
										return (
											<motion.div layout key={hostId}>
												<div className={cn(borderColor, "flex items-center justify-between border rounded-md px-2.5 py-2 gap-3")}>
													<div className="min-w-0!">
														<div className="flex flex-row gap-2 items-center">
															<p className="font-medium truncate">
																<AppleEmojiText>{host.label}</AppleEmojiText>
															</p>
															{host.disabled && (
																<Badge colorScheme="red" className="rounded-md">
																	{t("services.hostDisabled")}
																</Badge>
															)}
														</div>
														<p className={cn(labelColor, "text-[0.75rem]")}>
															{host.protocol.toUpperCase()} - {host.inboundTag}
														</p>
													</div>
													<div className="flex flex-row items-center gap-1 shrink-0">
														<Tooltip label={t("services.moveToTop")}>
															<IconButton aria-label="Move to top" size="sm" variant="ghost" onClick={() => moveHost(hostId, "top")} disabled={index === 0} >{<ChevronDoubleUpIcon className="w-[16px]" />}</IconButton>
														</Tooltip>
														<Tooltip label={t("services.moveUp")}>
															<IconButton aria-label="Move up" size="sm" variant="ghost" onClick={() => moveHost(hostId, "up")} disabled={index === 0} >{<ArrowUpIcon className="w-[16px]" />}</IconButton>
														</Tooltip>
														<Tooltip label={t("services.moveDown")}>
															<IconButton aria-label="Move down" size="sm" variant="ghost" onClick={() => moveHost(hostId, "down")} disabled={index === selectedHosts.length - 1} >{<ArrowDownIcon className="w-[16px]" />}</IconButton>
														</Tooltip>
														<Tooltip label={t("services.removeHost")}>
															<IconButton aria-label="Remove" size="sm" variant="ghost" onClick={() => handleHostToggle(hostId)} >{<TrashIcon className="w-[16px]" />}</IconButton>
														</Tooltip>
													</div>
												</div>
											</motion.div>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				</XrayModalBody>
				<XrayModalFooter>
					<Button size="md" variant="ghost" onClick={onClose}>
						{t("cancel")}
					</Button>
					<Button size="md" colorScheme="primary" onClick={submit} loading={isSaving}>
						{initialService ? t("saveChanges") : t("create")}
					</Button>
				</XrayModalFooter>
			</XrayModalContent>
		</Modal>
	);
};

const ServicesPage: FC = () => {
	const { t } = useTranslation();
	const labelColor = "text-gray-500 dark:text-gray-400";
	const toast = useToast();
	const { userData, getUserIsSuccess } = useGetUser();
	const canManageServices =
		getUserIsSuccess && Boolean(userData.permissions?.sections.services);
	const services = useServicesStore((state) => state.services);
	const summaryServices = useServicesStore((state) => state.summaryServices);
	const servicesTotal = useServicesStore((state) => state.total);
	const fetchServiceSummary = useServicesStore(
		(state) => state.fetchServiceSummary,
	);
	const [listFilters, setListFilters] = useState<
		ServiceListParams & { limit: number; offset: number; name: string }
	>({ limit: 20, offset: 0, name: "" });
	const [serviceSearch, setServiceSearch] = useState("");
	const serviceDetail = useServicesStore((state) => state.serviceDetail);
	const isServicesLoading = useServicesStore((state) => state.loading);
	const isServiceSaving = useServicesStore((state) => state.isSaving);
	const fetchServices = useServicesStore((state) => state.fetchServices);
	const fetchServiceDetail = useServicesStore(
		(state) => state.fetchServiceDetail,
	);
	const updateService = useServicesStore((state) => state.updateService);
	const createService = useServicesStore((state) => state.createService);
	const resetServiceUsage = useServicesStore(
		(state) => state.resetServiceUsage,
	);
	const deleteService = useServicesStore((state) => state.deleteService);
	const updateServiceAdminLimits = useServicesStore(
		(state) => state.updateServiceAdminLimits,
	);
	const rawAdminOptions = useAdminsStore((state) => state.adminOptions);
	const fetchAdminOptions = useAdminsStore((state) => state.fetchAdminOptions);
	const updateAdmin = useAdminsStore((state) => state.updateAdmin);
	const resetDeletedUsersUsage = useAdminsStore(
		(state) => state.resetDeletedUsersUsage,
	);
	const hosts = useHosts((state) => state.hosts);
	const fetchHosts = useHosts((state) => state.fetchHosts);
	const inbounds = useDashboard((state) => state.inbounds);
	const refetchUsers = useDashboard((state) => state.refetchUsers);

	const dialogDisclosure = useDisclosure();
	const [editingService, setEditingService] = useState<ServiceDetail | null>(
		null,
	);
	const [activeServiceTab, setActiveServiceTab] = useState<"hosts" | "admins">(
		"admins",
	);
	const [savingAdminLimitId, setSavingAdminLimitId] = useState<number | null>(
		null,
	);
	const [editingServiceAdminLimit, setEditingServiceAdminLimit] =
		useState<ServiceAdmin | null>(null);
	const [serviceAdminLimitForm, setServiceAdminLimitForm] = useState({
		traffic_limit_mode: AdminTrafficLimitMode.UsedTraffic,
		data_limit_gb: "",
		users_limit: "",
		show_user_traffic: true,
		delete_user_usage_limit_enabled: false,
		delete_user_usage_limit_mb: "",
		usage_coefficient: "",
	});

	useEffect(() => {
		if (!getUserIsSuccess || !canManageServices) {
			return;
		}
		void fetchServices(listFilters);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		getUserIsSuccess,
		canManageServices,
		fetchServices,
		listFilters,
	]);

	useEffect(() => {
		if (!getUserIsSuccess || !canManageServices) {
			return;
		}
		void fetchServiceSummary();
	}, [getUserIsSuccess, canManageServices, fetchServiceSummary]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			const name = serviceSearch.trim();
			setListFilters((current) =>
				current.name === name ? current : { ...current, name, offset: 0 },
			);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [serviceSearch]);

	const ensureServiceDialogResources = useCallback(() => {
		if (useAdminsStore.getState().adminOptions.length === 0) {
			void fetchAdminOptions({ limit: 1000, offset: 0, sort: "username" });
		}
		if (useDashboard.getState().inbounds.size === 0) {
			void fetchInbounds();
		}
		if (Object.keys(useHosts.getState().hosts).length === 0) {
			void fetchHosts();
		}
	}, [fetchAdminOptions, fetchHosts]);

	const adminOptions = useMemo(() => {
		return rawAdminOptions
			.slice()
			.sort((a, b) => a.username.localeCompare(b.username))
			.map((admin) => ({
				id: admin.id!,
				username: admin.username,
			}));
	}, [rawAdminOptions]);

	const inboundProtocols = useMemo(
		() =>
			new Map(
				Array.from(inbounds.values())
					.flat()
					.map((inbound) => [inbound.tag, inbound.protocol]),
			),
		[inbounds],
	);

	const hostOptions: HostOption[] = useMemo(() => {
		const options: HostOption[] = [];
		for (const [tag, hostItems] of Object.entries(hosts)) {
			const protocol = inboundProtocols.get(tag) ?? "unknown";
			hostItems.forEach((host) => {
				if (host.id == null) {
					return;
				}
				options.push({
					id: host.id,
					label: host.remark,
					inboundTag: tag,
					protocol,
					disabled: Boolean(host.is_disabled),
				});
			});
		}
		return options;
	}, [hosts, inboundProtocols]);

	const openCreateDialog = () => {
		ensureServiceDialogResources();
		setEditingService(null);
		dialogDisclosure.onOpen();
	};

	const openEditDialog = async (serviceId: number) => {
		ensureServiceDialogResources();
		try {
			const detail = await fetchServiceDetail(serviceId);
			if (!detail) return;
			setEditingService(detail);
			dialogDisclosure.onOpen();
		} catch (_error) {
			toast({
				status: "error",
				title: t("services.fetchFailed"),
			});
		}
	};

	const openServiceDetail = async (
		serviceId: number,
		tab: "hosts" | "admins" = "admins",
	) => {
		setActiveServiceTab(tab);
		await fetchServiceDetail(serviceId);
	};

	const handleSubmit = async (
		payload: ServiceCreatePayload,
		serviceId?: number,
	) => {
		try {
			if (serviceId) {
				await updateService(serviceId, payload);
				toast({
					status: "success",
					title: t("services.updated"),
				});
			} else {
				await createService(payload);
				toast({
					status: "success",
					title: t("services.created"),
				});
			}
			refetchUsers(true);
			dialogDisclosure.onClose();
		} catch (error: any) {
			toast({
				status: "error",
				title: error?.data?.detail ?? t("services.saveFailed"),
			});
		}
	};

	const beginDeleteService = async (serviceId: number) => {
		try {
			const detail = await fetchServiceDetail(serviceId);
			if (!detail) return;
			setServicePendingDelete(detail);
			openDeleteDialog();
		} catch (error: any) {
			toast({
				status: "error",
				title: error?.data?.detail ?? t("services.deleteFailed"),
			});
		}
	};

	const handleResetUsage = async (serviceId: number) => {
		try {
			await resetServiceUsage(serviceId);
			toast({
				status: "success",
				title: t("services.resetSuccess"),
			});
		} catch (error: any) {
			toast({
				status: "error",
				title: error?.data?.detail ?? t("services.resetFailed"),
			});
		}
	};

	const [resetServiceId, setResetServiceId] = useState<number | null>(null);
	const [isResetting, setIsResetting] = useState(false);
	const {
		isOpen: isResetDialogOpen,
		onOpen: openResetDialog,
		onClose: closeResetDialog,
	} = useDisclosure();

	const openResetConfirmation = (serviceId: number) => {
		setResetServiceId(serviceId);
		openResetDialog();
	};

	const confirmResetUsage = async () => {
		if (resetServiceId == null) {
			return;
		}
		setIsResetting(true);
		try {
			await handleResetUsage(resetServiceId);
		} finally {
			setIsResetting(false);
			closeResetDialog();
		}
	};

	const resetTargetName =
		resetServiceId != null
			? summaryServices.find((service) => service.id === resetServiceId)
					?.name
			: undefined;

	const handleCloseDeleteDialog = () => {
		setServicePendingDelete(null);
		closeDeleteDialog();
	};

	const confirmDeleteService = async () => {
		if (!servicePendingDelete) {
			return;
		}
		const payload: ServiceDeletePayload = {
			mode: servicePendingDelete.user_count ? deleteMode : "delete_users",
			unlink_admins: unlinkAdmins,
		};
		if (payload.mode === "transfer_users") {
			if (!targetServiceId) {
				toast({
					status: "warning",
					title: t("services.selectTargetService"),
					description: t("services.targetServiceRequired"),
				});
				return;
			}
			payload.target_service_id = targetServiceId;
		}
		setIsDeleting(true);
		try {
			await deleteService(servicePendingDelete.id, payload);
			toast({
				status: "success",
				title: t("services.deleted"),
			});
			refetchUsers(true);
			handleCloseDeleteDialog();
		} catch (error: any) {
			toast({
				status: "error",
				title: error?.data?.detail ?? t("services.deleteFailed"),
			});
		} finally {
			setIsDeleting(false);
		}
	};

	const [servicePendingDelete, setServicePendingDelete] =
		useState<ServiceDetail | null>(null);
	const [deleteMode, setDeleteMode] = useState<
		"delete_users" | "transfer_users"
	>("transfer_users");
	const [unlinkAdmins, setUnlinkAdmins] = useState(false);
	const [targetServiceId, setTargetServiceId] = useState<number | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const {
		isOpen: isDeleteDialogOpen,
		onOpen: openDeleteDialog,
		onClose: closeDeleteDialog,
	} = useDisclosure();

	const otherServices = useMemo(() => {
		if (!servicePendingDelete) {
				return summaryServices;
		}
		return summaryServices.filter(
			(service) => service.id !== servicePendingDelete.id,
		);
	}, [servicePendingDelete, summaryServices]);
	const servicesSummary = useMemo(
		() =>
			summaryServices.reduce(
				(summary, service) => ({
					totalHosts: summary.totalHosts + Number(service.host_count || 0),
					totalUsers: summary.totalUsers + Number(service.user_count || 0),
					totalUsage: summary.totalUsage + Number(service.used_traffic || 0),
					lifetimeUsage:
						summary.lifetimeUsage + Number(service.lifetime_used_traffic || 0),
					brokenServices: summary.brokenServices + (service.has_hosts ? 0 : 1),
				}),
				{
					totalHosts: 0,
					totalUsers: 0,
					totalUsage: 0,
					lifetimeUsage: 0,
					brokenServices: 0,
				},
			),
			[summaryServices],
	);

	const serviceSummaryItems = useMemo<ResourceSummaryItem[]>(
		() => [
			{
				label: t("services.title"),
					value: summaryServices.length,
				colorScheme: "gray",
			},
			{
				label: t("services.columns.hosts"),
				value: servicesSummary.totalHosts,
				colorScheme: "green",
			},
			{
				label: t("users"),
				value: servicesSummary.totalUsers,
				colorScheme: "orange",
			},
			{
				label: t("services.columns.usage"),
				value: formatBytes(servicesSummary.totalUsage),
				colorScheme: "blue",
			},
			{
				label: t("services.columns.lifetime"),
				value: formatBytes(servicesSummary.lifetimeUsage),
				colorScheme: "purple",
				helper:
					servicesSummary.brokenServices > 0
						? t("services.brokenCount", {
								count: servicesSummary.brokenServices,
							})
						: undefined,
			},
		],
			[summaryServices.length, servicesSummary, t],
	);

	useEffect(() => {
		if (servicePendingDelete) {
			const hasUsers = servicePendingDelete.user_count > 0;
			setDeleteMode(hasUsers ? "transfer_users" : "delete_users");
			setUnlinkAdmins(servicePendingDelete.admin_ids.length > 0);
			setTargetServiceId(null);
		}
	}, [servicePendingDelete]);

	useEffect(() => {
		if (deleteMode === "delete_users") {
			setTargetServiceId(null);
		} else if (targetServiceId === null && otherServices.length > 0) {
			setTargetServiceId(otherServices[0].id);
		}
	}, [deleteMode, otherServices, targetServiceId]);

	const serviceColumns = useMemo<DataTableColumn<ServiceSummary>[]>(
		() => [
			{
				id: "id",
				header: t("services.columns.id"),
				accessor: (service) => service.id,
				priority: "medium",
				width: "78px",
				maxWidth: "90px",
				mobilePriority: 1,
				mobileMetaLabel: t("services.columns.id"),
				cell: (service) => (
					<Badge variant="subtle" className="rounded-md">
						#{service.id}
					</Badge>
				),
			},
			{
				id: "name",
				header: t("services.columns.name"),
				accessor: "name",
				isPrimary: true,
				priority: "primary",
				width: "240px",
				minWidth: "200px",
				maxWidth: "300px",
				truncate: true,
				tooltip: true,
				cellAlign: "start",
				mobilePriority: 0,
				mobileMetaLabel: t("services.columns.name"),
				cell: (service) => (
					<div className="flex flex-col gap-0.5 items-start text-start min-w-0!">
						<div className="flex flex-row items-center gap-2 justify-start min-w-0! max-w-full">
							<p className="font-semibold truncate">
								{service.name}
							</p>
							{!service.has_hosts && (
								<Badge colorScheme="red" className="rounded-md shrink-0">
									{t("services.broken")}
								</Badge>
							)}
						</div>
						{service.description && (
							<p className={cn(labelColor, "text-[0.75rem] truncate")}>
								{service.description}
							</p>
						)}
					</div>
				),
			},
			{
				id: "hosts",
				header: t("services.columns.hosts"),
				accessor: (service) => service.host_count,
				priority: "high",
				width: "96px",
				maxWidth: "110px",
				mobilePriority: 2,
				mobileMetaLabel: t("services.columns.hosts"),
				cell: (service) => (
					<p className="font-semibold">{service.host_count}</p>
				),
			},
			{
				id: "users",
				header: t("users"),
				accessor: (service) => service.user_count,
				priority: "high",
				width: "96px",
				maxWidth: "110px",
				mobilePriority: 3,
				mobileMetaLabel: t("users"),
				cell: (service) => (
					<p className="font-semibold">{service.user_count}</p>
				),
			},
			{
				id: "usage",
				header: t("services.columns.usage"),
				accessor: (service) => service.used_traffic,
				priority: "medium",
				width: "132px",
				maxWidth: "150px",
				mobilePriority: 4,
				mobileSummary: true,
				mobileMetaLabel: t("services.columns.usage"),
				cell: (service) => (
					<p dir="ltr" className="[unicode-bidi:isolate] whitespace-nowrap">
						{formatBytes(service.used_traffic)}
					</p>
				),
			},
			{
				id: "lifetime",
				header: t("services.columns.lifetime"),
				accessor: (service) => service.lifetime_used_traffic,
				priority: "low",
				hideBelow: "xl",
				width: "132px",
				maxWidth: "150px",
				mobilePriority: 5,
				mobileMetaLabel: t("services.columns.lifetime"),
				cell: (service) => (
					<p dir="ltr" className="[unicode-bidi:isolate] whitespace-nowrap">
						{formatBytes(service.lifetime_used_traffic)}
					</p>
				),
			},
		],
		[t],
	);

	const serviceRowActions = (
		service: ServiceSummary,
	): DataTableRowAction<ServiceSummary>[] => {
		const actions: DataTableRowAction<ServiceSummary>[] = [
			{
				id: "view",
				label: t("services.view"),
				icon: <EyeIcon className="w-[16px]" />,
				onClick: () => {
					void openServiceDetail(service.id, "admins");
				},
			},
		];

		if (canManageServices) {
			actions.push(
				{
					id: "edit",
					label: t("edit"),
					icon: <PencilSquareIcon className="w-[16px]" />,
					onClick: () => openEditDialog(service.id),
				},
				{
					id: "reset",
					label: t("services.resetUsage"),
					icon: <ArrowPathIcon className="w-[16px]" />,
					onClick: () => openResetConfirmation(service.id),
				},
				{
					id: "delete",
					label: t("delete"),
					icon: <TrashIcon className="w-[16px]" />,
					onClick: () => beginDeleteService(service.id),
					isDanger: true,
				},
			);
		}

		return actions;
	};

	const selectedService = serviceDetail;
	const serviceDefaultCoefficient = selectedService?.usage_coefficient ?? 1;

	const saveServiceAdminLimit = useCallback(
		async (
			adminId: number,
			payload: {
				traffic_limit_mode?: AdminTrafficLimitMode;
				data_limit?: number | null;
				show_user_traffic?: boolean;
				users_limit?: number | null;
				delete_user_usage_limit_enabled?: boolean;
				delete_user_usage_limit?: number | null;
				usage_coefficient?: number | null;
			},
		) => {
			if (!selectedService) return false;
			setSavingAdminLimitId(adminId);
			try {
				if (payload.delete_user_usage_limit_enabled === true) {
					const targetAdmin = rawAdminOptions.find(
						(item) => item.id === adminId,
					);
					if (targetAdmin && !adminCanDeleteUsers(targetAdmin)) {
						await updateAdmin(targetAdmin.username, {
							permissions: withDeleteUserPermission(targetAdmin.permissions),
						});
					}
				}
				await updateServiceAdminLimits(
					selectedService.id,
					adminId,
					payload,
				);
				if (payload.delete_user_usage_limit_enabled === true) {
					await fetchServiceDetail(selectedService.id);
				}
				return true;
			} catch (error) {
				toast({
					status: "error",
					title: t("services.adminLimitSaveFailed"),
					description: error instanceof Error ? error.message : undefined,
				});
				return false;
			} finally {
				setSavingAdminLimitId(null);
			}
		},
			[
				fetchServiceDetail,
				rawAdminOptions,
				selectedService,
				t,
				toast,
				updateAdmin,
				updateServiceAdminLimits,
			],
	);

	const openServiceAdminLimitEditor = (link: ServiceAdmin) => {
		setEditingServiceAdminLimit(link);
		setServiceAdminLimitForm({
			traffic_limit_mode:
				link.traffic_limit_mode ?? AdminTrafficLimitMode.UsedTraffic,
			data_limit_gb: formatUnitInputValue(link.data_limit),
			users_limit:
				link.users_limit !== undefined && link.users_limit !== null
					? String(link.users_limit)
					: "",
			show_user_traffic: link.show_user_traffic,
			delete_user_usage_limit_enabled: link.delete_user_usage_limit_enabled,
			delete_user_usage_limit_mb: formatUnitInputValue(
				link.delete_user_usage_limit,
				MB_IN_BYTES,
			),
			usage_coefficient: link.usage_coefficient != null ? String(link.usage_coefficient) : "",
		});
	};

	const closeServiceAdminLimitEditor = () => {
		setEditingServiceAdminLimit(null);
	};

	const submitServiceAdminLimitEditor = async () => {
		if (!editingServiceAdminLimit) return;
		const dataLimitGb = parseDecimalInput(serviceAdminLimitForm.data_limit_gb);
		const usersLimit = parseIntegerInput(serviceAdminLimitForm.users_limit);
		const deleteUserUsageLimitMb = parseDecimalInput(
			serviceAdminLimitForm.delete_user_usage_limit_mb,
		);
		const usageCoefficient = parseCoefficientInput(
			serviceAdminLimitForm.usage_coefficient,
		);
		if (usageCoefficient !== null && (usageCoefficient < 0.01 || usageCoefficient > 100)) {
			toast({
				status: "warning",
				title: t("services.validation.usageCoefficientInvalid"),
			});
			return;
		}
		const saved = await saveServiceAdminLimit(editingServiceAdminLimit.id, {
			usage_coefficient: usageCoefficient,
			traffic_limit_mode: serviceAdminLimitForm.traffic_limit_mode,
			data_limit: dataLimitGb !== null ? dataLimitGb * GB_IN_BYTES : null,
			users_limit: usersLimit,
			show_user_traffic: serviceAdminLimitForm.show_user_traffic,
			delete_user_usage_limit_enabled:
				serviceAdminLimitForm.delete_user_usage_limit_enabled,
			delete_user_usage_limit:
				deleteUserUsageLimitMb !== null
					? deleteUserUsageLimitMb * MB_IN_BYTES
					: null,
		});
		if (saved) {
			closeServiceAdminLimitEditor();
		}
	};

	const resetServiceDeletedUsersUsage = async (link: {
		id: number;
		username: string;
	}) => {
		if (!selectedService) return;
		setSavingAdminLimitId(link.id);
		try {
			await resetDeletedUsersUsage(
				link.username,
				selectedService.id,
			);
			await fetchServiceDetail(selectedService.id);
			toast({
				status: "success",
				title: t("admins.resetDeletedUsageSuccess"),
			});
		} catch (error) {
			toast({
				status: "error",
				title: t("admins.resetDeletedUsageFailed"),
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setSavingAdminLimitId(null);
		}
	};

	const serviceAdminColumns = useMemo<DataTableColumn<ServiceAdmin>[]>(
		() => [
			{
				id: "username",
				header: t("username"),
				accessor: "username",
				isPrimary: true,
				priority: "primary",
				width: "180px",
				minWidth: "160px",
				maxWidth: "220px",
				truncate: true,
				tooltip: true,
				mobilePriority: 0,
				mobileMetaLabel: t("username"),
				cell: (link) => (
					<p dir="ltr" className="font-semibold [unicode-bidi:isolate]">
						{link.username}
					</p>
				),
			},
			{
				id: "usage",
				sortValue: (link) => (link.traffic_limit_mode === AdminTrafficLimitMode.CreatedTraffic ? link.created_traffic : link.used_traffic) ?? 0,
				header: t("services.columns.usage"),
				priority: "high",
				width: "170px",
				maxWidth: "190px",
				mobilePriority: 1,
				mobileSummary: true,
				mobileMetaLabel: t("services.columns.usage"),
				cell: (link) => (
					<p dir="ltr" className="text-[0.875rem] [unicode-bidi:isolate] whitespace-nowrap">
						{link.traffic_limit_mode === AdminTrafficLimitMode.CreatedTraffic
							? formatBytes(link.created_traffic)
							: formatBytes(link.used_traffic)}{" "}
						/ {formatGigabytes(link.data_limit, t("nodes.unlimited"))}
					</p>
				),
			},
			{
				id: "mode",
				sortValue: (link) => link.traffic_limit_mode ?? "",
				header: t("admins.trafficMode"),
				priority: "medium",
				hideBelow: "xl",
				width: "150px",
				maxWidth: "170px",
				mobilePriority: 2,
				mobileMetaLabel: t("admins.trafficMode"),
				cell: (link) => (
					<Select
						size="sm"
						value={link.traffic_limit_mode}
						disabled={savingAdminLimitId === link.id}
						onClick={(event) => event.stopPropagation()}
						onChange={(event) =>
							saveServiceAdminLimit(link.id, {
								traffic_limit_mode: event.target.value as AdminTrafficLimitMode,
							})
						}
					>
						<option value={AdminTrafficLimitMode.UsedTraffic}>
							{t("nodes.usedTrafficSeries")}
						</option>
						<option value={AdminTrafficLimitMode.CreatedTraffic}>
							{t("myaccount.createdTraffic")}
						</option>
					</Select>
				),
			},
			{
				id: "data_limit",
				sortValue: (link) => link.data_limit ?? 0,
				header: t("admins.dataLimit"),
				priority: "medium",
				hideBelow: "xl",
				width: "120px",
				maxWidth: "140px",
				mobilePriority: 3,
				mobileMetaLabel: t("admins.dataLimit"),
				cell: (link) => (
					<Input
						size="sm"
						type="number"
						inputMode="decimal"
						min={0}
						step={0.01}
						defaultValue={formatUnitInputValue(link.data_limit)}
						disabled={savingAdminLimitId === link.id}
						onClick={(event) => event.stopPropagation()}
						onInput={(event) => {
							event.currentTarget.value = sanitizeDecimalInput(
								event.currentTarget.value,
							);
						}}
						onBlur={(event) => {
							const dataLimitGb = parseDecimalInput(event.target.value);
							saveServiceAdminLimit(link.id, {
								data_limit:
									dataLimitGb !== null ? dataLimitGb * GB_IN_BYTES : null,
							});
						}}
					/>
				),
			},
			{
				id: "users_limit",
				sortValue: (link) => link.users_limit ?? 0,
				header: t("admins.usersLimit"),
				priority: "low",
				hideBelow: "xl",
				width: "110px",
				maxWidth: "130px",
				mobilePriority: 4,
				mobileMetaLabel: t("admins.usersLimit"),
				cell: (link) => (
					<Input
						size="sm"
						type="number"
						inputMode="numeric"
						min={0}
						step={1}
						defaultValue={link.users_limit ?? ""}
						disabled={savingAdminLimitId === link.id}
						onClick={(event) => event.stopPropagation()}
						onInput={(event) => {
							event.currentTarget.value = sanitizeIntegerInput(
								event.currentTarget.value,
							);
						}}
						onBlur={(event) =>
							saveServiceAdminLimit(link.id, {
								users_limit: parseIntegerInput(event.target.value),
							})
						}
					/>
				),
			},
			{
				id: "delete_cap",
				sortValue: (link) => link.delete_user_usage_limit ?? 0,
				header: t("admins.deleteUserUsageLimit"),
				priority: "low",
				hideBelow: "xl",
				width: "128px",
				maxWidth: "150px",
				mobilePriority: 5,
				mobileMetaLabel: t("admins.deleteUserUsageLimit"),
				cell: (link) => (
					<Input
						size="sm"
						type="number"
						inputMode="decimal"
						min={0}
						step={0.01}
						defaultValue={formatUnitInputValue(
							link.delete_user_usage_limit,
							MB_IN_BYTES,
						)}
						disabled={savingAdminLimitId === link.id}
						onClick={(event) => event.stopPropagation()}
						onInput={(event) => {
							event.currentTarget.value = sanitizeDecimalInput(
								event.currentTarget.value,
							);
						}}
						onBlur={(event) => {
							const deleteUserUsageLimitMb = parseDecimalInput(
								event.target.value,
							);
							saveServiceAdminLimit(link.id, {
								delete_user_usage_limit:
									deleteUserUsageLimitMb !== null
										? deleteUserUsageLimitMb * MB_IN_BYTES
										: null,
							});
						}}
					/>
				),
			},
			{
				id: "usage_coefficient",
				sortValue: (link) => link.usage_coefficient ?? 0,
				header: t("services.usageCoefficientColumn"),
				priority: "low",
				hideBelow: "xl",
				width: "230px",
				maxWidth: "260px",
				mobilePriority: 7,
				mobileMetaLabel: t("services.usageCoefficientColumn"),
				cell: (link) => {
					const coefficient = link.usage_coefficient ?? null;
					return (
						<div className="flex flex-row items-center gap-2">
							<Select
								size="sm"
								value={coefficient === null ? "default" : "custom"}
								disabled={savingAdminLimitId === link.id}
								onClick={(event) => event.stopPropagation()}
								onChange={(event) =>
									saveServiceAdminLimit(link.id, {
										usage_coefficient:
											event.target.value === "custom" ? serviceDefaultCoefficient : null,
									})
								}
							>
								<option value="default">
									{t("services.usageCoefficientDefault", { value: serviceDefaultCoefficient })}
								</option>
								<option value="custom">{t("services.usageCoefficientCustom")}</option>
							</Select>
							{coefficient !== null ? (
								<Input key={`${link.id}-${coefficient}`} size="sm" type="number" inputMode="decimal" min={0.01} max={100} step={0.01} precision={2} defaultValue={coefficient} disabled={savingAdminLimitId === link.id} onClick={(event) => event.stopPropagation()} onInput={(event) => {
										event.currentTarget.value = sanitizeDecimalInput(event.currentTarget.value);
									}} onBlur={(event) => {
										const value = parseCoefficientInput(event.target.value);
										if (value === null || value < 0.01 || value > 100) {
											toast({
												status: "warning",
												title: t("services.validation.usageCoefficientInvalid"),
											});
											event.target.value = String(coefficient);
											return;
										}
										if (value !== coefficient) {
											saveServiceAdminLimit(link.id, { usage_coefficient: value });
										}
									}} className="w-[90px]" />
							) : null}
						</div>
					);
				},
			},
			{
				id: "flags",
				sortValue: (link) => (link.show_user_traffic ? 1 : 0) + (link.delete_user_usage_limit_enabled ? 2 : 0),
				header: t("admins.permissionsTabLabel"),
				priority: "low",
				hideBelow: "xl",
				width: "230px",
				maxWidth: "260px",
				mobilePriority: 6,
				mobileMetaLabel: t("admins.permissionsTabLabel"),
				cell: (link) => (
					<div className="flex flex-row items-center gap-3 justify-center flex-wrap">
						<Checkbox size="sm" checked={link.show_user_traffic} disabled={savingAdminLimitId === link.id} onClick={(event) => event.stopPropagation()} onChange={(event) =>
								saveServiceAdminLimit(link.id, {
									show_user_traffic: event.target.checked,
								})
							}>
							{t("admins.showUserTraffic")}
						</Checkbox>
						<Checkbox size="sm" checked={link.delete_user_usage_limit_enabled} disabled={savingAdminLimitId === link.id} onClick={(event) => event.stopPropagation()} onChange={(event) =>
								saveServiceAdminLimit(link.id, {
									delete_user_usage_limit_enabled: event.target.checked,
								})
							}>
							{t("admins.deleteUserUsageCap")}
						</Checkbox>
					</div>
				),
			},
		],
		[saveServiceAdminLimit, savingAdminLimitId, serviceDefaultCoefficient, t, toast],
	);

	const serviceAdminRowActions = (
		link: ServiceAdmin,
	): DataTableRowAction<ServiceAdmin>[] => [
		{
			id: "editLimits",
			label: t("services.editAdminLimits"),
			icon: <PencilSquareIcon className="w-[16px]" />,
			onClick: () => openServiceAdminLimitEditor(link),
			disabled: savingAdminLimitId === link.id,
		},
		{
			id: "resetDeleted",
			label: t("admins.resetDeletedUsage"),
			icon: <ArrowPathIcon className="w-[16px]" />,
			onClick: () => resetServiceDeletedUsersUsage(link),
			disabled:
				link.deleted_users_usage <= 0 || savingAdminLimitId === link.id,
		},
	];

	const serviceHostColumns = useMemo<DataTableColumn<ServiceHost>[]>(
		() => [
			{
				id: "remark",
				header: t("nodes.nodeName"),
				accessor: "remark",
				isPrimary: true,
				priority: "primary",
				width: "220px",
				maxWidth: "260px",
				truncate: true,
				tooltip: true,
				mobilePriority: 0,
				mobileMetaLabel: t("nodes.nodeName"),
				cell: (host) => (
					<p className="font-semibold truncate">
						<AppleEmojiText>{host.remark}</AppleEmojiText>
					</p>
				),
			},
			{
				id: "inbound",
				sortValue: (host) => host.inbound_tag ?? "",
				header: t("inbound"),
				priority: "high",
				width: "180px",
				maxWidth: "220px",
				truncate: true,
				tooltip: true,
				mobilePriority: 1,
				mobileMetaLabel: t("inbound"),
				cell: (host) => (
					<p className="text-[0.875rem] truncate">
						{host.inbound_protocol.toUpperCase()} - {host.inbound_tag}
					</p>
				),
			},
			{
				id: "address",
				header: t("nodes.nodeAddress"),
				accessor: "address",
				priority: "medium",
				hideBelow: "xl",
				width: "170px",
				maxWidth: "210px",
				truncate: true,
				tooltip: true,
				mobilePriority: 2,
				mobileMetaLabel: t("nodes.nodeAddress"),
				cell: (host) => (
					<p dir="ltr" className="[unicode-bidi:isolate] truncate">
						{host.address || "-"}
					</p>
				),
			},
			{
				id: "port",
				header: t("port"),
				accessor: "port",
				priority: "medium",
				width: "90px",
				maxWidth: "110px",
				mobilePriority: 3,
				mobileMetaLabel: t("port"),
				cell: (host) => <p>{host.port ?? "-"}</p>,
			},
			{
				id: "sort",
				header: t("services.sort"),
				accessor: "sort",
				priority: "low",
				hideBelow: "xl",
				width: "90px",
				maxWidth: "110px",
				mobilePriority: 4,
				mobileMetaLabel: t("services.sort"),
				cell: (host) => <Badge className="rounded-md">#{host.sort + 1}</Badge>,
			},
		],
		[t],
	);

	if (!getUserIsSuccess) {
		return <PageLoadingSkeleton />;
	}

	if (!canManageServices) {
		return (
			<div className="flex flex-col gap-3 items-stretch">
				<PageHeader title={t("services.title")} />
				<p className="text-[0.875rem] text-panel-text-muted">
					{t("services.noPermission")}
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 items-stretch">
			<ResourceListCard
				title={t("services.listHeader")}
				summaryItems={serviceSummaryItems}
				actions={
					<Button colorScheme="primary" onClick={openCreateDialog} size="sm" className="h-[36px] px-3 rounded-[4px]">{<PlusIcon className="w-[18px]" />}
						{t("services.addService")}
					</Button>
				}
			/>

			<Input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder={t("services.searchServices")} className="max-w-[320px]" />

			<DataTable
				ariaLabel={t("services.title")}
					data={services}
				columns={serviceColumns}
				getRowId={(service) => String(service.id)}
					loading={isServicesLoading}
				loadingRows={5}
				emptyState={
					<div className="text-center">
						<p className="font-semibold">
							{t("services.noServicesAvailable")}
						</p>
						<p className={cn(labelColor, "text-[0.875rem] mt-1")}>
							{t("services.emptyHint")}
						</p>
					</div>
				}
				rowActions={serviceRowActions}
				actionsDisplay="menu"
				actionsPlacement="end"
				actionsColumnWidth="60px"
				showActionsOnHover
				onRowClick={(service) => {
					void openServiceDetail(service.id, "admins");
				}}
				mobileBreakpoint="md"
				tableProps={{ className: "w-full [table-layout:fixed] [&_th]:px-2 [&_td]:px-2 [&_th]:py-2.5 [&_td]:py-2.5 [&_th]:align-middle [&_td]:align-middle xl:[&_th]:px-2.5 xl:[&_td]:px-2.5" }}
			/>
			<Pagination
				for="services"
				total={servicesTotal}
				limit={listFilters.limit}
				offset={listFilters.offset}
				onPageChange={(page) =>
					setListFilters((current) => ({
						...current,
						offset: page * current.limit,
					}))
				}
				onPageSizeChange={(size) =>
					setListFilters((current) => ({
						...current,
						limit: size,
						offset: 0,
					}))
				}
			/>

			{selectedService && (
				<div className="flex flex-col gap-3">
					<PageHeader
						title={
							<span className="text-[1rem] font-semibold truncate">
								{selectedService.name}
							</span>
						}
						description={
							selectedService.description ? (
								<span className="line-clamp-2">
									{selectedService.description}
								</span>
							) : undefined
						}
						actions={
							<Badge colorScheme="primary" className="rounded-md">
								{t("services.usersCount", {
									count: selectedService.user_count,
								})}
							</Badge>
						}
					/>
					<TabSystem
						tabs={[
							{
								label: t("services.admins"),
								value: "admins",
								isActive: activeServiceTab === "admins",
								onClick: () => setActiveServiceTab("admins"),
							},
							{
								label: t("services.hosts"),
								value: "hosts",
								isActive: activeServiceTab === "hosts",
								onClick: () => setActiveServiceTab("hosts"),
							},
						]}
					/>
					{activeServiceTab === "admins" ? (
						<DataTable containerProps={{ className: "mt-3" }} ariaLabel={t("services.admins")} data={selectedService.admins} columns={serviceAdminColumns} getRowId={(link) => String(link.id)} emptyState={
								<p className="text-[0.875rem] text-panel-text-muted text-center">
									{t("services.noAdmins")}
								</p>
							} rowActions={serviceAdminRowActions} actionsDisplay="menu" actionsPlacement="end" actionsColumnWidth="60px" showActionsOnHover mobileBreakpoint="md" tableProps={{ className: "w-full [table-layout:fixed] [&_th]:px-2 [&_td]:px-2 [&_th]:py-2.5 [&_td]:py-2.5 [&_th]:align-middle [&_td]:align-middle xl:[&_th]:px-2.5 xl:[&_td]:px-2.5" }} />
					) : (
						<DataTable containerProps={{ className: "mt-3" }} ariaLabel={t("services.hosts")} data={selectedService.hosts} columns={serviceHostColumns} getRowId={(host) => String(host.id)} emptyState={
								<p className="text-[0.875rem] text-panel-text-muted text-center">
									{t("services.noHosts")}
								</p>
							} mobileBreakpoint="md" tableProps={{ className: "w-full [table-layout:fixed] [&_th]:px-2 [&_td]:px-2 [&_th]:py-2.5 [&_td]:py-2.5 [&_th]:align-middle [&_td]:align-middle xl:[&_th]:px-2.5 xl:[&_td]:px-2.5" }} />
					)}
				</div>
			)}

			<AppDialog open={Boolean(editingServiceAdminLimit)} onClose={closeServiceAdminLimitEditor} size="lg" scrollBehavior="inside" isCentered title={`${t("services.editAdminLimits")}${
					editingServiceAdminLimit
						? ` - ${editingServiceAdminLimit.username}`
						: ""
				}`} overlayProps={{ className: "bg-blackAlpha-300" }} footerProps={{ className: "gap-3" }} footer={
					<>
						<Button size="md" variant="ghost" onClick={closeServiceAdminLimitEditor}>
							{t("cancel")}
						</Button>
						<Button size="md" colorScheme="primary" onClick={submitServiceAdminLimitEditor} loading={
								editingServiceAdminLimit
									? savingAdminLimitId === editingServiceAdminLimit.id
									: false
							}>
							{t("save")}
						</Button>
					</>
				}>
				<div className="flex flex-col gap-4">
					<FormControl>
						<FormLabel>{t("admins.trafficMode")}</FormLabel>
						<Select
							value={serviceAdminLimitForm.traffic_limit_mode}
							onChange={(event) =>
								setServiceAdminLimitForm((current) => ({
									...current,
									traffic_limit_mode: event.target
										.value as AdminTrafficLimitMode,
								}))
							}
						>
							<option value={AdminTrafficLimitMode.UsedTraffic}>
								{t("nodes.usedTrafficSeries")}
							</option>
							<option value={AdminTrafficLimitMode.CreatedTraffic}>
								{t("myaccount.createdTraffic")}
							</option>
						</Select>
					</FormControl>
					<FormControl>
						<FormLabel>{t("services.usageCoefficientColumn")}</FormLabel>
						<Input
							type="number"
							inputMode="decimal"
							min={0.01}
							max={100}
							step={0.01}
							precision={2}
							placeholder={String(selectedService?.usage_coefficient ?? 1)}
							value={serviceAdminLimitForm.usage_coefficient}
							onChange={(event) =>
								setServiceAdminLimitForm((current) => ({
									...current,
									usage_coefficient: event.target.value,
								}))
							}
						/>
						<FormHelperText>
							{t("services.adminUsageCoefficientHint", { value: selectedService?.usage_coefficient ?? 1 })}
						</FormHelperText>
					</FormControl>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<FormControl>
							<FormLabel>{t("admins.dataLimit")}</FormLabel>
							<Input
								type="number"
								inputMode="decimal"
								min={0}
								step={0.01}
								value={serviceAdminLimitForm.data_limit_gb}
								placeholder={t("admins.dataLimitPlaceholder")}
								onChange={(event) =>
									setServiceAdminLimitForm((current) => ({
										...current,
										data_limit_gb: sanitizeDecimalInput(event.target.value),
									}))
								}
							/>
							<FormHelperText>{t("admins.dataLimitHint")}</FormHelperText>
						</FormControl>
						<FormControl>
							<FormLabel>{t("admins.usersLimit")}</FormLabel>
							<Input
								type="number"
								inputMode="numeric"
								min={0}
								step={1}
								value={serviceAdminLimitForm.users_limit}
								placeholder={t("admins.usersLimitPlaceholder")}
								onChange={(event) =>
									setServiceAdminLimitForm((current) => ({
										...current,
										users_limit: sanitizeIntegerInput(event.target.value),
									}))
								}
							/>
							<FormHelperText>{t("admins.usersLimitHint")}</FormHelperText>
						</FormControl>
					</div>
					<div className="flex flex-col gap-3">
						<Checkbox checked={serviceAdminLimitForm.show_user_traffic} onChange={(event) =>
								setServiceAdminLimitForm((current) => ({
									...current,
									show_user_traffic: event.target.checked,
								}))
							}>
							{t("admins.showUserTraffic")}
						</Checkbox>
						<Checkbox checked={serviceAdminLimitForm.delete_user_usage_limit_enabled} onChange={(event) =>
								setServiceAdminLimitForm((current) => ({
									...current,
									delete_user_usage_limit_enabled: event.target.checked,
								}))
							}>
							{t("admins.deleteUserUsageCap")}
						</Checkbox>
						<FormControl disabled={
								!serviceAdminLimitForm.delete_user_usage_limit_enabled
							}>
							<FormLabel>{t("admins.deleteUserUsageLimit")}</FormLabel>
							<Input
								type="number"
								inputMode="decimal"
								min={0}
								step={0.01}
								value={serviceAdminLimitForm.delete_user_usage_limit_mb}
								onChange={(event) =>
									setServiceAdminLimitForm((current) => ({
										...current,
										delete_user_usage_limit_mb: sanitizeDecimalInput(
											event.target.value,
										),
									}))
								}
							/>
						</FormControl>
					</div>
				</div>
			</AppDialog>

			<ConfirmDialog
				open={isResetDialogOpen}
				onClose={closeResetDialog}
				onConfirm={confirmResetUsage}
				title={t("services.resetUsage")}
				description={t("services.resetUsageConfirm", {
					name: resetTargetName ?? t("services.thisService"),
				})}
				confirmLabel={t("services.resetUsage")}
				colorScheme="primary"
				loading={isResetting}
				isConfirmDisabled={resetServiceId == null}
			/>

			<AppDialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog} size="lg" title={`${t("services.deleteDialogTitle")}${
					servicePendingDelete ? ` – ${servicePendingDelete.name}` : ""
				}`} overlayProps={{ className: "bg-blackAlpha-300" }} footerProps={{ className: "gap-3" }} footer={
					<>
						<Button size="md" variant="ghost" onClick={handleCloseDeleteDialog}>
							{t("cancel")}
						</Button>
						<Button size="md" colorScheme="red" onClick={confirmDeleteService} loading={isDeleting} disabled={
								!servicePendingDelete ||
								(deleteMode === "transfer_users" &&
									servicePendingDelete.user_count > 0 &&
									!targetServiceId)
							}>
							{t("delete")}
						</Button>
					</>
				}>
				{servicePendingDelete ? (
					<div className="flex flex-col items-stretch gap-4">
						<p>
							{t("services.deleteDialogDescription", {
								name: servicePendingDelete.name,
							})}
						</p>
						{servicePendingDelete.admin_ids.length > 0 ? (
							<Checkbox checked={unlinkAdmins} onChange={(event) => setUnlinkAdmins(event.target.checked)}>
								{t("services.unlinkAdminsOption")}
							</Checkbox>
						) : (
							<p className="text-[0.875rem] text-gray-500">
								{t("services.noAdminsLinked")}
							</p>
						)}
						{servicePendingDelete.user_count > 0 ? (
							<div className="flex flex-col items-stretch gap-3">
								<p className="font-semibold">
									{t("services.userDeletePrompt", {
										count: servicePendingDelete.user_count,
									})}
								</p>
								<RadioGroup value={deleteMode} onChange={(value) =>
										setDeleteMode(value as "delete_users" | "transfer_users")
									}>
									<div className="flex flex-col items-start gap-2">
										<Radio value="delete_users">
											{t("services.deleteUsersOption")}
										</Radio>
										<Radio value="transfer_users">
											{t("services.transferUsersOption")}
										</Radio>
									</div>
								</RadioGroup>
								{deleteMode === "transfer_users" && (
									<FormControl>
										<FormLabel>{t("services.selectTargetService")}</FormLabel>
										<Select
											placeholder={t("services.selectServicePlaceholder")}
											value={targetServiceId?.toString() ?? ""}
											onChange={(
												event: React.ChangeEvent<HTMLSelectElement>,
											) => {
												const value = event.target.value;
												if (!value) {
													setTargetServiceId(null);
													return;
												}
												setTargetServiceId(Number(value));
											}}
										>
											{otherServices.map((service) => (
												<option key={service.id} value={service.id}>
													{service.name}
												</option>
											))}
										</Select>
										<FormHelperText>
											{t("services.transferUsersHint")}
										</FormHelperText>
									</FormControl>
								)}
							</div>
						) : (
							<Alert status="info" className="rounded-md">
								<AlertIcon />
								<AlertDescription>
									{t("services.noUsersLinked")}
								</AlertDescription>
							</Alert>
						)}
					</div>
				) : (
					<p>{t("services.loading")}</p>
				)}
			</AppDialog>

			{dialogDisclosure.isOpen && (
				<ServiceDialog
					open={dialogDisclosure.isOpen}
					onClose={dialogDisclosure.onClose}
					onSubmit={handleSubmit}
						isSaving={isServiceSaving}
					allHosts={hostOptions}
					allAdmins={adminOptions}
					initialService={editingService ?? undefined}
					inbounds={inbounds}
					refreshInbounds={fetchInbounds}
						refreshHosts={fetchHosts}
				/>
			)}
		</div>
	);
};

export default ServicesPage;
