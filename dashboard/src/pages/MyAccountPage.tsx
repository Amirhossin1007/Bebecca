import type { TFunction } from "i18next";
import { useColorMode } from "lib/color-mode";
import { Badge } from "components/shadcn/badge";
import { useToast } from "components/shadcn/toast";
import { Button, IconButton } from "components/shadcn/button";
import { Input, InputGroup, InputRightElement } from "components/shadcn/input";
import { useDisclosure } from "hooks/useDisclosure";
import { useClipboard } from "hooks/useClipboard";
import { Spinner } from "components/shadcn/feedback";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "components/shadcn/tabs";
import { Icon, withClass } from "components/shadcn/icon";
import { cn } from "lib/cn";
import {
	ChartBarIcon,
	ClipboardIcon,
	EyeIcon,
	EyeSlashIcon,
	KeyIcon,
	SparklesIcon,
	TrashIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline";
import type { ApexOptions } from "apexcharts";
import { AccountSecurity } from "components/AccountSecurity";
import { ChartBox } from "components/common/ChartBox";
import {
	DateRangePicker,
	type DateRangeValue,
} from "components/common/DateRangePicker";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { AppDialog } from "components/dialogs/AppDialog";
import { PageHeader, PageLoadingSkeleton } from "components/ui";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import useGetUser from "hooks/useGetUser";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
	changeMyAccountPassword,
	createApiKey,
	deleteApiKey,
	getAdminNodesUsage,
	getMyAccount,
	listApiKeys,
} from "service/myaccount";
import { AdminRole } from "types/Admin";
import type { AdminApiKey } from "types/ApiKey";
import type {
	MyAccountNodeUsage,
	MyAccountResponse,
	MyAccountServiceLimit,
	MyAccountTrafficBasis,
	MyAccountUsagePoint,
} from "types/MyAccount";
import { formatBytes } from "utils/formatByte";
import { clearClientSession } from "utils/session";

dayjs.extend(utc);
const CopyIcon = withClass(ClipboardIcon, "w-4 h-4");
const DeleteIcon = withClass(TrashIcon, "w-4 h-4");
type AccountSection = "info" | "security" | "api_keys";

const ACCOUNT_SECTION_HASH: Record<AccountSection, string> = {
	info: "info",
	security: "security",
	api_keys: "api-keys",
};

const accountSectionFromHash = (): AccountSection | null => {
	if (typeof window === "undefined") return null;
	const hash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
	return (
		(Object.entries(ACCOUNT_SECTION_HASH).find(
			([, value]) => value === hash,
		)?.[0] as AccountSection | undefined) ?? null
	);
};

const formatTimeseriesLabel = (value: string) => {
	if (!value) return value;
	const hasTime = value.includes(" ");
	const normalized = hasTime ? value.replace(" ", "T") : value;
	const parsed = dayjs.utc(normalized);
	if (!parsed.isValid()) return value;
	return hasTime
		? parsed.local().format("MM-DD HH:mm")
		: parsed.format("YYYY-MM-DD");
};

const buildDailyUsageOptions = (
	colorMode: string,
	categories: string[],
): ApexOptions => {
	const axisColor = colorMode === "dark" ? "#d8dee9" : "#1a202c";
	return {
		chart: { type: "area", toolbar: { show: false }, zoom: { enabled: false } },
		dataLabels: { enabled: false },
		stroke: { curve: "smooth", width: 2 },
		fill: {
			type: "gradient",
			gradient: {
				shadeIntensity: 1,
				opacityFrom: 0.35,
				opacityTo: 0.05,
				stops: [0, 80, 100],
			},
		},
		grid: { borderColor: colorMode === "dark" ? "#2D3748" : "#E2E8F0" },
		xaxis: {
			categories,
			labels: { style: { colors: categories.map(() => axisColor) } },
			axisBorder: { show: false },
			axisTicks: { show: false },
		},
		yaxis: {
			labels: {
				formatter: (value: number) => formatBytes(Number(value) || 0, 1),
				style: { colors: [axisColor] },
			},
		},
		tooltip: {
			theme: colorMode === "dark" ? "dark" : "light",
			shared: true,
			fillSeriesColor: false,
			y: { formatter: (value: number) => formatBytes(Number(value) || 0, 2) },
		},
		colors: [colorMode === "dark" ? "#63B3ED" : "#3182CE"],
	};
};

const buildDonutOptions = (
	colorMode: string,
	labels: string[],
): ApexOptions => ({
	labels,
	legend: {
		position: "bottom",
		labels: { colors: colorMode === "dark" ? "#d8dee9" : "#1a202c" },
	},
	tooltip: {
		y: {
			formatter: (value: number) => formatBytes(Number(value) || 0, 2),
		},
	},
	colors: [
		"#3182CE",
		"#63B3ED",
		"#ED8936",
		"#38A169",
		"#9F7AEA",
		"#F6AD55",
		"#4299E1",
		"#E53E3E",
		"#D53F8C",
		"#805AD5",
	],
});

const normalizeApiKeys = (value: unknown): AdminApiKey[] => {
	if (Array.isArray(value)) return value;
	if (value && typeof value === "object") {
		const payload = value as {
			api_keys?: unknown;
			apiKeys?: unknown;
			keys?: unknown;
			obj?: unknown;
		};
		if (Array.isArray(payload.api_keys))
			return payload.api_keys as AdminApiKey[];
		if (Array.isArray(payload.apiKeys)) return payload.apiKeys as AdminApiKey[];
		if (Array.isArray(payload.keys)) return payload.keys as AdminApiKey[];
		if (Array.isArray(payload.obj)) return payload.obj as AdminApiKey[];
	}
	return [];
};

const normalizeArray = <T,>(value: unknown): T[] =>
	Array.isArray(value) ? (value as T[]) : [];

type StatsCardProps = {
	label: string;
	value: string;
};

const StatsCard: React.FC<StatsCardProps> = ({ label, value }) => {
	const labelColor = "text-panel-text-muted";

	return (
		<div className="min-w-0! py-1">
			<p className={cn("text-[0.75rem] font-semibold", labelColor)}>
				{label}
			</p>
			<p className="mt-1 text-[1.125rem] leading-[1.2] font-semibold">
				{value}
			</p>
		</div>
	);
};

const MiniMetric: React.FC<{ label: string; value: string }> = ({
	label,
	value,
}) => {
	const labelColor = "text-gray-500 dark:text-gray-400";
	return (
		<div>
			<p className={cn("text-[0.75rem] font-semibold", labelColor)}>
				{label}
			</p>
			<p className="mt-1 font-semibold">
				{value}
			</p>
		</div>
	);
};

const getTrafficLabels = (
	// i18next 25 types t as an overloaded function; the helper only needs the
	// simple call signature, so accept the real one and narrow at the boundary.
	t: TFunction,
	basis: MyAccountTrafficBasis,
) => {
	const isCreated = basis === "created_traffic";
	return {
		sectionTitle: isCreated
			? t("myaccount.createdTrafficSection")
			: t("myaccount.dataUsage"),
		usedLabel: isCreated
			? t("myaccount.createdTraffic")
			: t("myaccount.usedData"),
		remainingLabel: isCreated
			? t("myaccount.remainingTraffic")
			: t("myaccount.remainingData"),
		totalLabel: isCreated
			? t("myaccount.trafficLimit")
			: t("total"),
		dailyChartTitle: isCreated
			? t("myaccount.dailyCreatedTraffic")
			: t("myaccount.dailyUsage"),
		dailyTotalLabel: isCreated
			? t("myaccount.selectedPeriodCreatedTraffic")
			: t("myaccount.selectedPeriodUsage"),
		modeLabel: isCreated
			? t("myaccount.serviceModeCreated")
			: t("myaccount.serviceModeUsed"),
	};
};

const ServiceLimitPanel: React.FC<{
	service: MyAccountServiceLimit;
	colorMode: string;
	t: TFunction;
	expiryText: string | null;
}> = ({ service, colorMode, t, expiryText }) => {
	const borderColor = "border-blackAlpha-200! border-t-blackAlpha-200! dark:border-whiteAlpha-200! dark:border-t-whiteAlpha-200!";
	const bg = "bg-white dark:bg-whiteAlpha-50";
	const subBg = "bg-gray-50 dark:bg-whiteAlpha-100";
	const labelColor = "text-gray-500 dark:text-gray-400";
	const labels = getTrafficLabels(t, service.traffic_basis);
	const dailyPoints = service.daily_usage ?? [];
	const dailyTotal = dailyPoints.reduce(
		(sum, point) => sum + Number(point.used_traffic || 0),
		0,
	);
	const categories = dailyPoints.map((point) =>
		formatTimeseriesLabel(point.date),
	);
	const series = [
		{
			name: labels.dailyChartTitle,
			data: dailyPoints.map((point) => point.used_traffic),
		},
	];
	const limit = service.data_limit ?? 0;
	const remaining =
		service.remaining_data ?? Math.max(limit - service.used_traffic, 0);
	const usersLimit = service.users_limit ?? 0;
	const remainingUsers =
		service.remaining_users ??
		Math.max(usersLimit - service.current_users_count, 0);

	return (
		<div className={cn(borderColor, cn("border rounded-md", bg))}>
			<div className="flex flex-row justify-between items-start mb-4 gap-3">
				<div className="min-w-0! px-4 pt-4">
					<p className="font-semibold truncate">
						{service.service_name}
					</p>
					<p className={cn("text-[0.75rem]", labelColor)}>
						{t("myaccount.serviceLimit")}
					</p>
				</div>
				<div className="px-4 pt-4">
					<div className="flex flex-row items-center gap-2 justify-end flex-wrap">
						{expiryText && (
							<Badge colorScheme="orange" className="rounded-md">
								{t("myaccount.remainingDays")}: {expiryText}
							</Badge>
						)}
						<Badge colorScheme={
								service.traffic_basis === "created_traffic" ? "purple" : "blue"
							} className="rounded-md">
							{labels.modeLabel}
						</Badge>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 pb-4">
				<MiniMetric
					label={labels.usedLabel}
					value={formatBytes(service.used_traffic, 2)}
				/>
				<MiniMetric
					label={labels.remainingLabel}
					value={
						service.data_limit === null
							? t("myaccount.unlimited")
							: formatBytes(remaining, 2)
					}
				/>
				<MiniMetric
					label={labels.totalLabel}
					value={
						service.data_limit === null
							? t("myaccount.unlimited")
							: formatBytes(limit, 2)
					}
				/>
				<MiniMetric
					label={t("myaccount.createdUsers")}
					value={`${service.current_users_count}`}
				/>
				<MiniMetric
					label={t("myaccount.remainingUsers")}
					value={
						service.users_limit === null
							? t("myaccount.unlimited")
							: `${Math.max(remainingUsers, 0)}`
					}
				/>
				<MiniMetric
					label={t("myaccount.totalUsers")}
					value={
						service.users_limit === null
							? t("myaccount.unlimited")
							: `${usersLimit}`
					}
				/>
			</div>

			<div className={cn(borderColor, cn("border-t p-4", subBg))}>
				<p className={cn("text-[0.875rem] mb-2", labelColor)}>
					{labels.dailyTotalLabel}:{" "}
					<span className="font-semibold">
						{formatBytes(dailyTotal, 2)}
					</span>
				</p>
				{series[0].data.length ? (
					<ReactApexChart options={buildDailyUsageOptions(colorMode, categories)} series={series as any} type="area" className="h-220" />
				) : (
					<p className={cn(labelColor)}>{t("noData")}</p>
				)}
			</div>
		</div>
	);
};

const ServiceBalanceCard: React.FC<{
	service: MyAccountServiceLimit;
	t: TFunction;
	expiryText: string | null;
}> = ({ service, t, expiryText }) => {
	const borderColor = "border-blackAlpha-200! border-t-blackAlpha-200! dark:border-whiteAlpha-200! dark:border-t-whiteAlpha-200!";
	const bg = "bg-white dark:bg-whiteAlpha-50";
	const labelColor = "text-gray-500 dark:text-gray-400";
	const labels = getTrafficLabels(t, service.traffic_basis);
	const limit = service.data_limit ?? 0;
	const remaining =
		service.remaining_data ?? Math.max(limit - service.used_traffic, 0);
	const remainingText =
		service.data_limit === null
			? t("myaccount.unlimited")
			: formatBytes(remaining, 2);
	const limitText =
		service.data_limit === null
			? t("myaccount.unlimited")
			: formatBytes(limit, 2);

	return (
		<div className={cn(borderColor, cn("border rounded-md p-4", bg))}>
			<div className="flex flex-row justify-between items-start gap-3 gap-y-2 flex-wrap mb-3">
				<div className="min-w-0!">
					<p className={cn("text-[0.75rem] font-semibold", labelColor)}>
						{t("myaccount.service")}
					</p>
					<p className="font-semibold text-[1.125rem] truncate">
						{service.service_name}
					</p>
				</div>
				<div className="flex flex-row items-center gap-2 flex-wrap justify-end">
					{expiryText && (
						<Badge colorScheme="orange" className="rounded-md">
							{t("myaccount.remainingDays")}: {expiryText}
						</Badge>
					)}
					<Badge colorScheme={
							service.traffic_basis === "created_traffic" ? "purple" : "blue"
						} className="rounded-md">
						{labels.modeLabel}
					</Badge>
				</div>
			</div>
			<p className="text-[1.5rem] font-bold">
				{remainingText}
			</p>
			<p className={cn("text-[0.875rem]", labelColor)}>
				{t("myaccount.remainingFromService")}
			</p>
			<div className="grid grid-cols-2 gap-3 mt-4">
				<MiniMetric
					label={labels.usedLabel}
					value={formatBytes(service.used_traffic, 2)}
				/>
				<MiniMetric label={labels.totalLabel} value={limitText} />
			</div>
		</div>
	);
};

const ChangePasswordModal: React.FC<{
	open: boolean;
	onClose: () => void;
	onSubmit: (current: string, next: string) => Promise<void>;
}> = ({ open: isOpen, onClose, onSubmit }) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === "fa";
	const toast = useToast();
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [isSubmitting, setSubmitting] = useState(false);

	const generateRandomString = useCallback((length: number) => {
		const characters =
			"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
		const charactersLength = characters.length;

		if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
			const randomValues = new Uint32Array(length);
			window.crypto.getRandomValues(randomValues);
			return Array.from(
				randomValues,
				(value) => characters[value % charactersLength],
			).join("");
		}

		return Array.from({ length }, () => {
			const index = Math.floor(Math.random() * charactersLength);
			return characters[index];
		}).join("");
	}, []);

	const handleGeneratePassword = () => {
		const randomPassword = generateRandomString(12);
		setNewPassword(randomPassword);
	};

	const handleSubmit = async () => {
		setSubmitting(true);
		try {
			await onSubmit(currentPassword, newPassword);
			toast({
				title: t("myaccount.passwordUpdated"),
				status: "success",
			});
			setCurrentPassword("");
			setNewPassword("");
			onClose();
		} catch (error: any) {
			toast({
				title: error?.detail || t("error"),
				status: "error",
			});
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AppDialog
			open={isOpen}
			onClose={onClose}
			isCentered
			title={t("myaccount.changePassword")}
			footer={
				<>
					<Button size="md" onClick={onClose} variant="ghost" className="mr-3">
						{t("cancel")}
					</Button>
					<Button size="md" colorScheme="primary" onClick={handleSubmit} loading={isSubmitting} disabled={!newPassword}>
						{t("save")}
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4 items-stretch">
				<div className="max-w-[420px]">
					<InputGroup dir={isRTL ? "rtl" : "ltr"}>
						<Input placeholder={t("myaccount.currentPassword")} type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="pe-[2.75rem]" />
						<InputRightElement className="end-[0.5rem] right-auto left-auto">
							<IconButton aria-label={
									showCurrent
										? t("admins.hidePassword")
										: t("admins.showPassword")
								} size="sm" variant="ghost" onClick={() => setShowCurrent(!showCurrent)} >{showCurrent ? (
										<EyeSlashIcon className="w-[16px]" />
									) : (
										<EyeIcon className="w-[16px]" />
									)}</IconButton>
						</InputRightElement>
					</InputGroup>
				</div>
				<div className="max-w-[420px]">
					<div className="flex flex-row items-center gap-2">
						<InputGroup dir={isRTL ? "rtl" : "ltr"}>
							<Input placeholder={t("myaccount.newPassword")} type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pe-[2.75rem]" />
							<InputRightElement className="end-[0.5rem] right-auto left-auto">
								<IconButton aria-label={
										showNew
											? t("admins.hidePassword")
											: t("admins.showPassword")
									} size="sm" variant="ghost" onClick={() => setShowNew(!showNew)} >{showNew ? (
											<EyeSlashIcon className="w-[16px]" />
										) : (
											<EyeIcon className="w-[16px]" />
										)}</IconButton>
							</InputRightElement>
						</InputGroup>
						<IconButton aria-label={t("admins.generatePassword")} size="md" variant="outline" onClick={handleGeneratePassword} >{<SparklesIcon className="w-[20px]" />}</IconButton>
					</div>
				</div>
			</div>
		</AppDialog>
	);
};

export const MyAccountPage: React.FC = () => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === "fa";
	const toast = useToast();
	const modal = useDisclosure();
	const apiKeyModal = useDisclosure();
	const queryClient = useQueryClient();
	const { colorMode } = useColorMode();
	const panelBg = "bg-gray-50 dark:bg-whiteAlpha-50";
	const borderColor = "border-blackAlpha-200! border-t-blackAlpha-200! dark:border-whiteAlpha-200! dark:border-t-whiteAlpha-200!";
	const labelColor = "text-gray-500 dark:text-gray-400";
	const { userData, getUserIsSuccess } = useGetUser();
	const { onCopy, setValue: setClipboardValue } = useClipboard("");
	const [range, setRange] = useState<DateRangeValue>(() => {
		const end = dayjs().utc().endOf("day");
		const start = end.subtract(30, "day").startOf("day");
		return {
			start: start.toDate(),
			end: end.toDate(),
			presetKey: "1m",
			key: "1m",
		};
	});
	const [activeSection, setActiveSection] = useState<AccountSection>(
		() => accountSectionFromHash() ?? "info",
	);

	const username = userData?.username;
	const isFullAccess = userData?.role === AdminRole.FullAccess;
	const defaultSelfPermissions = {
		self_myaccount: false,
		self_change_password: false,
		self_api_keys: false,
		self_sessions: false,
		self_2fa: false,
	};
	const baseSelfPermissions =
		userData?.permissions?.self_permissions ?? defaultSelfPermissions;
	const selfPermissions = isFullAccess
		? {
				self_myaccount: true,
				self_change_password: true,
				self_api_keys: true,
				self_sessions: true,
				self_2fa: true,
			}
		: baseSelfPermissions;
	const canViewSecurity =
		selfPermissions.self_change_password ||
		selfPermissions.self_sessions ||
		selfPermissions.self_2fa;
	const accountSections = useMemo<Array<{ id: AccountSection; label: string }>>(
		() => [
			{ id: "info", label: t("myaccount.info") },
			...(canViewSecurity
				? [
						{
							id: "security" as const,
							label: t("myaccount.security"),
						},
					]
				: []),
			...(selfPermissions.self_api_keys
				? [
						{
							id: "api_keys" as const,
							label: t("myaccount.apiKeys"),
						},
					]
				: []),
		],
		[canViewSecurity, selfPermissions.self_api_keys, t],
	);

	useEffect(() => {
		const syncSectionFromHash = () => {
			const requested = accountSectionFromHash();
			const next =
				requested && accountSections.some((section) => section.id === requested)
					? requested
					: "info";
			setActiveSection(next);
			const expectedHash = `#${ACCOUNT_SECTION_HASH[next]}`;
			if (window.location.hash !== expectedHash) {
				window.history.replaceState(
					null,
					"",
					`${window.location.pathname}${window.location.search}${expectedHash}`,
				);
			}
		};
		syncSectionFromHash();
		window.addEventListener("hashchange", syncSectionFromHash);
		return () => window.removeEventListener("hashchange", syncSectionFromHash);
	}, [accountSections]);
	const activeSectionIndex = Math.max(
		0,
		accountSections.findIndex((section) => section.id === activeSection),
	);
	const handleAccountSectionChange = (index: number) => {
		const next = accountSections[index]?.id ?? "info";
		setActiveSection(next);
		const hash = ACCOUNT_SECTION_HASH[next];
		if (window.location.hash !== `#${hash}`) window.location.hash = hash;
	};

	const { data, isLoading, isFetching } = useQuery<MyAccountResponse>({ queryKey: ["myaccount", range.start, range.end], queryFn: () =>
			getMyAccount({
				start: `${dayjs(range.start).utc().format("YYYY-MM-DDTHH:mm:ss")}Z`,
				end: `${dayjs(range.end).utc().format("YYYY-MM-DDTHH:mm:ss")}Z`,
			}), placeholderData: keepPreviousData,
			enabled: selfPermissions.self_myaccount && getUserIsSuccess, });
	const trafficBasis = data?.traffic_basis ?? "used_traffic";
	const isCreatedTrafficBasis = trafficBasis === "created_traffic";
	const isPerServiceLimits = Boolean(data?.use_service_traffic_limits);
	const { data: nodesData } = useQuery({ queryKey: ["myaccount-nodes", username, range.start, range.end], queryFn: () =>
			username
				? getAdminNodesUsage(username, {
						start: `${dayjs(range.start).utc().format("YYYY-MM-DDTHH:mm:ss")}Z`,
						end: `${dayjs(range.end).utc().format("YYYY-MM-DDTHH:mm:ss")}Z`,
					})
				: Promise.resolve({ usages: [] }), placeholderData: keepPreviousData,
			enabled:
				selfPermissions.self_myaccount &&
				Boolean(username) &&
				getUserIsSuccess &&
				data?.traffic_basis === "used_traffic" &&
				!data?.use_service_traffic_limits, });
	const mutation = useMutation({ mutationFn: changeMyAccountPassword, onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["myaccount"] });
		}, });
	const apiKeysQuery = useQuery<AdminApiKey[]>({ queryKey: ["myaccount-api-keys"], queryFn: listApiKeys, enabled:
				selfPermissions.self_api_keys &&
				getUserIsSuccess &&
				activeSection === "api_keys", });
	const apiKeys = useMemo(
		() => normalizeApiKeys(apiKeysQuery.data),
		[apiKeysQuery.data],
	);
	const createKeyMutation = useMutation({ mutationFn: createApiKey, onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["myaccount-api-keys"] });
			if (data?.api_key) {
				setClipboardValue(data.api_key);
			}
			toast({
				title: t("myaccount.apiKeyCreated"),
				status: "success",
			});
			setGeneratedKey(data?.api_key ?? "");
		}, });
	const [selectedLifetime, setSelectedLifetime] = useState<string>("1m");
	const [generatedKey, setGeneratedKey] = useState<string>("");
	const hasGeneratedKey = Boolean(generatedKey);
	const deleteModal = useDisclosure();
	const [deletePassword, setDeletePassword] = useState("");
	const [deleteKeyId, setDeleteKeyId] = useState<number | null>(null);
	const [showDeletePassword, setShowDeletePassword] = useState(false);
	const closeApiKeyDialog = () => {
		apiKeyModal.onClose();
		setGeneratedKey("");
	};
	const closeDeleteKeyDialog = () => {
		deleteModal.onClose();
		setDeleteKeyId(null);
		setDeletePassword("");
		setShowDeletePassword(false);
	};
	const deleteKeyMutation = useMutation({ mutationFn: ({ id, current_password }: { id: number; current_password: string }) =>
			deleteApiKey(id, current_password), onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["myaccount-api-keys"] });
				toast({
					title: t("myaccount.apiKeyDeleted"),
					status: "success",
				});
				closeDeleteKeyDialog();
			}, });
	const handlePasswordChange = async (current: string, next: string) => {
		await mutation.mutateAsync({
			current_password: current,
			new_password: next,
		});
		clearClientSession();
		window.location.reload();
	};

	const dailyUsagePoints: MyAccountUsagePoint[] = useMemo(
		() => normalizeArray<MyAccountUsagePoint>(data?.daily_usage),
		[data?.daily_usage],
	);
	const dailyTotal = useMemo(
		() =>
			dailyUsagePoints.reduce((sum, p) => sum + Number(p.used_traffic || 0), 0),
		[dailyUsagePoints],
	);

	const dailyCategories = useMemo(
		() => dailyUsagePoints.map((p) => formatTimeseriesLabel(p.date)),
		[dailyUsagePoints],
	);
	const dailySeries = useMemo(
		() => [
			{
				name: isCreatedTrafficBasis
					? t("myaccount.dailyCreatedTraffic")
					: t("myaccount.dailyUsage"),
				data: dailyUsagePoints.map((p) => p.used_traffic),
			},
		],
		[dailyUsagePoints, isCreatedTrafficBasis, t],
	);

	// Map backend response (with uplink/downlink) to frontend format (with used_traffic)
	const perNodeUsage: MyAccountNodeUsage[] = useMemo(() => {
		const backendUsages = normalizeArray<any>(
			nodesData?.usages ?? data?.node_usages,
		);
		return backendUsages.map((item: any) => ({
			node_id: item.node_id ?? null,
			node_name: item.node_name || "Unknown",
			used_traffic: Number(
				item.used_traffic ?? (item.uplink ?? 0) + (item.downlink ?? 0),
			),
		}));
	}, [nodesData?.usages, data?.node_usages]);
	const donutLabels = perNodeUsage.map(
		(item: MyAccountNodeUsage) => item.node_name || "Unknown",
	);
	const donutSeries = perNodeUsage.map(
		(item: MyAccountNodeUsage) => item.used_traffic || 0,
	);
	const perNodeTotal = useMemo(
		() =>
			perNodeUsage.reduce(
				(sum: number, p: MyAccountNodeUsage) =>
					sum + Number(p.used_traffic || 0),
				0,
			),
		[perNodeUsage],
	);

	if (!selfPermissions.self_myaccount) {
		return (
			<div className={cn(borderColor, cn("flex flex-col gap-3 items-start border rounded-md p-4", panelBg))}>
				<p className="text-[1.125rem] font-semibold">
					{t("myaccount.forbiddenTitle")}
				</p>
				<p className={cn(labelColor)}>{t("myaccount.forbiddenDescription")}</p>
			</div>
		);
	}

	if (isLoading || !data) {
		return <PageLoadingSkeleton />;
	}

	const used = data.used_traffic || 0;
	const totalData = data.data_limit ?? 0;
	const remainingData = data.remaining_data ?? Math.max(totalData - used, 0);
	const usersLimit = data.users_limit ?? 0;
	const remainingUsers = data.remaining_users ?? 0;
	const serviceLimits = normalizeArray<MyAccountServiceLimit>(
		data.service_limits,
	);
	const expiryLeftMs = data.expire ? data.expire * 1000 - Date.now() : null;
	const expiryText =
		expiryLeftMs === null
			? null
			: expiryLeftMs <= 0
				? t("status.expired")
				: `${Math.ceil(expiryLeftMs / 86400000)}`;
	const trafficLabels = getTrafficLabels(t, trafficBasis);
	const usageSectionTitle = isPerServiceLimits
		? t("myaccount.serviceTrafficOverview")
		: trafficLabels.sectionTitle;
	const usedLabel = isPerServiceLimits
		? t("myaccount.totalServiceTraffic")
		: trafficLabels.usedLabel;
	const remainingLabel = trafficLabels.remainingLabel;
	const totalLabel = isPerServiceLimits
		? t("myaccount.serviceTrafficLimit")
		: trafficLabels.totalLabel;
	const dailyChartTitle = isPerServiceLimits
		? t("myaccount.dailyServiceTraffic")
		: trafficLabels.dailyChartTitle;
	const dailyTotalLabel = isPerServiceLimits
		? t("myaccount.selectedPeriodServiceTraffic")
		: trafficLabels.dailyTotalLabel;
	const showServiceBalances = isPerServiceLimits || serviceLimits.length > 0;

	return (
		<div className="flex flex-col gap-4 items-stretch">
			<PageHeader
				title={t("myaccount.title")}
				description={t("myaccount.subtitle")}
				actions={
					isFetching ? (
						<div className={cn("flex flex-row items-center gap-2", labelColor)}>
							<Spinner size="sm" />
							<p className="text-[0.875rem]">{t("loading")}</p>
						</div>
					) : undefined
				}
			/>

			<Tabs index={activeSectionIndex} onChange={handleAccountSectionChange} isLazy lazyBehavior="keepMounted" variant="unstyled">
				<div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-x-auto overflow-y-hidden max-w-full">
					<TabList className="gap-6 min-h-10 px-2 md:px-3 w-max min-w-full!">
						{accountSections.map((section) => (
							<Tab key={section.id} className="flex-[0_0_auto] h-10 px-0 rounded-[0px] border-b-2 border-transparent! font-bold text-panel-text aria-selected:border-panel-accent! aria-selected:text-panel-accent hover:bg-transparent hover:text-panel-accent-hover focus-visible:[outline:2px_solid] focus-visible:outline-panel-accent focus-visible:[outline-offset:2px]">
								{section.label}
							</Tab>
						))}
					</TabList>
				</div>

				<TabPanels className="mt-3 px-0 md:px-2">
					<TabPanel className="p-0">
						<div className="flex flex-col gap-4 items-stretch w-full max-w-[1200px] mx-auto">
							<ChartBox
								title={t("myaccount.accountOverview")}
							>
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
									<div className="lg:pe-4 pb-3 lg:pb-0 border-b lg:border-b-0 border-panel-border!">
										<div className="flex flex-row items-center gap-2 mb-2">
											<Icon as={ChartBarIcon} aria-hidden="true" className="size-4 text-panel-accent" />
											<p className="text-[0.875rem] font-semibold">
												{usageSectionTitle}
											</p>
										</div>
										<div className="grid grid-cols-3 gap-2">
											<StatsCard
												label={usedLabel}
												value={formatBytes(used, 2)}
											/>
											<StatsCard
												label={remainingLabel}
												value={
													data.data_limit === null
														? t("myaccount.unlimited")
														: formatBytes(remainingData, 2)
												}
											/>
											<StatsCard
												label={totalLabel}
												value={
													data.data_limit === null
														? t("myaccount.unlimited")
														: formatBytes(totalData, 2)
												}
											/>
										</div>
									</div>
									<div className="lg:ps-4 pt-3 lg:pt-0 border-s-0 lg:border-s border-panel-border!">
										<div className="flex flex-row items-center gap-2 mb-2">
											<Icon as={UserGroupIcon} aria-hidden="true" className="size-4 text-panel-accent" />
											<p className="text-[0.875rem] font-semibold">
												{t("myaccount.userLimits")}
											</p>
										</div>
										<div className="grid grid-cols-3 gap-2">
											<StatsCard
												label={t("myaccount.createdUsers")}
												value={`${data.current_users_count}`}
											/>
											<StatsCard
												label={t("myaccount.remainingUsers")}
												value={
													data.users_limit === null
														? t("myaccount.unlimited")
														: `${Math.max(remainingUsers, 0)}`
												}
											/>
											<StatsCard
												label={t("myaccount.totalUsers")}
												value={
													data.users_limit === null
														? t("myaccount.unlimited")
														: `${usersLimit}`
												}
											/>
										</div>
									</div>
								</div>
							</ChartBox>

							{showServiceBalances && (
								<ChartBox
									title={t("myaccount.serviceBalances")}
								>
									{serviceLimits.length ? (
										<>
											<p className={cn("text-[0.875rem] mb-3", labelColor)}>
												{t("myaccount.serviceBalancesHint")}
											</p>
											<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
												{serviceLimits.map((service) => (
													<ServiceBalanceCard
														key={service.service_id}
														service={service}
														t={t}
														expiryText={expiryText}
													/>
												))}
											</div>
										</>
									) : (
										<p className={cn(labelColor)}>{t("noData")}</p>
									)}
								</ChartBox>
							)}

							<div className={cn("grid grid-cols-1 gap-4", isCreatedTrafficBasis || isPerServiceLimits ? "lg:grid-cols-1" : "lg:grid-cols-2")}>
								<div className="min-w-0!">
									<ChartBox title={dailyChartTitle} headerActions={
											<DateRangePicker
												value={range}
												onChange={(next) => setRange(next)}
											/>
										} className="min-h-[500px]">
										<p className={cn("text-[0.875rem] mb-3", labelColor)}>
											{dailyTotalLabel}:{" "}
											<span className="font-semibold">
												{formatBytes(dailyTotal, 2)}
											</span>
										</p>
										{dailySeries[0].data.length ? (
											<ReactApexChart options={buildDailyUsageOptions(
													colorMode,
													dailyCategories,
												)} series={dailySeries as any} type="area" className="h-340" />
										) : (
											<p className={cn(labelColor)}>{t("noData")}</p>
										)}
									</ChartBox>
								</div>
								{!isCreatedTrafficBasis && !isPerServiceLimits && (
									<div className="min-w-0!">
										<ChartBox title={t("myaccount.perNodeUsage")} className="min-h-[500px]">
											<p className={cn("text-[0.875rem] mb-3", labelColor)}>
												{t("myaccount.selectedPeriodNodeUsage")}
												:{" "}
												<span className="font-semibold">
													{formatBytes(perNodeTotal, 2)}
												</span>
											</p>
											{perNodeUsage.length > 0 &&
											donutSeries.some((value: number) => value > 0) ? (
												<ReactApexChart type="donut" options={buildDonutOptions(colorMode, donutLabels)} series={donutSeries} className="h-360" />
											) : (
												<p className={cn(labelColor)}>{t("noData")}</p>
											)}
										</ChartBox>
									</div>
								)}
							</div>

							{isPerServiceLimits && (
								<ChartBox
									title={t("myaccount.serviceTrafficLimits")}
								>
									{serviceLimits.length ? (
										<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
											{serviceLimits.map((service) => (
												<ServiceLimitPanel
													key={service.service_id}
													service={service}
													colorMode={colorMode}
													t={t}
													expiryText={expiryText}
												/>
											))}
										</div>
									) : (
										<p className={cn(labelColor)}>{t("noData")}</p>
									)}
								</ChartBox>
							)}
						</div>
					</TabPanel>

					{canViewSecurity && (
						<TabPanel className="p-0">
							<AccountSecurity
								totpEnabled={Boolean(userData.totp_enabled)}
								canChangePassword={Boolean(
									selfPermissions.self_change_password,
								)}
								canManageSessions={Boolean(selfPermissions.self_sessions)}
								canManage2FA={Boolean(selfPermissions.self_2fa)}
								onChangePassword={modal.onOpen}
							/>
						</TabPanel>
					)}

					{selfPermissions.self_api_keys && (
						<TabPanel className="p-0">
							<div className="flex flex-col gap-2 w-full max-w-[960px] mx-auto">
								<ChartBox
									title={t("myaccount.apiKeys")}
									headerActions={
										<Button size="sm" colorScheme="primary" onClick={apiKeyModal.onOpen} className="h-10">
											{t("myaccount.createApiKey")}
										</Button>
									}
								>
									<p className="text-panel-text-secondary text-[0.875rem] mb-3">
										{t("myaccount.apiKeysHint")}
									</p>
									{apiKeysQuery.isLoading ? (
										<div className="flex justify-center py-6">
											<Spinner size="sm" />
										</div>
									) : apiKeys.length === 0 ? (
										<p className={cn(labelColor)}>{t("myaccount.noApiKeys")}</p>
									) : (
										<div className="flex flex-col gap-0 divide-y divide-panel-border">
											{apiKeys.map((key) => (
												<article key={key.id} className="flex items-center justify-between gap-3 py-2.5">
													<div className="flex flex-row min-w-0! gap-3 items-start">
														<div aria-hidden="true" className="flex items-center justify-center w-9 h-9 shrink-0 rounded-[6px] bg-panel-elevated text-panel-accent">
															<KeyIcon className="w-[18px]" />
														</div>
														<div className="min-w-0!">
															<p className="font-mono font-semibold text-[0.875rem] break-all">
																{key.masked_key ?? "****"}
															</p>
															<div className="flex flex-row items-center gap-2.5 text-panel-text-muted text-[0.75rem] flex-wrap mt-1">
																<p>
																	{t("myaccount.apiKeyCreatedAt")}:{" "}
																	{dayjs(key.created_at).format("YYYY-MM-DD")}
																</p>
																<p>
																	{t("myaccount.apiKeyExpiresAt")}:{" "}
																	{key.expires_at
																		? dayjs(key.expires_at).format("YYYY-MM-DD")
																		: t("myaccount.never")}
																</p>
																<p>
																	{t("myaccount.lastUsed")}:{" "}
																	{key.last_used_at
																		? dayjs(key.last_used_at).format(
																				"YYYY-MM-DD HH:mm",
																			)
																		: t("myaccount.neverUsed")}
																</p>
															</div>
														</div>
													</div>
													<IconButton aria-label={`${t("delete")} ${key.masked_key ?? "API key"}`} size="sm" variant="ghost" colorScheme="red" loading={
															deleteKeyMutation.isPending &&
															deleteKeyMutation.variables?.id === key.id
														} onClick={() => {
															setDeleteKeyId(key.id);
															setDeletePassword("");
															setShowDeletePassword(false);
															deleteModal.onOpen();
														}} >{<DeleteIcon />}</IconButton>
												</article>
											))}
										</div>
									)}
								</ChartBox>
							</div>
						</TabPanel>
					)}
				</TabPanels>
			</Tabs>

			{selfPermissions.self_api_keys && (
				<AppDialog
					open={apiKeyModal.isOpen}
					onClose={closeApiKeyDialog}
					isCentered
					title={t("myaccount.createApiKey")}
					footer={
						hasGeneratedKey ? (
							<Button size="md" colorScheme="primary" onClick={closeApiKeyDialog}>
								{t("close")}
							</Button>
						) : (
							<>
								<Button size="md" variant="ghost" onClick={closeApiKeyDialog} className="mr-3">
									{t("cancel")}
								</Button>
								<Button size="md" colorScheme="primary" loading={createKeyMutation.isPending} onClick={() => createKeyMutation.mutate(selectedLifetime)} disabled={hasGeneratedKey}>
									{t("create")}
								</Button>
							</>
						)
					}
				>
					<div className="flex flex-col gap-4 items-stretch">
						{!hasGeneratedKey && (
							<div>
								<p className="font-medium mb-2">
									{t("myaccount.apiKeyLifetime")}
								</p>
								<Select
									value={selectedLifetime}
									onChange={(e) => setSelectedLifetime(e.target.value)}
								>
									<option value="1m">{t("myaccount.lifetime1m")}</option>
									<option value="3m">{t("myaccount.lifetime3m")}</option>
									<option value="6m">{t("myaccount.lifetime6m")}</option>
									<option value="12m">{t("myaccount.lifetime12m")}</option>
									<option value="forever">
										{t("myaccount.lifetimeForever")}
									</option>
								</Select>
							</div>
						)}
						{hasGeneratedKey && (
							<div>
								<p className="font-medium mb-1">
									{t("myaccount.yourApiKey")}
								</p>
								<div className="flex flex-row items-center gap-2">
									<Input value={generatedKey} readOnly />
									<IconButton variant="solid" size="md" aria-label={t("copy")} onClick={() => {
											setClipboardValue(generatedKey);
											onCopy();
											toast({
												title: t("copied"),
												status: "success",
												duration: 1200,
											});
										}} >{<CopyIcon />}</IconButton>
								</div>
								<p className="text-[0.75rem] text-orange-500 mt-2">
									{t("myaccount.apiKeyWarning")}
								</p>
							</div>
						)}
					</div>
				</AppDialog>
			)}

			<ChangePasswordModal
				open={modal.isOpen}
				onClose={modal.onClose}
				onSubmit={handlePasswordChange}
			/>

			{selfPermissions.self_api_keys && (
				<AppDialog
					open={deleteModal.isOpen}
					onClose={closeDeleteKeyDialog}
					isCentered
					title={t("myaccount.deleteApiKey")}
					footer={
						<>
							<Button size="md" variant="ghost" onClick={closeDeleteKeyDialog} className="mr-3">
								{t("cancel")}
							</Button>
							<Button size="md" colorScheme="red" loading={deleteKeyMutation.isPending} disabled={!deletePassword || deleteKeyId === null} onClick={() => {
									if (deleteKeyId !== null) {
										deleteKeyMutation.mutate({
											id: deleteKeyId,
											current_password: deletePassword,
										});
									}
								}}>
								{t("delete")}
							</Button>
						</>
					}
				>
					<div className="flex flex-col gap-3 items-stretch">
						<p className={cn(labelColor)}>{t("myaccount.deleteApiKeyPrompt")}</p>
						<InputGroup dir={isRTL ? "rtl" : "ltr"}>
							<Input placeholder={t("myaccount.currentPassword")} type={showDeletePassword ? "text" : "password"} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="pe-[2.75rem]" />
							<InputRightElement className="end-[0.5rem] right-auto left-auto">
								<IconButton aria-label={
										showDeletePassword
											? t("admins.hidePassword")
											: t("admins.showPassword")
									} size="sm" variant="ghost" onClick={() => setShowDeletePassword(!showDeletePassword)} >{showDeletePassword ? (
											<EyeSlashIcon className="w-[16px]" />
										) : (
											<EyeIcon className="w-[16px]" />
										)}</IconButton>
							</InputRightElement>
						</InputGroup>
						{deleteKeyMutation.isError && (
							<p className="text-red-500 text-[0.875rem]">
								{t("myaccount.incorrectPassword")}
							</p>
						)}
					</div>
				</AppDialog>
			)}
		</div>
	);
};

export default MyAccountPage;
