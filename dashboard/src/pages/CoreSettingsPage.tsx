import { Tooltip } from "components/shadcn/tooltip";
import { Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel } from "components/shadcn/accordion";
import { FormControl, FormLabel } from "components/shadcn/field";
import { useToast } from "components/shadcn/toast";
import { useDisclosure } from "hooks/useDisclosure";
import { useBreakpointValue } from "hooks/useBreakpointValue";
import { Tag, TagCloseButton, TagLabel } from "components/shadcn/badge";
import { Spinner } from "components/shadcn/feedback";
import { Button, IconButton } from "components/shadcn/button";
import { Radio, RadioGroup, Switch } from "components/shadcn/selection";
import { Input } from "components/shadcn/input";
import { Menu, MenuButton, MenuItem, MenuList } from "components/shadcn/menu";
import { Portal } from "components/shadcn/portal";
import { withClass } from "components/shadcn/icon";
import { cn } from "lib/cn";
import {
	PlusIcon as AddIcon,
	AdjustmentsHorizontalIcon,
	ArrowDownIcon,
	ArrowsPointingInIcon,
	ArrowsPointingOutIcon,
	ArrowsRightLeftIcon,
	ArrowUpIcon,
	ArrowUpTrayIcon,
	BoltIcon,
	CheckCircleIcon,
	ChevronDoubleUpIcon,
	CloudArrowUpIcon,
	TrashIcon as DeleteIcon,
	PencilIcon as EditIcon,
	EllipsisHorizontalIcon,
	GlobeAltIcon,
	ArrowPathIcon as ReloadIcon,
	ScaleIcon,
	WrenchScrewdriverIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import { CompactChips, CompactTextWithCopy } from "components/CompactPopover";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { SearchInput } from "components/common/SearchInput";
import { ConfirmDialog } from "components/dialogs/ConfirmDialog";
import {
	applyXrayPropagation,
	type PropagationOp,
	type PropagationSection,
	propagationKey,
} from "service/xrayPropagation";
import {
	DataTable,
	PageLoadingSkeleton,
	type DataTableBulkAction,
	type DataTableColumn,
	type DataTableRowAction,
	ResourceListCard,
	TabSystem,
} from "components/ui";
import { useCoreSettings } from "contexts/CoreSettingsContext";
import { useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import { isMullvadOutbound } from "utils/mullvad";
import { DEFAULT_SEARCH_MATCH_OPTIONS, matchesSearch } from "utils/searchMatch";
import {
	type FC,
	type ReactNode,
	useCallback,
	useEffect,
	lazy,
	useMemo,
	useRef,
	useState,
	Suspense,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { SiMullvad, SiNordvpn, SiTorproject } from "react-icons/si";
import { useMutation, useQuery } from "react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { fetch as apiFetch, getAPIErrorMessage } from "service/http";
import psiphonIconUrl from "../assets/brands/psiphon.png";
import windscribeIconUrl from "../assets/brands/windscribe.png";
import type { BalancerFormValues } from "../components/BalancerModal";
import { splitMultiValueText } from "../components/common/MultiValueAutocomplete";
import type { PsiphonProxyFormValues } from "../components/PsiphonProxyModal";
import type {
	ReverseFormValues,
	ReverseType,
} from "../components/ReverseModal";
import type { RoutingRule } from "../components/RuleModal";
import type { TorProxyFormValues } from "../components/TorProxyModal";
import type { WindscribeProxyFormValues } from "../components/WindscribeProxyModal";
import {
	canonicalizeRebeccaJson,
	type RebeccaJsonContext,
	stringifyRebeccaJson,
} from "../utils/jsonFormatting";
import { SizeFormatter } from "../utils/outbound";
import { computeOutboundIds } from "../utils/outboundId";
import { sumOutboundTraffic } from "../utils/outboundTraffic";
import { sortByTraffic, type TrafficSortOrder } from "../utils/trafficSort";

const JsonEditor = lazy(async () => ({
	default: (await import("../components/JsonEditor")).JsonEditor,
}));
const BalancerModal = lazy(async () => ({
	default: (await import("../components/BalancerModal")).BalancerModal,
}));
const DnsModal = lazy(async () => ({
	default: (await import("../components/DnsModal")).DnsModal,
}));
const DnsPresetsModal = lazy(async () => ({
	default: (await import("../components/DnsPresetsModal")).DnsPresetsModal,
}));
const FakeDnsModal = lazy(async () => ({
	default: (await import("../components/FakeDnsModal")).FakeDnsModal,
}));
const MullvadModal = lazy(async () => ({
	default: (await import("../components/MullvadModal")).MullvadModal,
}));
const NordVPNModal = lazy(async () => ({
	default: (await import("../components/NordVPNModal")).NordVPNModal,
}));
const OutboundModal = lazy(async () => ({
	default: (await import("../components/OutboundModal")).OutboundModal,
}));
const OutboundSubscriptionsModal = lazy(async () => ({
	default: (await import("../components/OutboundSubscriptionsModal"))
		.OutboundSubscriptionsModal,
}));
const PsiphonProxyModal = lazy(async () => ({
	default: (await import("../components/PsiphonProxyModal")).PsiphonProxyModal,
}));
const ReverseModal = lazy(async () => ({
	default: (await import("../components/ReverseModal")).ReverseModal,
}));
const RuleModal = lazy(async () => ({
	default: (await import("../components/RuleModal")).RuleModal,
}));
const RouteTestModal = lazy(async () => ({
	default: (await import("../components/xray/RouteTestModal")).RouteTestModal,
}));
const TorProxyModal = lazy(async () => ({
	default: (await import("../components/TorProxyModal")).TorProxyModal,
}));
const WarpModal = lazy(async () => ({
	default: (await import("../components/WarpModal")).WarpModal,
}));
const WindscribeProxyModal = lazy(async () => ({
	default: (await import("../components/WindscribeProxyModal"))
		.WindscribeProxyModal,
}));

const AddIconStyled = withClass(AddIcon, "w-3.5 h-3.5");
const DeleteIconStyled = withClass(DeleteIcon, "w-4 h-4");
const EditIconStyled = withClass(EditIcon, "w-4 h-4");
const ArrowUpIconStyled = withClass(ArrowUpIcon, "w-4 h-4");
const ChevronDoubleUpIconStyled = withClass(ChevronDoubleUpIcon, "w-4 h-4");
const ArrowDownIconStyled = withClass(ArrowDownIcon, "w-4 h-4");
const ReloadIconStyled = withClass(ReloadIcon, "w-4 h-4");
const FullScreenIconStyled = withClass(ArrowsPointingOutIcon, "w-4 h-4");
const ExitFullScreenIconStyled = withClass(ArrowsPointingInIcon, "w-4 h-4");
const BasicTabIcon = withClass(AdjustmentsHorizontalIcon, "w-4 h-4");
const RoutingTabIcon = withClass(ArrowsRightLeftIcon, "w-4 h-4");
const OutboundTabIcon = withClass(ArrowUpTrayIcon, "w-4 h-4");
const BalancerTabIcon = withClass(ScaleIcon, "w-4 h-4");
const DnsTabIcon = withClass(GlobeAltIcon, "w-4 h-4");
const AdvancedTabIcon = withClass(WrenchScrewdriverIcon, "w-4 h-4");
const WarpIconStyled = withClass(CloudArrowUpIcon, "w-4 h-4");
const BoltIconStyled = withClass(BoltIcon, "w-4 h-4");
const CheckCircleIconStyled = withClass(CheckCircleIcon, "w-3.5 h-3.5");
const XCircleIconStyled = withClass(XCircleIcon, "w-3.5 h-3.5");
const MoreIconStyled = withClass(EllipsisHorizontalIcon, "w-4 h-4");
const NordVPNIconStyled = () => (
	<span className="inline-flex text-[#4687ff]">
		{SiNordvpn({ size: 16, "aria-hidden": true })}
	</span>
);
const MullvadIconStyled = () => (
	<span className="inline-flex">
		{SiMullvad({ size: 16, "aria-hidden": true })}
	</span>
);
const TorIconStyled: FC<{ size?: number }> = ({ size = 16 }) => (
	<span className="inline-flex text-[#7d4698]">
		{SiTorproject({ size, "aria-hidden": true })}
	</span>
);
const WindscribeIconStyled = () => (
	<img src={windscribeIconUrl} alt="" aria-hidden="true" className="size-4 object-contain" />
);
const PsiphonIconStyled = () => (
	<img src={psiphonIconUrl} alt="" aria-hidden="true" className="size-4 object-contain" />
);
const ManagedOutboundBadge: FC<{ outbound: any }> = ({ outbound }) => {
	const meta = managedOutboundMeta(outbound);
	if (!meta || meta.provider === "tor") return null;
	const providerName =
		meta.provider === "windscribe" ? "Windscribe" : "Psiphon";
	const icon =
		meta.provider === "windscribe" ? (
			<WindscribeIconStyled />
		) : (
			<PsiphonIconStyled />
		);
	return (
		<Tooltip label={
				meta.country
					? `${providerName} - ${meta.country.toUpperCase()}`
					: providerName
			}>
			<div className="flex flex-row items-center gap-1 px-1.5 py-0.5 rounded-xs bg-whiteAlpha-100 shrink-0">
				{icon}
			</div>
		</Tooltip>
	);
};
const compactActionButtonProps = {
	colorScheme: "primary",
	size: "xs" as const,
	variant: "solid" as const,
	fontSize: "xs",
	px: 3,
	h: 7,
};

const serializeConfig = (value: any) => JSON.stringify(value ?? {});
const normalizeSearchValue = (value: unknown): string => {
	if (Array.isArray(value)) return value.map(normalizeSearchValue).join(" ");
	if (value && typeof value === "object") return JSON.stringify(value);
	return String(value ?? "");
};
const formatOutboundEndpoint = (address: unknown, port?: unknown) => {
	const host = String(address ?? "").trim();
	if (!host) return "";
	const portValue = String(port ?? "").trim();
	return portValue ? `${host}:${portValue}` : host;
};
const DNS_STRATEGY_OPTIONS = ["UseSystem", "UseIP", "UseIPv4", "UseIPv6"];
const isNonEmptyArray = (value: unknown) =>
	Array.isArray(value) && value.length > 0;
const isNonEmptyRecord = (value: unknown) =>
	Boolean(
		value &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			Object.keys(value).length > 0,
	);
const isDnsConfigEnabled = (dns: unknown, fakeDnsValue: unknown) => {
	if (isNonEmptyArray(fakeDnsValue)) return true;
	if (!dns || typeof dns !== "object" || Array.isArray(dns)) return false;
	const dnsConfig = dns as Record<string, unknown>;
	return (
		isNonEmptyArray(dnsConfig.servers) || isNonEmptyRecord(dnsConfig.hosts)
	);
};
const createDefaultDnsConfig = () => ({
	servers: [] as any[],
	queryStrategy: "UseIP",
	tag: "dns_inbound",
	enableParallelQuery: false,
});
const DEFAULT_OBSERVATORY = {
	subjectSelector: [] as string[],
	probeURL: "http://www.google.com/gen_204",
	probeInterval: "10m",
	enableConcurrency: true,
};
const DEFAULT_BURST_OBSERVATORY = {
	subjectSelector: [] as string[],
	pingConfig: {
		destination: "http://www.google.com/gen_204",
		interval: "30m",
		connectivity: "http://connectivitycheck.platform.hicloud.com/generate_204",
		timeout: "10s",
		sampling: 2,
	},
};

const SERVICES_OPTIONS: { label: string; value: string }[] = [
	{ label: "Apple", value: "geosite:apple" },
	{ label: "Meta", value: "geosite:meta" },
	{ label: "Google", value: "geosite:google" },
	{ label: "OpenAI", value: "geosite:openai" },
	{ label: "Spotify", value: "geosite:spotify" },
	{ label: "Netflix", value: "geosite:netflix" },
	{ label: "Reddit", value: "geosite:reddit" },
	{ label: "Speedtest", value: "geosite:speedtest" },
];

const XRAY_LOG_DIR_HINT = "/var/lib/rebecca/xray-core";
const DEFAULT_ACCESS_LOG_PATH = `${XRAY_LOG_DIR_HINT}/access.log`;
const DEFAULT_ERROR_LOG_PATH = `${XRAY_LOG_DIR_HINT}/error.log`;
const LOG_CLEANUP_INTERVAL_OPTIONS = [
	{ value: 0, labelKey: "pages.xray.logCleanupDisabled", fallback: "Disabled" },
	{
		value: 3600,
		labelKey: "pages.xray.logCleanup1h",
		fallback: "Every 1 hour",
	},
	{
		value: 10800,
		labelKey: "pages.xray.logCleanup3h",
		fallback: "Every 3 hours",
	},
	{
		value: 21600,
		labelKey: "pages.xray.logCleanup6h",
		fallback: "Every 6 hours",
	},
	{
		value: 86400,
		labelKey: "pages.xray.logCleanup24h",
		fallback: "Every 24 hours",
	},
];

type OutboundJson = Record<string, any>;
type EditableCoreConfig = Record<string, any>;
type OutboundTestType = "latency" | "tcp" | "icmp";
type OutboundTestResult = {
	success: boolean;
	delay?: number;
	error?: string;
	statusCode?: number;
	test_type?: OutboundTestType;
	address?: string;
	port?: number;
	output?: string;
};
type OutboundTestState = {
	testing: boolean;
	result: OutboundTestResult | null;
};

const formatOutboundDelay = (delay?: number) => {
	if (typeof delay !== "number" || !Number.isFinite(delay)) return null;
	return delay >= 0 && delay < 1 ? "<1 ms" : `${delay} ms`;
};
type BalancerConfig = {
	tag: string;
	selector: string[];
	fallbackTag?: string;
	strategy?: { type: string };
};
type BalancerRow = {
	key: number;
	tag: string;
	strategy: string;
	selector: string[];
	fallbackTag: string;
};
type ReverseRow = {
	key: string;
	index: number;
	type: ReverseType;
	tag: string;
	connectionTag: string;
	credentialId: string;
	flow: string;
	targetTag: string;
	inboundTags: string[];
};

type VlessOutboundAccount = {
	address: unknown;
	port: number;
	id: string;
	flow: string;
	encryption: string;
	level?: number;
	email?: string;
	seed?: string;
	testpre?: number;
	testseed?: number[];
};

type ManagedOutboundProvider = "tor" | "windscribe" | "psiphon";

type ManagedOutboundMeta = {
	provider: ManagedOutboundProvider;
	country?: string;
};

const managedOutboundMeta = (outbound: any): ManagedOutboundMeta | null => {
	const metadataProvider = String(outbound?.rebecca_proxy ?? "")
		.trim()
		.toLowerCase();
	if (["tor", "windscribe", "psiphon"].includes(metadataProvider)) {
		return { provider: metadataProvider as ManagedOutboundProvider };
	}
	const tag = String(outbound?.tag ?? "").trim();
	const match = tag.match(
		/(?:^|[-_.])(tor|windscribe|psiphon)(?:-([a-z]{2}))?$/i,
	);
	if (!match) return null;
	return {
		provider: match[1].toLowerCase() as ManagedOutboundProvider,
		country: match[2]?.toLowerCase(),
	};
};

const stringArray = (value: unknown): string[] =>
	Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: typeof value === "string" && value
			? [value]
			: [];

const readVlessOutboundAccount = (outbound: any): VlessOutboundAccount => {
	const settings = outbound?.settings ?? {};
	if (Object.hasOwn(settings, "address") || settings?.reverse) {
		return {
			address: settings.address ?? "",
			port: Number(settings.port) || 0,
			id: String(settings.id ?? ""),
			flow: String(settings.flow ?? ""),
			encryption: String(settings.encryption ?? "none"),
			level: settings.level,
			email: settings.email,
			seed: settings.seed,
			testpre: settings.testpre,
			testseed: settings.testseed,
		};
	}
	const server = Array.isArray(settings.vnext) ? settings.vnext[0] : undefined;
	const user = Array.isArray(server?.users) ? server.users[0] : undefined;
	return {
		address: server?.address ?? "",
		port: Number(server?.port) || 0,
		id: String(user?.id ?? ""),
		flow: String(user?.flow ?? ""),
		encryption: String(user?.encryption ?? "none"),
		level: user?.level,
		email: user?.email,
		seed: user?.seed,
		testpre: user?.testpre,
		testseed: user?.testseed,
	};
};

const isPrivateXrayAddress = (value: unknown) => {
	const host = String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/\.$/, "");
	const octets = host.split(".").map(Number);
	if (
		octets.length === 4 &&
		octets.every(
			(octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
		)
	) {
		const [a, b, c] = octets;
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 0 && (c === 0 || c === 2)) ||
			(a === 192 && b === 88 && c === 99) ||
			(a === 192 && b === 168) ||
			(a === 198 && (b === 18 || b === 19)) ||
			(a === 198 && b === 51 && c === 100) ||
			(a === 203 && b === 0 && c === 113) ||
			a >= 224
		);
	}
	if (host.includes(":")) {
		const first = Number.parseInt(host.split(":")[0] || "0", 16);
		return (
			host === "::" ||
			host === "::1" ||
			(first >= 0xfc00 && first <= 0xfdff) ||
			(first >= 0xfe80 && first <= 0xfebf) ||
			(first >= 0xff00 && first <= 0xffff)
		);
	}
	if (!host.includes(".")) {
		return /^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host);
	}
	return [
		"lan",
		"localdomain",
		"example",
		"invalid",
		"localhost",
		"test",
		"local",
		"home.arpa",
		"internal",
	].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
};

const isSecureVlessConnection = (
	outbound: any,
	account = readVlessOutboundAccount(outbound),
) => {
	const security = String(
		outbound?.streamSettings?.security ?? "none",
	).toLowerCase();
	return (
		(security !== "" && security !== "none") ||
		(account.encryption !== "" && account.encryption !== "none") ||
		isPrivateXrayAddress(account.address)
	);
};

const buildReverseRows = (config: any): ReverseRow[] => {
	const rows: Omit<ReverseRow, "index">[] = [];
	const rules: RoutingRule[] = Array.isArray(config?.routing?.rules)
		? config.routing.rules
		: [];

	for (const outbound of config?.outbounds ?? []) {
		if (String(outbound?.protocol).toLowerCase() !== "vless") continue;
		const tag = String(outbound?.settings?.reverse?.tag ?? "").trim();
		if (!tag) continue;
		const account = readVlessOutboundAccount(outbound);
		const targetRule = rules.find((rule) => {
			const tags = stringArray(rule.inboundTag);
			return tags.length === 1 && tags[0] === tag;
		});
		rows.push({
			key: `internal-${outbound?.tag ?? "vless"}-${tag}`,
			type: "internal",
			tag,
			connectionTag: String(outbound?.tag ?? ""),
			credentialId: account.id,
			flow: account.flow,
			targetTag: String(targetRule?.outboundTag ?? ""),
			inboundTags: [],
		});
	}

	for (const inbound of config?.inbounds ?? []) {
		if (String(inbound?.protocol).toLowerCase() !== "vless") continue;
		for (const client of inbound?.settings?.clients ?? []) {
			const tag = String(client?.reverse?.tag ?? "").trim();
			if (!tag) continue;
			rows.push({
				key: `public-${inbound?.tag ?? "vless"}-${tag}-${client?.id ?? ""}`,
				type: "public",
				tag,
				connectionTag: String(inbound?.tag ?? ""),
				credentialId: String(client?.id ?? ""),
				flow: String(client?.flow ?? ""),
				targetTag: "",
				inboundTags: Array.from(
					new Set(
						rules
							.filter((rule) => rule.outboundTag === tag)
							.flatMap((rule) => stringArray(rule.inboundTag)),
					),
				),
			});
		}
	}

	return rows.map((row, index) => ({ ...row, index }));
};

const removeReverseFromConfig = (config: any, reverse: ReverseRow) => {
	if (reverse.type === "internal") {
		const outbound = (config.outbounds ?? []).find(
			(item: any) => item?.tag === reverse.connectionTag,
		);
		if (outbound?.settings) delete outbound.settings.reverse;
	} else {
		const inbound = (config.inbounds ?? []).find(
			(item: any) => item?.tag === reverse.connectionTag,
		);
		if (inbound?.settings && Array.isArray(inbound.settings.clients)) {
			inbound.settings.clients = inbound.settings.clients.filter(
				(client: any) =>
					client?.reverse?.tag !== reverse.tag ||
					String(client?.id ?? "") !== reverse.credentialId,
			);
		}
	}

	if (Array.isArray(config?.routing?.rules)) {
		config.routing.rules = config.routing.rules.filter((rule: RoutingRule) => {
			if (reverse.type === "public") return rule.outboundTag !== reverse.tag;
			const tags = stringArray(rule.inboundTag);
			return !(tags.length === 1 && tags[0] === reverse.tag);
		});
	}
	delete config.reverse;
};

// UX credit: the compact Xray settings panels and row action flow are
// intentionally inspired by 3x-ui's Xray settings page.
const SettingsSection: FC<{
	title: string;
	children: ReactNode;
	defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = false }) => {
	const headerBg = "bg-gray-50 dark:bg-whiteAlpha-100";
	const panelBg = "bg-white dark:bg-surface-dark";
	const borderColor = "border-gray-200! dark:border-whiteAlpha-300!";
	return (
		<Accordion allowToggle defaultIndex={defaultOpen ? 0 : undefined}>
			<AccordionItem className={cn("border rounded-md overflow-hidden", borderColor, panelBg)}>
				<h2>
					<AccordionButton className={cn("px-3 md:px-4 py-2.5", headerBg)}>
						<div className="flex-1 text-start">
							<p className="font-semibold text-[0.875rem] md:text-[1rem]">
								{title}
							</p>
						</div>
						<AccordionIcon />
					</AccordionButton>
				</h2>
				<AccordionPanel className="p-0">
					<div className="flex flex-col items-stretch gap-0">
						{children}
					</div>
				</AccordionPanel>
			</AccordionItem>
		</Accordion>
	);
};

const SettingRow: FC<{
	label: ReactNode;
	description?: ReactNode;
	controlId: string;
	children: (controlId: string) => ReactNode;
}> = ({ label, description, controlId, children }) => {
	const labelColor = "text-gray-700 dark:text-whiteAlpha-800";
	const descriptionColor = "text-gray-500 dark:text-whiteAlpha-600";
	const dividerColor = "border-t-gray-100! dark:border-t-whiteAlpha-200!";
	return (
		<div className={cn("grid grid-cols-[1fr] md:grid-cols-[minmax(220px,_32%)_1fr] gap-2 md:gap-4 px-3 md:px-4 py-3 border-t first:border-t-0 items-center", dividerColor)}>
			<div className="min-w-0!">
				<FormLabel htmlFor={controlId} className={cn("text-[0.875rem] font-semibold", description ? "mb-1" : "mb-0", labelColor)}>
					{label}
				</FormLabel>
				{description && (
					<p className={cn("text-[0.75rem] leading-[1.45]", descriptionColor)}>
						{description}
					</p>
				)}
			</div>
			<FormControl id={controlId} className="w-full">
				{children(controlId)}
			</FormControl>
		</div>
	);
};

export const CoreSettingsPage: FC = () => {
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const requestedTarget = searchParams.get("target") || "master";
	const { t } = useTranslation();
	const {
		fetchCoreSettings,
		fetchConfigTargets,
		updateConfig,
		config: loadedConfig,
		configTargets,
		isPostLoading,
		restartCore,
		updateConfigTargetMode,
	} = useCoreSettings();
	const config = loadedConfig as EditableCoreConfig | null;
	const { userData, getUserIsSuccess } = useGetUser();
	const onEditingCore = useDashboard((state) => state.onEditingCore);
	const canManageXraySettings =
		getUserIsSuccess && Boolean(userData.permissions?.sections.xray);
	const [selectedTarget, setSelectedTarget] = useState(requestedTarget);
	useEffect(() => setSelectedTarget(requestedTarget), [requestedTarget]);
	const [pendingPropagations, setPendingPropagations] = useState<
		PropagationOp[]
	>([]);
	const [deleteWarning, setDeleteWarning] = useState<{
		description: string;
		onConfirm: () => void;
	} | null>(null);
	const toast = useToast();
	const {
		isOpen: isOutboundOpen,
		onOpen: onOutboundOpen,
		onClose: onOutboundClose,
	} = useDisclosure();
	const {
		isOpen: isRuleOpen,
		onOpen: onRuleOpen,
		onClose: onRuleClose,
	} = useDisclosure();
	const {
		isOpen: isRouteTestOpen,
		onOpen: onRouteTestOpen,
		onClose: onRouteTestClose,
	} = useDisclosure();
	const {
		isOpen: isBalancerOpen,
		onOpen: onBalancerOpen,
		onClose: onBalancerClose,
	} = useDisclosure();
	const {
		isOpen: isReverseOpen,
		onOpen: onReverseOpen,
		onClose: onReverseClose,
	} = useDisclosure();
	const {
		isOpen: isDnsOpen,
		onOpen: onDnsOpen,
		onClose: onDnsClose,
	} = useDisclosure();
	const {
		isOpen: isDnsPresetsOpen,
		onOpen: onDnsPresetsOpen,
		onClose: onDnsPresetsClose,
	} = useDisclosure();
	const {
		isOpen: isFakeDnsOpen,
		onOpen: onFakeDnsOpen,
		onClose: onFakeDnsClose,
	} = useDisclosure();
	const {
		isOpen: isWarpOpen,
		onOpen: onWarpOpen,
		onClose: onWarpClose,
	} = useDisclosure();
	const {
		isOpen: isNordOpen,
		onOpen: onNordOpen,
		onClose: onNordClose,
	} = useDisclosure();
	const {
		isOpen: isMullvadOpen,
		onOpen: onMullvadOpen,
		onClose: onMullvadClose,
	} = useDisclosure();
	// the outbound the Mullvad window opens on; undefined for a new one
	const [mullvadEditTag, setMullvadEditTag] = useState<string>();
	const openMullvad = (tag?: string) => {
		setMullvadEditTag(tag);
		onMullvadOpen();
	};
	const {
		isOpen: isOutboundSubsOpen,
		onOpen: onOutboundSubsOpen,
		onClose: onOutboundSubsClose,
	} = useDisclosure();
	const {
		isOpen: isTorProxyOpen,
		onOpen: onTorProxyOpen,
		onClose: onTorProxyClose,
	} = useDisclosure();
	const {
		isOpen: isWindscribeProxyOpen,
		onOpen: onWindscribeProxyOpen,
		onClose: onWindscribeProxyClose,
	} = useDisclosure();
	const {
		isOpen: isPsiphonProxyOpen,
		onOpen: onPsiphonProxyOpen,
		onClose: onPsiphonProxyClose,
	} = useDisclosure();

	const form = useForm({
		defaultValues: {
			config: config || {
				outbounds: [],
				routing: { rules: [], balancers: [] },
				dns: { servers: [] },
			},
		},
	});
	const initialConfigStringRef = useRef(
		serializeConfig(form.getValues("config")),
	);
	const watchedConfig = useWatch({ control: form.control, name: "config" });
	const hasConfigChanges = useMemo(
		() => serializeConfig(watchedConfig) !== initialConfigStringRef.current,
		[watchedConfig],
	);
	const [dnsEnabledState, setDnsEnabledState] = useState(false);
	const dnsEnabled = dnsEnabledState;

	const [outboundData, setOutboundData] = useState<any[]>([]);
	const [outboundSearch, setOutboundSearch] = useState("");
	const [outboundSearchMatch, setOutboundSearchMatch] = useState(
		DEFAULT_SEARCH_MATCH_OPTIONS,
	);
	const [outboundTrafficSort, setOutboundTrafficSort] =
		useState<TrafficSortOrder>("default");
	const [selectedOutboundIds, setSelectedOutboundIds] = useState<string[]>([]);
	const [outboundTestType, setOutboundTestType] =
		useState<OutboundTestType>("latency");
	const [testingAllOutbounds, setTestingAllOutbounds] = useState(false);
	const [isApplyingTorProxy, setIsApplyingTorProxy] = useState(false);
	const [isApplyingWindscribeProxy, setIsApplyingWindscribeProxy] =
		useState(false);
	const [isApplyingPsiphonProxy, setIsApplyingPsiphonProxy] = useState(false);
	const [routingRuleData, setRoutingRuleData] = useState<any[]>([]);
	const [routingRuleSearch, setRoutingRuleSearch] = useState("");
	const [routingRuleSearchMatch, setRoutingRuleSearchMatch] = useState(
		DEFAULT_SEARCH_MATCH_OPTIONS,
	);
	const [routeTestRule, setRouteTestRule] = useState<RoutingRule | null>(null);
	const [balancersData, setBalancersData] = useState<BalancerRow[]>([]);
	const [dnsServers, setDnsServers] = useState<any[]>([]);
	const [fakeDns, setFakeDns] = useState<any[]>([]);
	const [outboundsTraffic, setOutboundsTraffic] = useState<any[]>([]);
	const [outboundIds, setOutboundIds] = useState<string[]>([]);
	const [outboundReset, setOutboundReset] = useState<{
		index: number;
		scope: "target" | "all";
	} | null>(null);
	const [outboundTestStates, setOutboundTestStates] = useState<
		Record<number, OutboundTestState>
	>({});
	const [outboundHealthStates, setOutboundHealthStates] = useState<
		Record<number, OutboundTestState>
	>({});
	const [subscriptionOutbounds, setSubscriptionOutbounds] = useState<
		OutboundJson[]
	>([]);
	const [subscriptionOutboundTestStates, setSubscriptionOutboundTestStates] =
		useState<Record<string, OutboundTestState>>({});
	const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
	const [editingOutboundIndex, setEditingOutboundIndex] = useState<
		number | null
	>(null);
	const [editingBalancerIndex, setEditingBalancerIndex] = useState<
		number | null
	>(null);
	const [editingReverseIndex, setEditingReverseIndex] = useState<number | null>(
		null,
	);
	const [editingDnsIndex, setEditingDnsIndex] = useState<number | null>(null);
	const [editingFakeDnsIndex, setEditingFakeDnsIndex] = useState<number | null>(
		null,
	);
	const [isFullScreen, setIsFullScreen] = useState(false);
	const [advSettings, setAdvSettings] = useState<string>("xraySetting");
	const [obsSettings, setObsSettings] = useState<string>("");
	const isMobile = useBreakpointValue({ base: true, md: false });
	const [jsonKey, setJsonKey] = useState(0); // force re-render of JsonEditor
	const [advancedJsonValid, setAdvancedJsonValid] = useState(true);
	const [warpOptionValue, setWarpOptionValue] = useState<string>("");
	const [warpCustomDomain, setWarpCustomDomain] = useState<string>("");
	const [activeTab, setActiveTab] = useState<number>(0);
	const { data: serverIPs } = useQuery(
		["server-ips", selectedTarget],
		() =>
			apiFetch<{ ipv4: string; ipv6: string }>("/core/ips", {
				query: { target: selectedTarget },
			}),
		{
			staleTime: 5 * 60 * 1000, // 5 minutes
			enabled: canManageXraySettings && activeTab === 0,
		},
	);
	const [isChangingTargetMode, setIsChangingTargetMode] = useState(false);
	const selectedTargetInfo = useMemo(
		() => configTargets.find((target) => target.id === selectedTarget),
		[configTargets, selectedTarget],
	);
	const isMasterTarget =
		selectedTarget === "master" || selectedTargetInfo?.type === "master";
	const outboundNodeTargetRequiredMessage = t(
		"pages.xray.outbound.testNodeTargetRequired",
	);
	const outboundAddressRequiredMessage = t(
		"pages.xray.outbound.testAddressRequired",
	);
	const outboundTestTypeLabels: Record<OutboundTestType, string> = {
		latency: t("pages.xray.outbound.testTypeLatency"),
		tcp: t("pages.xray.outbound.testTypeTcp"),
		icmp: t("pages.xray.outbound.testTypeIcmp"),
	};
	const outboundTestResultLabel = useCallback((result: OutboundTestResult) => {
		const delayLabel = formatOutboundDelay(result.delay) ?? "-";
		const targetLabel = result.address
			? result.port
				? `${result.address}:${result.port}`
				: result.address
			: "";
		const statusCodeLabel = result.statusCode ? ` (${result.statusCode})` : "";
		return [delayLabel + statusCodeLabel, targetLabel]
			.filter(Boolean)
			.join(" · ");
	}, []);
	const hasNodeTargets = useMemo(
		() => configTargets.some((target) => target.type === "node"),
		[configTargets],
	);
	const tabKeys = useMemo(
		() => [
			"basic",
			"routing",
			"outbounds",
			"reverse",
			"balancers",
			"dns",
			"advanced",
		],
		[],
	);
	const readHashTab = useCallback(
		(hash = window.location.hash) => (hash || "").replace(/^#/, "").toLowerCase(),
		[],
	);

	useEffect(() => {
		const syncFromHash = (hash: string) => {
			const idx = tabKeys.indexOf(readHashTab(hash));
			if (idx >= 0) {
				setActiveTab(idx);
			} else {
				setActiveTab(0);
				window.history.replaceState(
					null,
					"",
					`${window.location.pathname}${window.location.search}#${tabKeys[0]}`,
				);
			}
		};
		syncFromHash(location.hash);
		const onHashChange = () => syncFromHash(window.location.hash);
		window.addEventListener("hashchange", onHashChange);
		return () => window.removeEventListener("hashchange", onHashChange);
	}, [location.hash, readHashTab, tabKeys]);

	const pageShellBg = "bg-white dark:bg-surface-dark";
	const pageShellBorder = "border-gray-200! dark:border-whiteAlpha-300!";
	const pageShellBorderTop = "border-t-gray-200! dark:border-t-whiteAlpha-300!";
	const pageHintColor = "text-gray-600 dark:text-gray-300";

	const buildOutboundRows = useCallback(
		(outbounds: OutboundJson[]) =>
			outbounds.map((outbound, index) => ({
				key: `${index}-${outbound.tag ?? outbound.protocol ?? "outbound"}`,
				...outbound,
			})),
		[],
	);

	const syncOutboundDisplay = useCallback(
		(outbounds: OutboundJson[]) => {
			setOutboundData(buildOutboundRows(outbounds));
		},
		[buildOutboundRows],
	);

	const getOutbounds = useCallback((): OutboundJson[] => {
		const value = form.getValues("config.outbounds");
		if (!Array.isArray(value)) return [];
		return JSON.parse(JSON.stringify(value));
	}, [form]);

	const commitOutbounds = useCallback(
		(outbounds: OutboundJson[]) => {
			form.setValue("config.outbounds", outbounds, { shouldDirty: true });
			syncOutboundDisplay(outbounds);
			setJsonKey((prev) => prev + 1);
		},
		[form, syncOutboundDisplay],
	);

	const buildRoutingRuleRows = useCallback(
		(rules: RoutingRule[]) =>
			rules.map((rule, index) => ({
				key: `${index}-${rule.outboundTag ?? rule.balancerTag ?? "rule"}`,
				source: rule.source ?? [],
				sourcePort: rule.sourcePort ?? [],
				network: rule.network ?? [],
				protocol: rule.protocol ?? [],
				attrs: rule.attrs ? JSON.stringify(rule.attrs, null, 2) : "",
				ip: rule.ip ?? [],
				domain: rule.domain ?? [],
				port: rule.port ?? [],
				inboundTag: rule.inboundTag ?? [],
				user: rule.user ?? [],
				outboundTag: rule.outboundTag ?? "",
				balancerTag: rule.balancerTag ?? "",
				type: rule.type ?? "field",
				domainMatcher: rule.domainMatcher ?? "",
			})),
		[],
	);

	const buildBalancerRows = useCallback(
		(balancers: BalancerConfig[]) =>
			balancers.map((balancer, index) => ({
				key: index,
				tag: balancer.tag || "",
				strategy:
					typeof balancer.strategy === "string"
						? balancer.strategy
						: balancer.strategy?.type || "random",
				selector: balancer.selector || [],
				fallbackTag: balancer.fallbackTag || "",
			})),
		[],
	);

	const syncRoutingRuleDisplay = useCallback(
		(rules: RoutingRule[]) => {
			setRoutingRuleData(buildRoutingRuleRows(rules));
		},
		[buildRoutingRuleRows],
	);

	const commitRoutingRules = useCallback(
		(rules: RoutingRule[]) => {
			form.setValue("config.routing.rules", rules, { shouldDirty: true });
			syncRoutingRuleDisplay(rules);
			setJsonKey((prev) => prev + 1);
		},
		[form, syncRoutingRuleDisplay],
	);

	const getRoutingRules = useCallback((): RoutingRule[] => {
		const rules = form.getValues("config.routing.rules");
		if (Array.isArray(rules)) {
			return JSON.parse(JSON.stringify(rules));
		}
		return [];
	}, [form]);

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullScreen(Boolean(document.fullscreenElement));
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	useEffect(() => {
		if (!configTargets.length) return;
		if (!configTargets.some((target) => target.id === selectedTarget)) {
			setSelectedTarget("master");
		}
	}, [configTargets, selectedTarget]);

	useEffect(() => {
		if (!canManageXraySettings) return;
		fetchConfigTargets().catch((error) => {
			toast({
				title: t("core.errorFetchingConfig"),
				description: error.message,
				status: "error",
				isClosable: true,
				position: "top",
				duration: 3000,
			});
		});
	}, [canManageXraySettings, fetchConfigTargets, toast, t]);

	useEffect(() => {
		if (!canManageXraySettings) {
			onEditingCore(false);
			return;
		}

		onEditingCore(true);
		fetchCoreSettings(selectedTarget).catch((error) => {
			toast({
				title: t("core.errorFetchingConfig"),
				description: error.message,
				status: "error",
				isClosable: true,
				position: "top",
				duration: 3000,
			});
		});
		return () => onEditingCore(false);
	}, [
		canManageXraySettings,
		fetchCoreSettings,
		onEditingCore,
		selectedTarget,
		toast,
		t,
	]);

	useEffect(() => {
		if (config) {
			form.reset({ config });
			initialConfigStringRef.current = serializeConfig(config);
			syncOutboundDisplay((config?.outbounds as OutboundJson[]) || []);
			syncRoutingRuleDisplay((config?.routing?.rules as RoutingRule[]) || []);
			setBalancersData(
				buildBalancerRows(
					(config?.routing?.balancers as BalancerConfig[]) || [],
				),
			);
			setDnsServers(config?.dns?.servers || []);
			setFakeDns(config?.fakedns || []);
			setDnsEnabledState(isDnsConfigEnabled(config?.dns, config?.fakedns));
			// initialize observatory editor selection if present
			setObsSettings(
				config?.observatory
					? "observatory"
					: config?.burstObservatory
						? "burstObservatory"
						: "",
			);
			setJsonKey((prev) => prev + 1); // force JsonEditor re-mount
		}
	}, [
		buildBalancerRows,
		config,
		form,
		syncOutboundDisplay,
		syncRoutingRuleDisplay,
	]);

	useEffect(() => {
		const hasObservatory = Boolean(watchedConfig?.observatory);
		const hasBurstObservatory = Boolean(watchedConfig?.burstObservatory);
		if (obsSettings === "observatory" && !hasObservatory) {
			setObsSettings(hasBurstObservatory ? "burstObservatory" : "");
			return;
		}
		if (obsSettings === "burstObservatory" && !hasBurstObservatory) {
			setObsSettings(hasObservatory ? "observatory" : "");
			return;
		}
		if (!obsSettings) {
			if (hasObservatory) {
				setObsSettings("observatory");
			} else if (hasBurstObservatory) {
				setObsSettings("burstObservatory");
			}
		}
	}, [
		obsSettings,
		watchedConfig?.observatory,
		watchedConfig?.burstObservatory,
	]);

	const { mutate: handleRestartCore, isLoading: isRestarting } = useMutation(
		restartCore,
		{
			onSuccess: () => {
				toast({
					title: t("core.restartSuccess"),
					status: "success",
					isClosable: true,
					position: "top",
					duration: 3000,
				});
			},
			onError: (e: any) => {
				toast({
					title: t("core.generalErrorMessage"),
					description: e.response?.data?.detail || e.message,
					status: "error",
					isClosable: true,
					position: "top",
					duration: 3000,
				});
			},
		},
	);

	const propagationBaseFor = (section: PropagationSection, current: unknown) => {
		if (current == null) return null;
		const pending = pendingPropagations.find(
			(op) =>
				op.source === selectedTarget &&
				op.section === section &&
				propagationKey(op.after) === propagationKey(current),
		);
		return pending ? pending.before : current;
	};

	const queuePropagation = (
		section: PropagationSection,
		current: unknown,
		after: unknown,
		targets: string[],
	) => {
		setPendingPropagations((previous) => {
			const next = [...previous];
			const index =
				current == null
					? -1
					: next.findIndex(
							(op) =>
								op.source === selectedTarget &&
								op.section === section &&
								propagationKey(op.after) === propagationKey(current),
						);
			if (index >= 0) {
				if (targets.length) {
					next[index] = { ...next[index], after, targets };
				} else {
					next.splice(index, 1);
				}
			} else if (targets.length) {
				next.push({
					source: selectedTarget,
					section,
					before: current ?? null,
					after,
					targets,
				});
			}
			return next;
		});
	};

	const applyPendingPropagations = async () => {
		const operations = pendingPropagations.filter(
			(op) => op.source === selectedTarget,
		);
		setPendingPropagations([]);
		const summary = { applied: 0, skipped: 0, failed: 0 };
		for (const operation of operations) {
			try {
				const results = await applyXrayPropagation(operation);
				for (const result of results) {
					if (result.applied) summary.applied += 1;
					else if (result.error) summary.failed += 1;
					else summary.skipped += 1;
				}
			} catch {
				summary.failed += operation.targets.length;
			}
		}
		return summary;
	};

	const countOutboundReferences = (tags: string[]) => {
		const names = tags.filter(Boolean);
		if (!names.length) return 0;
		return (
			getRoutingRules().filter((rule) =>
				names.includes(String(rule.outboundTag ?? "")),
			).length +
			getBalancers().filter((balancer) =>
				balancer.selector.some((tag) => names.includes(tag)),
			).length
		);
	};

	const confirmOutboundRemoval = (tags: unknown[], remove: () => void) => {
		const references = countOutboundReferences(
			tags.map((tag) => String(tag ?? "")),
		);
		if (!references) {
			remove();
			return;
		}
		setDeleteWarning({
			description: t("pages.xray.propagate.deleteOutboundReferenced", {
				count: references,
			}),
			onConfirm: remove,
		});
	};

	const renameOutboundReferences = (oldTag: string, newTag: string) => {
		commitRoutingRules(
			getRoutingRules().map((rule) =>
				rule.outboundTag === oldTag ? { ...rule, outboundTag: newTag } : rule,
			),
		);
		commitBalancers(
			getBalancers().map((balancer) => ({
				...balancer,
				selector: balancer.selector.map((tag) =>
					tag === oldTag ? newTag : tag,
				),
			})),
		);
	};

	const handleOnSave = form.handleSubmit(({ config: submittedConfig }: any) => {
		const nextConfig = JSON.parse(JSON.stringify(submittedConfig || {}));
		if (!dnsEnabledState) {
			delete nextConfig.dns;
			delete nextConfig.fakedns;
		} else if (!nextConfig.dns) {
			nextConfig.dns = createDefaultDnsConfig();
		}
		updateConfig(nextConfig, selectedTarget)
			.then(async () => {
				form.reset({ config: nextConfig });
				initialConfigStringRef.current = serializeConfig(nextConfig);
				setDnsEnabledState(Boolean(nextConfig.dns));
				toast({
					title: t("core.successMessage"),
					status: "success",
					isClosable: true,
					position: "top",
					duration: 3000,
				});
				const summary = await applyPendingPropagations();
				if (summary.applied + summary.skipped + summary.failed > 0) {
					toast({
						title: t("pages.xray.propagate.summary", summary),
						status: summary.failed ? "warning" : "success",
						isClosable: true,
						position: "top",
						duration: 5000,
					});
				}
			})
			.catch((e) => {
				let message = t("core.generalErrorMessage");
				const detail = e?.response?._data?.detail;
				if (typeof detail === "object" && detail !== null)
					message = detail[Object.keys(detail)[0]];
				if (typeof detail === "string") message = detail;
				toast({
					title: message,
					status: "error",
					isClosable: true,
					position: "top",
					duration: 3000,
				});
			});
	});

	const handleTargetModeChange = async (checked: boolean) => {
		if (!selectedTargetInfo?.node_id) {
			return;
		}
		setIsChangingTargetMode(true);
		try {
			await updateConfigTargetMode(
				selectedTargetInfo.node_id,
				checked ? "custom" : "default",
			);
			await fetchConfigTargets();
			await fetchCoreSettings(selectedTarget);
		} catch {
			toast({
				title: t("core.generalErrorMessage"),
				status: "error",
				isClosable: true,
				position: "top",
				duration: 3000,
			});
		} finally {
			setIsChangingTargetMode(false);
		}
	};

	const fetchOutboundsTraffic = useCallback(async () => {
		const response = await apiFetch<{ success: boolean; obj: any }>(
			"/panel/xray/getOutboundsTraffic",
		);
		if (response?.success) {
			setOutboundsTraffic(response.obj);
		}
	}, []);

	const fetchActiveSubscriptionOutbounds = useCallback(async () => {
		const response = await apiFetch<{ success: boolean; obj: OutboundJson[] }>(
			"/panel/xray/outbound-subs/active",
		);
		if (response?.success) {
			setSubscriptionOutbounds(Array.isArray(response.obj) ? response.obj : []);
		}
	}, []);

	const _resetOutboundTraffic = async (
		index: number,
		scope: "target" | "all" = "target",
	) => {
		const payload: Record<string, string | undefined> = {};
		if (index < 0) {
			payload.outbound_id = "-all-";
			payload.tag = "-alltags-";
			if (scope === "target") {
				payload.target_id = selectedTarget;
			}
		} else {
			const outboundId = outboundIds[index];
			if (outboundId) {
				payload.outbound_id = outboundId;
			}
			payload.tag = outboundData[index]?.tag;
			payload.target_id = selectedTarget;
		}
		const cleanedPayload = Object.fromEntries(
			Object.entries(payload).filter(([, value]) => value !== undefined),
		);
		const response = await apiFetch<{ success: boolean }>(
			"/panel/xray/resetOutboundsTraffic",
			{
				method: "POST",
				body: cleanedPayload,
			},
		);
		if (response?.success) {
			await fetchOutboundsTraffic();
		}
	};

	const confirmOutboundTrafficReset = async () => {
		if (!outboundReset) return;
		await _resetOutboundTraffic(outboundReset.index, outboundReset.scope);
		setOutboundReset(null);
	};

	const testOutbound = async (index: number) => {
		const outbounds = getOutbounds();
		const outbound = outbounds[index];
		if (!outbound) {
			toast({
				title: t("pages.xray.outbound.testError"),
				status: "error",
				isClosable: true,
				position: "top",
				duration: 3000,
			});
			return;
		}

		if (isMasterTarget) {
			toast({
				title: outboundNodeTargetRequiredMessage,
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
			return;
		}

		const outboundTag = String(outbound.tag ?? "").trim();
		const protocol = String(outbound.protocol ?? "")
			.trim()
			.toLowerCase();
		if (protocol === "blackhole" || outboundTag.toLowerCase() === "blocked") {
			toast({
				title: t("pages.xray.outbound.testBlocked"),
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 3000,
			});
			return;
		}
		if (
			(outboundTestType === "tcp" || outboundTestType === "icmp") &&
			findOutboundAddress(outbound).length === 0
		) {
			toast({
				title: outboundAddressRequiredMessage,
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
			return;
		}

		setOutboundTestStates((prev) => ({
			...prev,
			[index]: { testing: true, result: null },
		}));

		try {
			const response = await apiFetch<{
				success: boolean;
				obj?: OutboundTestResult;
				msg?: string;
			}>("/panel/xray/testOutbound", {
				method: "POST",
				body: {
					outbound: JSON.stringify(outbound),
					allOutbounds: JSON.stringify(outbounds),
					target_id: selectedTarget,
					test_type: outboundTestType,
				},
			});

			const result = response?.obj;
			if (response?.success && result) {
				setOutboundTestStates((prev) => ({
					...prev,
					[index]: { testing: false, result },
				}));

				if (result.success) {
					toast({
						title: `${t("pages.xray.outbound.testSuccess")}: ${outboundTestResultLabel(result)}`,
						status: "success",
						isClosable: true,
						position: "top",
						duration: 3000,
					});
				} else {
					const errorMessage =
						result.error || t("pages.xray.outbound.testFailed");
					toast({
						title: `${t("pages.xray.outbound.testFailed")}: ${errorMessage}`,
						status: "error",
						isClosable: true,
						position: "top",
						duration: 4000,
					});
				}
				return;
			}

			const message = response?.msg || t("pages.xray.outbound.testError");
			const failureResult: OutboundTestResult = {
				success: false,
				error: message,
			};
			setOutboundTestStates((prev) => ({
				...prev,
				[index]: { testing: false, result: failureResult },
			}));
			toast({
				title: message,
				status: "error",
				isClosable: true,
				position: "top",
				duration: 3000,
			});
		} catch (error: any) {
			const detail =
				error?.response?._data?.detail ??
				error?.data?.detail ??
				error?.message ??
				t("pages.xray.outbound.testError");
			const detailText =
				typeof detail === "string"
					? detail
					: JSON.stringify(detail ?? "Unknown error");

			setOutboundTestStates((prev) => ({
				...prev,
				[index]: {
					testing: false,
					result: {
						success: false,
						error: detailText,
					},
				},
			}));
			toast({
				title: `${t("pages.xray.outbound.testError")}: ${detailText}`,
				status: "error",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
		}
	};

	const checkOutboundHealth = async (index: number) => {
		const outbounds = getOutbounds();
		const outbound = outbounds[index];
		if (!outbound) return;
		if (!managedOutboundMeta(outbound)) {
			toast({
				title: t("pages.xray.outbound.healthSupported"),
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
			return;
		}
		if (isMasterTarget) {
			toast({
				title: outboundNodeTargetRequiredMessage,
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
			return;
		}
		setOutboundHealthStates((prev) => ({
			...prev,
			[index]: { testing: true, result: null },
		}));
		try {
			const response = await apiFetch<{
				success: boolean;
				obj?: OutboundTestResult;
				msg?: string;
			}>("/panel/xray/outboundHealth", {
				method: "POST",
				body: {
					outbound: JSON.stringify(outbound),
					allOutbounds: JSON.stringify(outbounds),
					target_id: selectedTarget,
					test_type: "latency",
				},
			});
			const result = response?.obj ?? {
				success: false,
				error: response?.msg || t("pages.xray.outbound.healthFailed"),
			};
			setOutboundHealthStates((prev) => ({
				...prev,
				[index]: { testing: false, result },
			}));
			toast({
				title: result.success
					? `${t("pages.xray.outbound.healthHealthy")}: ${outboundTestResultLabel(result)}`
					: `${t("pages.xray.outbound.healthFailed")}: ${result.error || t("unknown")}`,
				status: result.success ? "success" : "error",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
		} catch (error: unknown) {
			const detail =
				getAPIErrorMessage(error) || t("pages.xray.outbound.healthFailed");
			const result = { success: false, error: detail };
			setOutboundHealthStates((prev) => ({
				...prev,
				[index]: { testing: false, result },
			}));
			toast({
				title: `${t("pages.xray.outbound.healthFailed")}: ${detail}`,
				status: "error",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
		}
	};

	const handleOutboundModalClose = () => {
		setEditingOutboundIndex(null);
		onOutboundClose();
	};

	const addOutbound = () => {
		setEditingOutboundIndex(null);
		onOutboundOpen();
	};

	const addTorOutbound = async (values: TorProxyFormValues) => {
		setIsApplyingTorProxy(true);
		try {
			const response = await apiFetch<{
				success: boolean;
				obj?: { outbound?: any; outbounds?: any[]; message?: string };
				msg?: string;
			}>("/panel/xray/tor/setup", {
				method: "POST",
				body: {
					target_id: selectedTarget,
					locations: values.locations,
					start_port: values.startPort,
					port_step: values.portStep,
					direction: values.direction,
					tag_prefix: values.tagPrefix.trim(),
					strict: values.strict,
				},
			});
			const generatedOutbounds = response?.obj?.outbounds?.length
				? response.obj.outbounds
				: response?.obj?.outbound
					? [response.obj.outbound]
					: [];
			if (!response?.success || generatedOutbounds.length === 0) {
				throw new Error(response?.msg || t("pages.xray.tor.failed"));
			}
			const outbounds = getOutbounds();
			const duplicate = generatedOutbounds.find((outbound) =>
				outbounds.some(
					(item: any) => String(item?.tag ?? "") === String(outbound.tag ?? ""),
				),
			);
			if (duplicate) {
				throw new Error(
					t("pages.xray.outbound.tagExistsNamed", {
						tag: String(duplicate.tag ?? ""),
					}),
				);
			}
			for (const outbound of generatedOutbounds) {
				outbounds.push(outbound);
			}
			commitOutbounds(outbounds);
			onTorProxyClose();
			toast({
				title: response.obj?.message || t("pages.xray.tor.added"),
				status: "success",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
		} catch (error: any) {
			const detail =
				error?.response?._data?.detail ??
				error?.data?.detail ??
				error?.message ??
				t("pages.xray.tor.failed");
			toast({
				title: typeof detail === "string" ? detail : JSON.stringify(detail),
				status: "error",
				isClosable: true,
				position: "top",
				duration: 5000,
			});
		} finally {
			setIsApplyingTorProxy(false);
		}
	};

	const addWindscribeOutbound = async (values: WindscribeProxyFormValues) => {
		setIsApplyingWindscribeProxy(true);
		try {
			const location = values.location.split(",")[0]?.trim().toLowerCase();
			const response = await apiFetch<{
				success: boolean;
				obj?: { outbound?: any; message?: string };
				msg?: string;
			}>("/panel/xray/windscribe/setup", {
				method: "POST",
				body: {
					target_id: selectedTarget,
					location,
					port: values.port,
					tag: values.tag.trim(),
				},
			});
			const outbound = response?.obj?.outbound;
			if (!response?.success || !outbound) {
				throw new Error(response?.msg || t("pages.xray.windscribe.failed"));
			}
			const outbounds = getOutbounds();
			const existingIndex = outbounds.findIndex(
				(item: any) => String(item?.tag ?? "") === String(outbound.tag ?? ""),
			);
			if (existingIndex >= 0) {
				outbounds[existingIndex] = outbound;
			} else {
				outbounds.push(outbound);
			}
			commitOutbounds(outbounds);
			onWindscribeProxyClose();
			toast({
				title: response.obj?.message || t("pages.xray.windscribe.added"),
				status: "success",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
		} catch (error: any) {
			const detail =
				error?.response?._data?.detail ??
				error?.data?.detail ??
				error?.message ??
				t("pages.xray.windscribe.failed");
			toast({
				title: typeof detail === "string" ? detail : JSON.stringify(detail),
				status: "error",
				isClosable: true,
				position: "top",
				duration: 5000,
			});
		} finally {
			setIsApplyingWindscribeProxy(false);
		}
	};

	const addPsiphonOutbounds = async (values: PsiphonProxyFormValues) => {
		setIsApplyingPsiphonProxy(true);
		try {
			const locations = splitMultiValueText(values.locations)
				.map((location) => location.trim().toLowerCase())
				.filter(Boolean);
			const response = await apiFetch<{
				success: boolean;
				obj?: { outbounds?: any[]; message?: string };
				msg?: string;
			}>("/panel/xray/psiphon/setup", {
				method: "POST",
				body: {
					target_id: selectedTarget,
					config: values.config,
					locations,
					port: values.port,
					tag: values.tag.trim(),
				},
			});
			const generatedOutbounds = response?.obj?.outbounds ?? [];
			if (!response?.success || generatedOutbounds.length === 0) {
				throw new Error(response?.msg || t("pages.xray.psiphon.failed"));
			}
			const outbounds = getOutbounds();
			for (const outbound of generatedOutbounds) {
				const existingIndex = outbounds.findIndex(
					(item: any) =>
						String(item?.tag ?? "") === String(outbound?.tag ?? ""),
				);
				if (existingIndex >= 0) outbounds[existingIndex] = outbound;
				else outbounds.push(outbound);
			}
			commitOutbounds(outbounds);
			onPsiphonProxyClose();
			toast({
				title: response.obj?.message || t("pages.xray.psiphon.added"),
				status: "success",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
		} catch (error: any) {
			const detail =
				error?.response?._data?.detail ??
				error?.data?.detail ??
				error?.message ??
				t("pages.xray.psiphon.failed");
			toast({
				title: typeof detail === "string" ? detail : JSON.stringify(detail),
				status: "error",
				isClosable: true,
				position: "top",
				duration: 5000,
			});
		} finally {
			setIsApplyingPsiphonProxy(false);
		}
	};

	const editOutbound = (index: number) => {
		setEditingOutboundIndex(index);
		onOutboundOpen();
	};

	const deleteOutbound = (index: number) => {
		const outbounds = getOutbounds();
		if (index < 0 || index >= outbounds.length) return;
		confirmOutboundRemoval([outbounds[index]?.tag], () => {
			const current = getOutbounds();
			current.splice(index, 1);
			commitOutbounds(current);
			setSelectedOutboundIds((selected) =>
				selected.filter((id) => Number(id) !== index),
			);
		});
	};

	const deleteSelectedOutbounds = (ids: string[]) => {
		const indexes = ids
			.map((id) => Number(id))
			.filter((index) => Number.isInteger(index) && index >= 0)
			.sort((a, b) => b - a);
		if (!indexes.length) return;
		const outbounds = getOutbounds();
		confirmOutboundRemoval(
			indexes.map((index) => outbounds[index]?.tag),
			() => {
				const current = getOutbounds();
				for (const index of indexes) {
					if (index >= 0 && index < current.length) {
						current.splice(index, 1);
					}
				}
				commitOutbounds(current);
				setSelectedOutboundIds([]);
			},
		);
	};

	const moveOutbound = (fromIndex: number, toIndex: number) => {
		const outbounds = getOutbounds();
		if (
			fromIndex < 0 ||
			fromIndex >= outbounds.length ||
			toIndex < 0 ||
			toIndex >= outbounds.length
		) {
			return;
		}
		const [moved] = outbounds.splice(fromIndex, 1);
		outbounds.splice(toIndex, 0, moved);
		commitOutbounds(outbounds);
	};

	const moveOutboundUp = (index: number) => {
		moveOutbound(index, index - 1);
	};

	const moveOutboundToTop = (index: number) => {
		moveOutbound(index, 0);
	};

	const moveOutboundDown = (index: number) => {
		moveOutbound(index, index + 1);
	};

	const filteredRoutingRules = useMemo(() => {
		const rows = routingRuleData.map((rule, originalIndex) => ({
			rule,
			originalIndex,
		}));
		if (!routingRuleSearch.trim()) return rows;
		return rows.filter(({ rule }) => {
			const haystack = [
				rule.source,
				rule.sourcePort,
				rule.network,
				rule.protocol,
				rule.attrs,
				rule.ip,
				rule.domain,
				rule.port,
				rule.inboundTag,
				rule.user,
				rule.outboundTag,
				rule.balancerTag,
			]
				.map(normalizeSearchValue)
				.join(" ");
			return matchesSearch(haystack, routingRuleSearch, routingRuleSearchMatch);
		});
	}, [routingRuleData, routingRuleSearch, routingRuleSearchMatch]);

	const filteredOutboundData = useMemo(() => {
		const rows = outboundData.map((outbound, originalIndex) => ({
			outbound,
			originalIndex,
		}));
		const matches = outboundSearch.trim()
			? rows.filter(({ outbound }) =>
					matchesSearch(
						JSON.stringify(outbound),
						outboundSearch,
						outboundSearchMatch,
					),
				)
			: rows;
		return sortByTraffic(
			matches,
			outboundTrafficSort,
			({ outbound, originalIndex }) => {
				const traffic = sumOutboundTraffic(
					outboundsTraffic,
					selectedTarget,
					outboundIds[originalIndex],
					outbound.tag,
					isMasterTarget,
				);
				return traffic.up + traffic.down;
			},
		);
	}, [
		outboundData,
		outboundIds,
		outboundSearch,
		outboundSearchMatch,
		outboundTrafficSort,
		outboundsTraffic,
		selectedTarget,
		isMasterTarget,
	]);
	const managedOutboundData = useMemo(
		() =>
			filteredOutboundData.filter(({ outbound }) =>
				managedOutboundMeta(outbound),
			),
		[filteredOutboundData],
	);
	const standardOutboundData = useMemo(
		() =>
			filteredOutboundData.filter(
				({ outbound }) => !managedOutboundMeta(outbound),
			),
		[filteredOutboundData],
	);
	const managedOutboundTotal = useMemo(
		() =>
			outboundData.filter((outbound) => managedOutboundMeta(outbound)).length,
		[outboundData],
	);

	const addRule = () => {
		setEditingRuleIndex(null);
		onRuleOpen();
	};

	const editRule = (index: number) => {
		setEditingRuleIndex(index);
		onRuleOpen();
	};

	const deleteRule = (index: number) => {
		const currentRules = getRoutingRules();
		currentRules.splice(index, 1);
		commitRoutingRules(currentRules);
	};

	const replaceRule = (oldIndex: number, newIndex: number) => {
		const currentRules = getRoutingRules();
		if (
			oldIndex < 0 ||
			oldIndex >= currentRules.length ||
			newIndex < 0 ||
			newIndex >= currentRules.length
		) {
			return;
		}
		const [moved] = currentRules.splice(oldIndex, 1);
		currentRules.splice(newIndex, 0, moved);
		commitRoutingRules(currentRules);
	};

	const handleRuleModalSubmit = (rule: RoutingRule, targetIds: string[]) => {
		const currentRules = getRoutingRules();
		queuePropagation(
			"routing.rules",
			editingRuleIndex !== null ? (canonicalRoutingRules[editingRuleIndex] ?? null) : null,
			rule,
			targetIds,
		);
		if (
			editingRuleIndex !== null &&
			editingRuleIndex >= 0 &&
			editingRuleIndex < currentRules.length
		) {
			currentRules[editingRuleIndex] = rule;
		} else {
			currentRules.push(rule);
		}
		commitRoutingRules(currentRules);
		setEditingRuleIndex(null);
	};

	const handleRuleModalClose = () => {
		setEditingRuleIndex(null);
		onRuleClose();
	};

	const getBalancers = useCallback((): BalancerConfig[] => {
		const balancers = form.getValues("config.routing.balancers");
		if (Array.isArray(balancers)) {
			return JSON.parse(JSON.stringify(balancers));
		}
		return [];
	}, [form]);

	const applyObservatorySelectors = useCallback(
		(cfg: any, balancers: BalancerConfig[]) => {
			const nextConfig = { ...cfg };
			const getStrategy = (balancer: BalancerConfig) => {
				if (typeof balancer.strategy === "string") {
					return balancer.strategy;
				}
				return balancer.strategy?.type || "random";
			};
			const collectSelectors = (items: BalancerConfig[]) => {
				const selectorSet = new Set<string>();
				items.forEach((balancer) => {
					(balancer.selector || []).forEach((selector) => {
						if (selector) selectorSet.add(selector);
					});
				});
				return Array.from(selectorSet);
			};
			const leastPings = balancers.filter(
				(balancer) => getStrategy(balancer) === "leastPing",
			);
			const leastLoads = balancers.filter((balancer) =>
				["leastLoad", "roundRobin", "random"].includes(getStrategy(balancer)),
			);

			if (leastPings.length > 0) {
				const observatory = nextConfig.observatory
					? { ...nextConfig.observatory }
					: { ...DEFAULT_OBSERVATORY };
				observatory.subjectSelector = collectSelectors(leastPings);
				nextConfig.observatory = observatory;
			} else {
				delete nextConfig.observatory;
			}

			if (leastLoads.length > 0) {
				const burstObservatory = nextConfig.burstObservatory
					? { ...nextConfig.burstObservatory }
					: { ...DEFAULT_BURST_OBSERVATORY };
				burstObservatory.subjectSelector = collectSelectors(leastLoads);
				nextConfig.burstObservatory = burstObservatory;
			} else {
				delete nextConfig.burstObservatory;
			}

			return nextConfig;
		},
		[],
	);

	const normalizeBalancerConfig = useCallback((balancer: BalancerConfig) => {
		const strategyType =
			typeof balancer.strategy === "string"
				? balancer.strategy
				: balancer.strategy?.type;
		const normalized: BalancerConfig = {
			tag: balancer.tag ?? "",
			selector: balancer.selector ?? [],
			fallbackTag: balancer.fallbackTag ?? "",
		};
		if (strategyType && strategyType !== "random") {
			normalized.strategy = { type: strategyType };
		}
		return normalized;
	}, []);

	const commitBalancers = useCallback(
		(
			balancers: BalancerConfig[],
			options?: { oldTag?: string; newTag?: string },
		) => {
			const normalizedBalancers = balancers.map(normalizeBalancerConfig);
			const cfg = { ...(form.getValues("config") || {}) };
			if (!cfg.routing) cfg.routing = {};
			if (normalizedBalancers.length > 0) {
				cfg.routing.balancers = normalizedBalancers;
			} else {
				delete cfg.routing.balancers;
			}
			let updatedRules: RoutingRule[] | undefined;
			if (
				options?.oldTag &&
				options?.newTag &&
				options.oldTag !== options.newTag
			) {
				updatedRules = (cfg.routing.rules || []).map((rule: any) => {
					if (rule?.balancerTag === options.oldTag) {
						return { ...rule, balancerTag: options.newTag };
					}
					return rule;
				});
				cfg.routing.rules = updatedRules;
			}
			const updatedConfig = applyObservatorySelectors(cfg, normalizedBalancers);
			form.setValue("config", updatedConfig, { shouldDirty: true });
			setBalancersData(buildBalancerRows(normalizedBalancers));
			if (updatedRules) {
				syncRoutingRuleDisplay(updatedRules);
			}
			setJsonKey((prev) => prev + 1);
		},
		[
			applyObservatorySelectors,
			buildBalancerRows,
			form,
			normalizeBalancerConfig,
			syncRoutingRuleDisplay,
		],
	);

	const toBalancerConfig = useCallback(
		(values: BalancerFormValues): BalancerConfig => {
			const base: BalancerConfig = {
				tag: values.tag.trim(),
				selector: values.selector.map((item) => item.trim()).filter(Boolean),
				fallbackTag: values.fallbackTag ?? "",
			};
			if (values.strategy && values.strategy !== "random") {
				base.strategy = { type: values.strategy };
			}
			return base;
		},
		[],
	);

	const handleBalancerSubmit = (
		values: BalancerFormValues,
		targetIds: string[],
	) => {
		const balancers = getBalancers();
		const nextBalancer = toBalancerConfig(values);
		let oldTag: string | undefined;
		const previous =
			editingBalancerIndex !== null &&
			editingBalancerIndex >= 0 &&
			editingBalancerIndex < balancers.length
				? balancers[editingBalancerIndex]
				: undefined;
		queuePropagation("balancers", previous ?? null, nextBalancer, targetIds);
		if (
			editingBalancerIndex !== null &&
			editingBalancerIndex >= 0 &&
			editingBalancerIndex < balancers.length
		) {
			oldTag = balancers[editingBalancerIndex]?.tag;
			balancers[editingBalancerIndex] = nextBalancer;
		} else {
			balancers.push(nextBalancer);
		}
		commitBalancers(balancers, { oldTag, newTag: nextBalancer.tag });
		setEditingBalancerIndex(null);
		onBalancerClose();
	};

	const addBalancer = () => {
		setEditingBalancerIndex(null);
		onBalancerOpen();
	};

	const editBalancer = (index: number) => {
		setEditingBalancerIndex(index);
		onBalancerOpen();
	};

	const handleBalancerModalClose = () => {
		setEditingBalancerIndex(null);
		onBalancerClose();
	};

	const deleteBalancer = (index: number) => {
		const balancers = getBalancers();
		if (index < 0 || index >= balancers.length) return;
		const tag = balancers[index].tag;
		const removeBalancer = () => {
			const current = getBalancers();
			current.splice(index, 1);
			commitBalancers(current);
		};
		const references = tag
			? getRoutingRules().filter((rule) => rule.balancerTag === tag).length
			: 0;
		if (!references) {
			removeBalancer();
			return;
		}
		setDeleteWarning({
			description: t("pages.xray.propagate.deleteBalancerReferenced", {
				count: references,
			}),
			onConfirm: removeBalancer,
		});
	};

	const addReverse = () => {
		setEditingReverseIndex(null);
		onReverseOpen();
	};

	const editReverse = (index: number) => {
		setEditingReverseIndex(index);
		onReverseOpen();
	};

	const handleReverseModalClose = () => {
		setEditingReverseIndex(null);
		onReverseClose();
	};

	const handleReverseSubmit = (reverse: ReverseFormValues) => {
		const cfg = JSON.parse(JSON.stringify(form.getValues("config") || {}));
		if (!cfg.routing) cfg.routing = {};
		if (!Array.isArray(cfg.routing.rules)) cfg.routing.rules = [];

		const oldReverse =
			editingReverseIndex !== null ? reverseData[editingReverseIndex] : null;
		let previousPublicClient: any;
		let previousReverseSettings: Record<string, unknown> = {};
		if (oldReverse?.type === "internal") {
			const oldOutbound = (cfg.outbounds ?? []).find(
				(item: any) => item?.tag === oldReverse.connectionTag,
			);
			previousReverseSettings = oldOutbound?.settings?.reverse ?? {};
		} else if (oldReverse?.type === "public") {
			const oldInbound = (cfg.inbounds ?? []).find(
				(item: any) => item?.tag === oldReverse.connectionTag,
			);
			previousPublicClient = (oldInbound?.settings?.clients ?? []).find(
				(client: any) =>
					client?.reverse?.tag === oldReverse.tag &&
					String(client?.id ?? "") === oldReverse.credentialId,
			);
			previousReverseSettings = previousPublicClient?.reverse ?? {};
		}
		const oldRuleIndex = oldReverse
			? cfg.routing.rules.findIndex((rule: RoutingRule) => {
					if (oldReverse.type === "public") {
						return rule.outboundTag === oldReverse.tag;
					}
					const tags = stringArray(rule.inboundTag);
					return tags.length === 1 && tags[0] === oldReverse.tag;
				})
			: -1;
		if (oldReverse) removeReverseFromConfig(cfg, oldReverse);

		let nextRule: RoutingRule;
		if (reverse.type === "internal") {
			const outbound = (cfg.outbounds ?? []).find(
				(item: any) =>
					item?.tag === reverse.interconnectionOutboundTag &&
					String(item?.protocol).toLowerCase() === "vless",
			);
			const account = readVlessOutboundAccount(outbound);
			if (!outbound || !account.address || !account.port || !account.id) {
				toast({
					title: t("pages.xray.reverse.vlessOutboundInvalid"),
					status: "error",
					isClosable: true,
					position: "top",
					duration: 4000,
				});
				return;
			}
			if (!isSecureVlessConnection(outbound, account)) {
				toast({
					title: t("pages.xray.reverse.transportSecurityRequired"),
					status: "error",
					isClosable: true,
					position: "top",
					duration: 5000,
				});
				return;
			}
			outbound.settings = {
				address: account.address,
				port: account.port,
				id: account.id,
				encryption: account.encryption || "none",
				flow: account.flow || undefined,
				level: account.level || undefined,
				email: account.email || undefined,
				seed: account.seed || undefined,
				testpre: account.testpre || undefined,
				testseed: account.testseed?.length ? account.testseed : undefined,
				reverse: { ...previousReverseSettings, tag: reverse.tag },
			};
			nextRule = {
				type: "field",
				inboundTag: [reverse.tag],
				outboundTag: reverse.outboundTag,
			};
		} else {
			const inbound = (cfg.inbounds ?? []).find(
				(item: any) =>
					item?.tag === reverse.interconnectionInboundTag &&
					String(item?.protocol).toLowerCase() === "vless",
			);
			if (!inbound) {
				toast({
					title: t("pages.xray.reverse.vlessInboundInvalid"),
					status: "error",
					isClosable: true,
					position: "top",
					duration: 4000,
				});
				return;
			}
			if (!inbound.settings) inbound.settings = {};
			if (!Array.isArray(inbound.settings.clients)) {
				inbound.settings.clients = [];
			}
			inbound.settings.clients.push({
				...previousPublicClient,
				id: reverse.credentialId,
				email: previousPublicClient?.email || `reverse.${reverse.tag}`,
				flow: reverse.flow || undefined,
				reverse: { ...previousReverseSettings, tag: reverse.tag },
			});
			nextRule = {
				type: "field",
				inboundTag: reverse.inboundTags,
				outboundTag: reverse.tag,
			};
		}

		const insertAt =
			oldRuleIndex >= 0
				? Math.min(oldRuleIndex, cfg.routing.rules.length)
				: cfg.routing.rules.length;
		cfg.routing.rules.splice(insertAt, 0, nextRule);
		delete cfg.reverse;
		form.setValue("config", cfg, { shouldDirty: true });
		syncRoutingRuleDisplay(cfg.routing.rules);
		setJsonKey((prev) => prev + 1);
		handleReverseModalClose();
	};

	const deleteReverse = (index: number) => {
		const reverse = reverseData[index];
		if (!reverse) return;
		const cfg = JSON.parse(JSON.stringify(form.getValues("config") || {}));
		if (!cfg.routing) cfg.routing = {};
		if (!Array.isArray(cfg.routing.rules)) cfg.routing.rules = [];
		removeReverseFromConfig(cfg, reverse);
		form.setValue("config", cfg, { shouldDirty: true });
		syncRoutingRuleDisplay(cfg.routing.rules);
		setJsonKey((prev) => prev + 1);
	};

	const addDnsServer = () => {
		setEditingDnsIndex(null);
		onDnsOpen();
	};

	const editDnsServer = (index: number) => {
		setEditingDnsIndex(index);
		onDnsOpen();
	};

	const handleDnsModalClose = () => {
		setEditingDnsIndex(null);
		onDnsClose();
	};

	const deleteDnsServer = (index: number) => {
		const newDnsServers = [...dnsServers];
		newDnsServers.splice(index, 1);
		form.setValue("config.dns.servers", newDnsServers, { shouldDirty: true });
		setDnsServers(newDnsServers);
	};

	const applyDnsPreset = (servers: string[]) => {
		const currentConfig = form.getValues("config");
		const nextConfig = { ...currentConfig };
		const dnsConfig = nextConfig.dns
			? { ...nextConfig.dns }
			: createDefaultDnsConfig();
		dnsConfig.servers = [...servers];
		nextConfig.dns = dnsConfig;
		form.setValue("config", nextConfig, { shouldDirty: true });
		setDnsServers(dnsConfig.servers);
		setDnsEnabledState(true);
	};

	const addFakeDns = () => {
		setEditingFakeDnsIndex(null);
		onFakeDnsOpen();
	};

	const editFakeDns = (index: number) => {
		setEditingFakeDnsIndex(index);
		onFakeDnsOpen();
	};

	const handleFakeDnsModalClose = () => {
		setEditingFakeDnsIndex(null);
		onFakeDnsClose();
	};

	const deleteFakeDns = (index: number) => {
		const newFakeDns = [...fakeDns];
		newFakeDns.splice(index, 1);
		form.setValue("config.fakedns", newFakeDns.length > 0 ? newFakeDns : null, {
			shouldDirty: true,
		});
		setFakeDns(newFakeDns);
	};

	const findOutboundAddress = (outbound: any) => {
		switch (outbound.protocol) {
			case "vmess":
				return (
					outbound.settings.vnext?.map((obj: any) =>
						formatOutboundEndpoint(obj.address, obj.port),
					) || []
				).filter(Boolean);
			case "vless":
				if (outbound.settings?.address) {
					return [
						formatOutboundEndpoint(
							outbound.settings.address,
							outbound.settings.port,
						),
					].filter(Boolean);
				}
				return (
					outbound.settings.vnext?.map((obj: any) =>
						formatOutboundEndpoint(obj.address, obj.port),
					) || []
				).filter(Boolean);
			case "http":
			case "socks":
			case "shadowsocks":
			case "trojan":
				return (
					outbound.settings.servers?.map((obj: any) =>
						formatOutboundEndpoint(obj.address, obj.port),
					) || []
				).filter(Boolean);
			case "dns":
				return [
					formatOutboundEndpoint(
						outbound.settings?.address,
						outbound.settings?.port,
					),
				].filter(Boolean);
			case "wireguard":
				return (
					outbound.settings.peers?.map((peer: any) =>
						String(peer.endpoint ?? "").trim(),
					) || []
				).filter(Boolean);
			default:
				return [];
		}
	};

	const testSubscriptionOutbound = async (
		outbound: OutboundJson,
		index: number,
	) => {
		const stateKey = String(outbound.tag ?? `subscription-${index}`);
		if (!outbound) return;
		if (isMasterTarget) {
			toast({
				title: outboundNodeTargetRequiredMessage,
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
			return;
		}
		const outboundTag = String(outbound.tag ?? "").trim();
		const protocol = String(outbound.protocol ?? "")
			.trim()
			.toLowerCase();
		if (protocol === "blackhole" || outboundTag.toLowerCase() === "blocked") {
			toast({
				title: t("pages.xray.outbound.testBlocked"),
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 3000,
			});
			return;
		}
		if (
			(outboundTestType === "tcp" || outboundTestType === "icmp") &&
			findOutboundAddress(outbound).length === 0
		) {
			toast({
				title: outboundAddressRequiredMessage,
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
			return;
		}
		setSubscriptionOutboundTestStates((prev) => ({
			...prev,
			[stateKey]: { testing: true, result: null },
		}));
		try {
			const allOutbounds = [...getOutbounds(), ...subscriptionOutbounds];
			const response = await apiFetch<{
				success: boolean;
				obj?: OutboundTestResult;
				msg?: string;
			}>("/panel/xray/testOutbound", {
				method: "POST",
				body: {
					outbound: JSON.stringify(outbound),
					allOutbounds: JSON.stringify(allOutbounds),
					target_id: selectedTarget,
					test_type: outboundTestType,
				},
			});
			const result = response?.obj;
			if (response?.success && result) {
				setSubscriptionOutboundTestStates((prev) => ({
					...prev,
					[stateKey]: { testing: false, result },
				}));
				return;
			}
			setSubscriptionOutboundTestStates((prev) => ({
				...prev,
				[stateKey]: {
					testing: false,
					result: {
						success: false,
						error: response?.msg || t("pages.xray.outbound.testError"),
					},
				},
			}));
		} catch (error: any) {
			const detail =
				error?.response?._data?.detail ??
				error?.data?.detail ??
				error?.message ??
				t("pages.xray.outbound.testError");
			setSubscriptionOutboundTestStates((prev) => ({
				...prev,
				[stateKey]: {
					testing: false,
					result: {
						success: false,
						error:
							typeof detail === "string"
								? detail
								: JSON.stringify(detail ?? "Unknown error"),
					},
				},
			}));
		}
	};

	const testAllOutbounds = async () => {
		if (testingAllOutbounds) return;
		if (isMasterTarget) {
			toast({
				title: outboundNodeTargetRequiredMessage,
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
			return;
		}
		type TestItem =
			| { kind: "template"; index: number; outbound: OutboundJson }
			| {
					kind: "subscription";
					index: number;
					stateKey: string;
					outbound: OutboundJson;
			  };
		const templateItems = getOutbounds().map((outbound, index) => ({
			kind: "template" as const,
			index,
			outbound,
		}));
		const subscriptionItems = subscriptionOutbounds.map((outbound, index) => ({
			kind: "subscription" as const,
			index,
			stateKey: String(outbound.tag ?? `subscription-${index}`),
			outbound,
		}));
		const items: TestItem[] = [...templateItems, ...subscriptionItems].filter(
			(item) => {
				const tag = String(item.outbound.tag ?? "")
					.trim()
					.toLowerCase();
				const protocol = String(item.outbound.protocol ?? "")
					.trim()
					.toLowerCase();
				if (protocol === "blackhole" || tag === "blocked") return false;
				if (
					(outboundTestType === "tcp" || outboundTestType === "icmp") &&
					findOutboundAddress(item.outbound).length === 0
				) {
					return false;
				}
				return true;
			},
		);
		if (items.length === 0) {
			toast({
				title:
					outboundTestType === "tcp" || outboundTestType === "icmp"
						? outboundAddressRequiredMessage
						: t("pages.xray.outbound.testNothing"),
				status: "warning",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
			return;
		}
		setTestingAllOutbounds(true);
		setOutboundTestStates((prev) => {
			const next = { ...prev };
			for (const item of items) {
				if (item.kind === "template") {
					next[item.index] = { testing: true, result: null };
				}
			}
			return next;
		});
		setSubscriptionOutboundTestStates((prev) => {
			const next = { ...prev };
			for (const item of items) {
				if (item.kind === "subscription") {
					next[item.stateKey] = { testing: true, result: null };
				}
			}
			return next;
		});
		try {
			const allOutbounds = [...getOutbounds(), ...subscriptionOutbounds];
			const response = await apiFetch<{
				success: boolean;
				obj?: OutboundTestResult[];
				msg?: string;
			}>("/panel/xray/testOutbounds", {
				method: "POST",
				body: {
					outbounds: JSON.stringify(items.map((item) => item.outbound)),
					allOutbounds: JSON.stringify(allOutbounds),
					target_id: selectedTarget,
					test_type: outboundTestType,
				},
			});
			const results = Array.isArray(response?.obj) ? response.obj : [];
			setOutboundTestStates((prev) => {
				const next = { ...prev };
				items.forEach((item, index) => {
					if (item.kind === "template") {
						next[item.index] = {
							testing: false,
							result: results[index] ?? {
								success: false,
								error: response?.msg || t("pages.xray.outbound.testError"),
							},
						};
					}
				});
				return next;
			});
			setSubscriptionOutboundTestStates((prev) => {
				const next = { ...prev };
				items.forEach((item, index) => {
					if (item.kind === "subscription") {
						next[item.stateKey] = {
							testing: false,
							result: results[index] ?? {
								success: false,
								error: response?.msg || t("pages.xray.outbound.testError"),
							},
						};
					}
				});
				return next;
			});
		} catch (error: any) {
			const detail =
				error?.response?._data?.detail ??
				error?.data?.detail ??
				error?.message ??
				t("pages.xray.outbound.testError");
			const detailText =
				typeof detail === "string"
					? detail
					: JSON.stringify(detail ?? "Unknown error");
			const failure: OutboundTestResult = { success: false, error: detailText };
			setOutboundTestStates((prev) => {
				const next = { ...prev };
				for (const item of items) {
					if (item.kind === "template") {
						next[item.index] = { testing: false, result: failure };
					}
				}
				return next;
			});
			setSubscriptionOutboundTestStates((prev) => {
				const next = { ...prev };
				for (const item of items) {
					if (item.kind === "subscription") {
						next[item.stateKey] = { testing: false, result: failure };
					}
				}
				return next;
			});
			toast({
				title: `${t("pages.xray.outbound.testError")}: ${detailText}`,
				status: "error",
				isClosable: true,
				position: "top",
				duration: 4000,
			});
		} finally {
			setTestingAllOutbounds(false);
		}
	};

	const findOutboundTraffic = (outbound: any, index: number) => {
		return sumOutboundTraffic(
			outboundsTraffic,
			selectedTarget,
			outboundIds[index],
			outbound.tag,
			isMasterTarget,
		);
	};

	const findSubscriptionOutboundTraffic = (outbound: any) => {
		const outboundId = outboundsTraffic.find(
			(item) =>
				(item.target_id || "master") === selectedTarget &&
				item.tag === outbound.tag,
		)?.outbound_id;
		return sumOutboundTraffic(
			outboundsTraffic,
			selectedTarget,
			outboundId,
			outbound.tag,
			isMasterTarget,
		);
	};

	const renderOutboundTraffic = (traffic?: { up?: number; down?: number }) => (
		<div className="flex flex-row items-center gap-3 whitespace-nowrap text-[0.75rem] [font-variant-numeric:tabular-nums]">
			<p className="text-teal-400">
				↑ {SizeFormatter.sizeFormat(Number(traffic?.up) || 0)}
			</p>
			<p className="text-blue-400">
				↓ {SizeFormatter.sizeFormat(Number(traffic?.down) || 0)}
			</p>
		</div>
	);

	const canonicalOutbounds = useMemo<OutboundJson[]>(
		() =>
			Array.isArray(watchedConfig?.outbounds)
				? (watchedConfig.outbounds as OutboundJson[])
				: [],
		[watchedConfig],
	);

	useEffect(() => {
		let cancelled = false;
		const resolveIds = async () => {
			try {
				const ids = await computeOutboundIds(canonicalOutbounds);
				if (!cancelled) {
					setOutboundIds(ids);
				}
			} catch {
				if (!cancelled) {
					setOutboundIds(Array(canonicalOutbounds.length).fill(""));
				}
			}
		};
		resolveIds();
		return () => {
			cancelled = true;
		};
	}, [canonicalOutbounds]);

	const outboundIdsKey = useMemo(() => outboundIds.join("|"), [outboundIds]);

	useEffect(() => {
		void outboundIdsKey;
		setOutboundTestStates({});
	}, [outboundIdsKey]);

	useEffect(() => {
		let active = true;
		if (!canManageXraySettings) return;
		fetchOutboundsTraffic().catch(() => {
			if (active) setOutboundsTraffic([]);
		});
		fetchActiveSubscriptionOutbounds().catch(() => {
			if (active) setSubscriptionOutbounds([]);
		});
		return () => {
			active = false;
		};
	}, [
		canManageXraySettings,
		fetchActiveSubscriptionOutbounds,
		fetchOutboundsTraffic,
	]);

	const canonicalRoutingRules = useMemo<RoutingRule[]>(
		() =>
			Array.isArray(watchedConfig?.routing?.rules)
				? (watchedConfig.routing.rules as RoutingRule[])
				: [],
		[watchedConfig],
	);

	const availableInboundTags = useMemo<string[]>(
		() =>
			Array.from(
				new Set(
					(watchedConfig?.inbounds ?? [])
						.filter((inbound: any) => {
							const protocol = String(inbound?.protocol ?? "")
								.toLowerCase()
								.trim();
							if (
								![
									"openvpn",
									"wireguard",
									"l2tp",
									"pptp",
									"ikev2",
									"anyconnect",
								].includes(protocol)
							) {
								return true;
							}
							const rawTproxy = inbound?.settings?.tproxy_enabled;
							return !(
								rawTproxy === false ||
								String(rawTproxy ?? "")
									.toLowerCase()
									.trim() === "false"
							);
						})
						.map((inbound: any) => inbound?.tag)
						.filter((tag: string | undefined): tag is string => Boolean(tag)),
				),
			),
		[watchedConfig],
	);

	const availableOutboundTags = useMemo<string[]>(
		() =>
			Array.from(
				new Set(
					canonicalOutbounds
						.concat(subscriptionOutbounds)
						.map((outbound: any) => outbound?.tag)
						.filter((tag: string | undefined): tag is string => Boolean(tag)),
				),
			),
		[canonicalOutbounds, subscriptionOutbounds],
	);

	const excludedBalancerOutboundTags = useMemo<string[]>(
		() =>
			Array.from(
				new Set(
					canonicalOutbounds
						.filter((outbound: any) => {
							const protocol = String(outbound?.protocol ?? "")
								.toLowerCase()
								.trim();
							const tag = String(outbound?.tag ?? "")
								.toLowerCase()
								.trim();
							return protocol === "blackhole" || tag === "blocked";
						})
						.map((outbound: any) => outbound?.tag)
						.filter((tag: string | undefined): tag is string => Boolean(tag)),
				),
			),
		[canonicalOutbounds],
	);

	const availableBalancerTags = useMemo<string[]>(
		() =>
			Array.from(
				new Set(
					(watchedConfig?.routing?.balancers ?? [])
						.map((balancer: any) => balancer?.tag)
						.filter((tag: string | undefined): tag is string => Boolean(tag)),
				),
			),
		[watchedConfig],
	);

	const reverseData = useMemo<ReverseRow[]>(
		() => buildReverseRows(watchedConfig),
		[watchedConfig],
	);

	const editingReverseRow =
		editingReverseIndex !== null ? reverseData[editingReverseIndex] : null;

	const editingReverseInitial = useMemo<ReverseFormValues | null>(() => {
		if (!editingReverseRow) return null;
		return {
			type: editingReverseRow.type,
			tag: editingReverseRow.tag,
			credentialId: editingReverseRow.credentialId,
			flow: editingReverseRow.flow,
			interconnectionOutboundTag:
				editingReverseRow.type === "internal"
					? editingReverseRow.connectionTag
					: "",
			outboundTag: editingReverseRow.targetTag,
			interconnectionInboundTag:
				editingReverseRow.type === "public"
					? editingReverseRow.connectionTag
					: "",
			inboundTags: editingReverseRow.inboundTags,
		};
	}, [editingReverseRow]);

	const vlessInboundTags = useMemo(
		() =>
			(watchedConfig?.inbounds ?? [])
				.filter(
					(inbound: any) =>
						String(inbound?.protocol).toLowerCase() === "vless" && inbound?.tag,
				)
				.map((inbound: any) => String(inbound.tag)),
		[watchedConfig],
	);

	const vlessOutboundTags = useMemo(
		() =>
			canonicalOutbounds
				.filter((outbound: any) => {
					if (String(outbound?.protocol).toLowerCase() !== "vless")
						return false;
					const account = readVlessOutboundAccount(outbound);
					const reverseTag = String(outbound?.settings?.reverse?.tag ?? "");
					return (
						Boolean(
							outbound?.tag && account.address && account.port && account.id,
						) &&
						isSecureVlessConnection(outbound, account) &&
						(!reverseTag || outbound?.tag === editingReverseRow?.connectionTag)
					);
				})
				.map((outbound: any) => String(outbound.tag)),
		[canonicalOutbounds, editingReverseRow?.connectionTag],
	);
	const vlessOutboundDetails = useMemo(
		() =>
			Object.fromEntries(
				canonicalOutbounds.map((outbound: any) => {
					const account = readVlessOutboundAccount(outbound);
					return [
						String(outbound?.tag ?? ""),
						{ credentialId: account.id, flow: account.flow },
					];
				}),
			),
		[canonicalOutbounds],
	);
	const outboundTestStateByTag = useMemo(() => {
		const next: Record<string, OutboundTestState> = {};
		canonicalOutbounds.forEach((outbound, index) => {
			const tag = String(outbound?.tag ?? "").trim();
			const state = outboundTestStates[index];
			if (tag && state) next[tag] = state;
		});
		subscriptionOutbounds.forEach((outbound, index) => {
			const tag = String(outbound?.tag ?? "").trim();
			const state =
				subscriptionOutboundTestStates[tag || `subscription-${index}`];
			if (tag && state) next[tag] = state;
		});
		return next;
	}, [
		canonicalOutbounds,
		outboundTestStates,
		subscriptionOutbounds,
		subscriptionOutboundTestStates,
	]);
	const outboundTestingByTag = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(outboundTestStateByTag).map(([tag, state]) => [
					tag,
					state.testing,
				]),
			),
		[outboundTestStateByTag],
	);
	const withCachedOutboundLatency = useCallback(
		(tags: string[]) =>
			tags.map((tag) => {
				const delay = formatOutboundDelay(
					outboundTestStateByTag[tag]?.result?.delay,
				);
				const label = delay ? `${tag} · ${delay}` : tag;
				return { value: tag, label, title: label };
			}),
		[outboundTestStateByTag],
	);
	const outboundTagOptions = useMemo(
		() => withCachedOutboundLatency(availableOutboundTags),
		[availableOutboundTags, withCachedOutboundLatency],
	);
	const vlessOutboundTagOptions = useMemo(
		() => withCachedOutboundLatency(vlessOutboundTags),
		[vlessOutboundTags, withCachedOutboundLatency],
	);
	const testOutboundByTag = (tag: string) => {
		const templateIndex = canonicalOutbounds.findIndex(
			(outbound) => String(outbound?.tag ?? "").trim() === tag,
		);
		if (templateIndex >= 0) {
			void testOutbound(templateIndex);
			return;
		}
		const subscriptionIndex = subscriptionOutbounds.findIndex(
			(outbound) => String(outbound?.tag ?? "").trim() === tag,
		);
		if (subscriptionIndex >= 0) {
			void testSubscriptionOutbound(
				subscriptionOutbounds[subscriptionIndex],
				subscriptionIndex,
			);
		}
	};

	const existingReverseTags = useMemo(
		() =>
			Array.from(
				new Set([
					...availableInboundTags,
					...availableOutboundTags,
					...reverseData.map((reverse) => reverse.tag),
				]),
			).filter(
				(tag) =>
					tag &&
					tag !== (editingReverseIndex !== null ? editingReverseRow?.tag : ""),
			),
		[
			availableInboundTags,
			availableOutboundTags,
			editingReverseIndex,
			editingReverseRow?.tag,
			reverseData,
		],
	);

	const freedomOutboundIndex = useMemo(() => {
		if (canonicalOutbounds.length === 0) return -1;
		return canonicalOutbounds.findIndex(
			(outbound: any) => outbound?.protocol === "freedom",
		);
	}, [canonicalOutbounds]);

	const freedomDomainStrategy = useMemo(() => {
		if (freedomOutboundIndex < 0) {
			return "";
		}
		const outbound = canonicalOutbounds[freedomOutboundIndex];
		return outbound?.settings?.domainStrategy ?? "";
	}, [freedomOutboundIndex, canonicalOutbounds]);

	const handleFreedomDomainStrategyChange = (value: string) => {
		const configValue = form.getValues("config") || {};
		const outbounds = Array.isArray(configValue.outbounds)
			? JSON.parse(JSON.stringify(configValue.outbounds))
			: [];

		const index = outbounds.findIndex(
			(outbound: any) => outbound?.protocol === "freedom",
		);

		if (index === -1) {
			return;
		}

		const updated = { ...outbounds[index] };
		const settings = { ...(updated.settings || {}) };
		if (value) {
			settings.domainStrategy = value;
		} else {
			delete settings.domainStrategy;
		}
		updated.settings = settings;
		outbounds[index] = updated;

		form.setValue("config.outbounds", outbounds, { shouldDirty: true });
		setOutboundData(
			outbounds.map((o: any, idx: number) => ({ key: idx, ...o })),
		);
		setJsonKey((prev) => prev + 1);
	};

	const warpOutbound = useMemo<OutboundJson | null>(
		() =>
			canonicalOutbounds.find((outbound) => outbound?.tag === "warp") ?? null,
		[canonicalOutbounds],
	);

	const warpOutboundIndex = useMemo(
		() => canonicalOutbounds.findIndex((outbound) => outbound?.tag === "warp"),
		[canonicalOutbounds],
	);

	const warpExists = warpOutboundIndex !== -1;

	const warpDomains = useMemo<string[]>(() => {
		const rule = canonicalRoutingRules.find(
			(routingRule) => routingRule.outboundTag === "warp",
		);
		return Array.isArray(rule?.domain) ? rule.domain : [];
	}, [canonicalRoutingRules]);

	const handleWarpDomainsChange = (domains: string[]) => {
		const normalized = domains
			.map((entry) => entry.trim())
			.filter(
				(entry, index, arr) => entry.length > 0 && arr.indexOf(entry) === index,
			);

		const currentRules = getRoutingRules();
		const existingIndex = currentRules.findIndex(
			(rule) => rule.outboundTag === "warp",
		);

		if (normalized.length === 0) {
			if (existingIndex !== -1) {
				currentRules.splice(existingIndex, 1);
				commitRoutingRules(currentRules);
			}
			return;
		}

		const updatedRule: RoutingRule = {
			type: "field",
			outboundTag: "warp",
			domain: normalized,
		};

		if (existingIndex !== -1) {
			currentRules[existingIndex] = {
				...currentRules[existingIndex],
				...updatedRule,
			};
		} else {
			currentRules.push(updatedRule);
		}
		commitRoutingRules(currentRules);
	};

	const handleWarpDomainAdd = (domain: string) => {
		const trimmed = domain.trim();
		if (!trimmed) return;
		if (warpDomains.includes(trimmed)) {
			toast({
				title: t("pages.xray.warp.domainExists"),
				status: "warning",
				duration: 3000,
				isClosable: true,
				position: "top",
			});
			return;
		}
		handleWarpDomainsChange([...warpDomains, trimmed]);
	};

	const handleWarpDomainRemove = (domain: string) => {
		handleWarpDomainsChange(warpDomains.filter((item) => item !== domain));
	};

	const availableWarpOptions = useMemo(
		() =>
			SERVICES_OPTIONS.filter((option) => !warpDomains.includes(option.value)),
		[warpDomains],
	);

	const warpDomainHelper = "text-gray-600 dark:text-gray-300";

	const handleWarpSave = (outbound: OutboundJson) => {
		const outbounds = getOutbounds();
		const tag = outbound.tag ?? "warp";
		const index = outbounds.findIndex((item) => item?.tag === tag);
		if (index >= 0) {
			outbounds[index] = outbound;
		} else {
			outbounds.push(outbound);
		}
		commitOutbounds(outbounds);
	};

	const handleWarpDelete = () => {
		const outbounds = getOutbounds();
		const index = outbounds.findIndex((item) => item?.tag === "warp");
		if (index === -1) {
			return;
		}
		outbounds.splice(index, 1);
		commitOutbounds(outbounds);
		handleWarpDomainsChange([]);
		setWarpOptionValue("");
		setWarpCustomDomain("");
	};

	const handleNordSave = (
		outbound: OutboundJson,
		replaceIndex: number | null,
	) => {
		const outbounds = getOutbounds();
		if (
			replaceIndex !== null &&
			replaceIndex >= 0 &&
			replaceIndex < outbounds.length
		) {
			outbounds[replaceIndex] = outbound;
		} else {
			outbounds.push(outbound);
		}
		commitOutbounds(outbounds);
	};

	const handleNordDelete = (index: number) => {
		const outbounds = getOutbounds();
		if (index < 0 || index >= outbounds.length) {
			return;
		}
		const tag = String(outbounds[index]?.tag ?? "");
		outbounds.splice(index, 1);
		commitOutbounds(outbounds);
		if (tag) {
			const rules = form.getValues("config.routing.rules");
			if (Array.isArray(rules)) {
				form.setValue(
					"config.routing.rules",
					rules.filter((rule: any) => rule?.outboundTag !== tag),
					{ shouldDirty: true },
				);
			}
		}
	};

	const handleMullvadSave = (
		outbound: OutboundJson,
		replaceIndex: number | null,
	) => {
		const previousTag =
			replaceIndex === null
				? ""
				: String(getOutbounds()[replaceIndex]?.tag ?? "");
		// a renamed outbound keeps its routing rules and balancers
		if (previousTag && previousTag !== outbound.tag) {
			renameOutboundReferences(previousTag, String(outbound.tag));
		}
		handleNordSave(outbound, replaceIndex);
	};

	const handleOutboundSave = (outboundJson: unknown, targetIds: string[]) => {
		const outbound = outboundJson as OutboundJson;
		const outbounds = getOutbounds();
		const tag = String(outbound.tag ?? "");
		const duplicateIndex = outbounds.findIndex(
			(item, index) => item?.tag === tag && index !== editingOutboundIndex,
		);
		if (duplicateIndex >= 0) {
			throw new Error(t("pages.xray.outbound.tagExistsNamed", { tag }));
		}
		const previous =
			editingOutboundIndex !== null &&
			editingOutboundIndex >= 0 &&
			editingOutboundIndex < outbounds.length
				? outbounds[editingOutboundIndex]
				: undefined;
		if (previous?.tag && previous.tag !== tag) {
			renameOutboundReferences(String(previous.tag), tag);
		}
		queuePropagation("outbounds", previous ?? null, outbound, targetIds);
		if (
			editingOutboundIndex !== null &&
			editingOutboundIndex >= 0 &&
			editingOutboundIndex < outbounds.length
		) {
			outbounds[editingOutboundIndex] = outbound;
		} else {
			outbounds.push(outbound);
		}
		commitOutbounds(outbounds);
		setEditingOutboundIndex(null);
	};

	const handleWarpModalClose = () => {
		onWarpClose();
	};

	const handleNordModalClose = () => {
		onNordClose();
	};

	const toggleFullScreen = () => {
		if (!document.fullscreenElement) {
			document.documentElement
				.requestFullscreen()
				.then(() => {
					setIsFullScreen(true);
				})
				.catch((err) => {
					console.error("Error entering fullscreen:", err);
				});
		} else {
			document
				.exitFullscreen()
				.then(() => {
					setIsFullScreen(false);
				})
				.catch((err) => {
					console.error("Error exiting fullscreen:", err);
				});
		}
	};

	const getAdvancedJson = () => {
		const cfg = form.getValues("config") || {};
		switch (advSettings) {
			case "inboundSettings":
				return stringifyRebeccaJson(cfg.inbounds ?? [], 2, "inbounds");
			case "outboundSettings":
				return stringifyRebeccaJson(cfg.outbounds ?? [], 2, "outbounds");
			case "routingRuleSettings":
				return stringifyRebeccaJson(
					cfg.routing?.rules ?? [],
					2,
					"routingRules",
				);
			default:
				return stringifyRebeccaJson(cfg ?? {}, 2, "config");
		}
	};

	const setAdvancedJson = (value: string) => {
		try {
			const parsed = JSON.parse(value);
			const cfg = { ...(form.getValues("config") || {}) };
			switch (advSettings) {
				case "inboundSettings":
					cfg.inbounds = canonicalizeRebeccaJson(parsed, "inbounds");
					break;
				case "outboundSettings":
					cfg.outbounds = canonicalizeRebeccaJson(parsed, "outbounds");
					syncOutboundDisplay(cfg.outbounds as OutboundJson[]);
					break;
				case "routingRuleSettings":
					if (!cfg.routing) cfg.routing = {};
					cfg.routing.rules = canonicalizeRebeccaJson(parsed, "routingRules");
					syncRoutingRuleDisplay(cfg.routing.rules as RoutingRule[]);
					break;
				default: {
					// replace whole config
					const canonicalConfig = canonicalizeRebeccaJson(
						parsed,
						"config",
					) as Record<string, any>;
					form.setValue("config", canonicalConfig, { shouldDirty: true });
					// sync all derived states
					syncOutboundDisplay(
						(canonicalConfig?.outbounds as OutboundJson[]) || [],
					);
					syncRoutingRuleDisplay(
						(canonicalConfig?.routing?.rules as RoutingRule[]) || [],
					);
					setBalancersData(
						buildBalancerRows(
							(canonicalConfig?.routing?.balancers as BalancerConfig[]) || [],
						),
					);
					setDnsServers(canonicalConfig?.dns?.servers || []);
					setFakeDns(canonicalConfig?.fakedns || []);
					return;
				}
			}
			form.setValue(
				"config",
				canonicalizeRebeccaJson(cfg, "config") as EditableCoreConfig,
				{
					shouldDirty: true,
				},
			);
		} catch (_e) {
			// ignore invalid JSON until it becomes valid
		}
	};

	const getObsJson = () => {
		const cfg = form.getValues("config") || {};
		if (obsSettings === "observatory")
			return JSON.stringify(cfg.observatory ?? {}, null, 2);
		if (obsSettings === "burstObservatory")
			return JSON.stringify(cfg.burstObservatory ?? {}, null, 2);
		return "";
	};

	const setObsJson = (value: string) => {
		try {
			const parsed = JSON.parse(value);
			const cfg = { ...(form.getValues("config") || {}) };
			if (obsSettings === "observatory") cfg.observatory = parsed;
			if (obsSettings === "burstObservatory") cfg.burstObservatory = parsed;
			form.setValue("config", cfg, { shouldDirty: true });
		} catch (_e) {
			// ignore until valid
		}
	};

	const toChipList = (value: unknown): string[] => {
		if (!value && value !== 0) return [];
		if (Array.isArray(value)) {
			return value
				.map((item) => (typeof item === "string" ? item.trim() : String(item)))
				.filter(Boolean);
		}
		if (typeof value === "string") {
			return value
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean);
		}
		return [String(value)];
	};

	const renderChipList = (value: unknown, colorScheme: string = "blue") => {
		const chips = toChipList(value);
		if (!chips.length) {
			return <p className="text-gray-400">-</p>;
		}
		// use compact chips that show first item and a +N trigger on small screens
		return <CompactChips chips={chips} color={colorScheme} />;
	};

	const renderTextValue = (value: unknown) => {
		if (
			value === undefined ||
			value === null ||
			value === "" ||
			(typeof value === "string" && !value.trim())
		) {
			return <p className="text-gray-400">-</p>;
		}
		const str = typeof value === "string" ? value : String(value);
		if (str.length > 30) {
			return <CompactTextWithCopy text={str} label={t("details")} />;
		}
		return <p>{str}</p>;
	};

	const renderAttrsCell = (attrsValue: string | undefined) => {
		if (!attrsValue) {
			return <p className="text-gray-400">-</p>;
		}
		try {
			const parsed = JSON.parse(attrsValue);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				const entries = Object.entries(parsed as Record<string, unknown>);
				if (!entries.length) {
					return <p className="text-gray-400">-</p>;
				}
				return (
					<div className="flex flex-wrap gap-1">
						{entries.map(([key, value]) => (
							<Tag key={key} colorScheme="purple" size="sm">
								{`${key}: ${String(value)}`}
							</Tag>
						))}
					</div>
				);
			}
		} catch (_error) {
			// fall back to raw string rendering below
		}
		return (
			<p className="font-mono text-[0.75rem] whitespace-pre-wrap">
				{attrsValue}
			</p>
		);
	};

	type RoutingRuleDisplayRow = { rule: any; originalIndex: number };
	type OutboundDisplayRow = { outbound: any; originalIndex: number };
	type SubscriptionOutboundDisplayRow = {
		outbound: OutboundJson;
		index: number;
		stateKey: string;
	};
	type DnsDisplayRow = { dns: any; index: number };
	type FakeDnsDisplayRow = { fake: any; index: number };

	const renderOutboundBadges = (outbound: any) => (
		<div className="flex flex-row items-center gap-1 flex-wrap">
			<Tag colorScheme="purple" size="sm">
				{String(outbound.protocol ?? "-")}
			</Tag>
			{["vmess", "vless", "trojan", "shadowsocks"].includes(
				String(outbound.protocol ?? ""),
			) && (
				<>
					{outbound.streamSettings?.network && (
						<Tag colorScheme="blue" size="sm">
							{String(outbound.streamSettings.network)}
						</Tag>
					)}
					{["tls", "reality"].includes(outbound.streamSettings?.security) && (
						<Tag colorScheme="green" size="sm">
							{String(outbound.streamSettings.security)}
						</Tag>
					)}
				</>
			)}
		</div>
	);

	const renderAddressList = (addresses: string[]) =>
		addresses.length === 0 ? (
			<p className="text-gray-400">-</p>
		) : (
			<div className="flex flex-col items-start gap-1">
				{addresses.map((addr) => (
					<CompactTextWithCopy key={addr} text={addr} label={addr} />
				))}
			</div>
		);

	const renderOutboundTestResult = (state: OutboundTestState | undefined) => {
		if (state?.testing) return <Spinner size="xs" />;
		if (!state?.result)
			return (
				<p className="text-[0.75rem] text-gray-500">
					-
				</p>
			);

		const result = state.result;
		return (
			<Tooltip hasArrow label={
					result.success
						? result.output || outboundTestResultLabel(result)
						: result.error || t("pages.xray.outbound.testFailed")
				} className="whitespace-pre-wrap">
				<Tag colorScheme={result.success ? "green" : "red"} size="sm" className="[font-variant-numeric:tabular-nums] rounded-full gap-1">
					{result.success ? <CheckCircleIconStyled /> : <XCircleIconStyled />}
					{result.success
						? (formatOutboundDelay(result.delay) ?? "-")
						: t("pages.xray.outbound.testFailedBadge")}
				</Tag>
			</Tooltip>
		);
	};

	const renderOutboundTestButton = (
		outbound: any,
		state: OutboundTestState | undefined,
		onTest: () => void,
	) => {
		const addresses = findOutboundAddress(outbound);
		const requiresOutboundAddress =
			outboundTestType === "tcp" || outboundTestType === "icmp";
		const addressMissing = requiresOutboundAddress && addresses.length === 0;
		const disabledReason = isMasterTarget
			? outboundNodeTargetRequiredMessage
			: addressMissing
				? outboundAddressRequiredMessage
				: "";
		const isBlocked =
			String(outbound.protocol ?? "")
				.toLowerCase()
				.trim() === "blackhole" ||
			String(outbound.tag ?? "")
				.toLowerCase()
				.trim() === "blocked";

		const testLabel = `${t("pages.xray.routeTester.test")} · ${outboundTestTypeLabels[outboundTestType]}`;
		return (
			<Tooltip hasArrow label={disabledReason || testLabel}>
				<IconButton aria-label={testLabel} icon={<BoltIconStyled />} size="sm" isRound variant="solid" colorScheme="primary" isLoading={Boolean(state?.testing)} isDisabled={Boolean(disabledReason) || isBlocked} onClick={(event) => {
						event.stopPropagation();
						onTest();
					}} />
			</Tooltip>
		);
	};

	const renderOutboundHealthButton = (
		outbound: any,
		state: OutboundTestState | undefined,
		onCheck: () => void,
	) => {
		if (!managedOutboundMeta(outbound)) return null;
		const resultLabel = state?.result
			? state.result.success
				? `${t("pages.xray.outbound.healthHealthy")}: ${outboundTestResultLabel(state.result)}`
				: `${t("pages.xray.outbound.healthFailed")}: ${state.result.error || t("unknown")}`
			: t("pages.xray.outbound.healthCheck");
		return (
			<Tooltip hasArrow label={resultLabel}>
				<IconButton aria-label={t("pages.xray.outbound.healthCheck")} icon={<CheckCircleIcon className="w-18 h-18" />} size="sm" isRound variant="outline" colorScheme="green" isLoading={Boolean(state?.testing)} isDisabled={isMasterTarget} onClick={(event) => {
						event.stopPropagation();
						onCheck();
					}} />
			</Tooltip>
		);
	};

	const routingRuleColumns: DataTableColumn<RoutingRuleDisplayRow>[] = [
		{
			id: "rule",
			sortValue: ({ originalIndex }) => originalIndex,
			header: t("pages.xray.Routings"),
			isPrimary: true,
			priority: "primary",
			minSize: { base: "180px", lg: "210px" },
			cell: ({ rule, originalIndex }) => (
				<div className="flex flex-col items-start gap-1">
					<div className="flex flex-row items-center gap-2 min-w-0!">
						<Tag size="sm" colorScheme={rule.enabled === false ? "gray" : "green"}>
							#{originalIndex + 1}
						</Tag>
						<p className="font-semibold truncate">
							{rule.outboundTag ||
								rule.balancerTag ||
								t("pages.xray.rules.any")}
						</p>
					</div>
					<p className="text-[0.75rem] text-panel-text-muted truncate">
						{[
							toChipList(rule.inboundTag).join(",") || "any inbound",
							rule.outboundTag
								? `→ ${rule.outboundTag}`
								: rule.balancerTag
									? `→ ${rule.balancerTag}`
									: "",
						]
							.filter(Boolean)
							.join(" ")}
					</p>
				</div>
			),
		},
		{
			id: "source",
			sortValue: ({ rule }) => String(rule.source ?? ""),
			header: t("pages.xray.rules.sourceGroup"),
			priority: "medium",
			hideBelow: "xl",
			cell: ({ rule }) => (
				<div className="flex flex-col items-start gap-1">
					{renderChipList(rule.source, "blue")}
					{renderTextValue(rule.sourcePort)}
				</div>
			),
			mobileMetaLabel: t("pages.xray.rules.sourceGroup"),
		},
		{
			id: "network",
			sortValue: ({ rule }) => String(rule.network ?? ""),
			header: t("pages.xray.rules.networkGroup"),
			priority: "high",
			cell: ({ rule }) => (
				<div className="flex flex-col items-start gap-1">
					{renderChipList(rule.network, "purple")}
					{renderChipList(rule.protocol, "green")}
					{renderAttrsCell(rule.attrs)}
				</div>
			),
			mobileMetaLabel: t("pages.xray.rules.networkGroup"),
		},
		{
			id: "destination",
			sortValue: ({ rule }) => String(rule.domain ?? rule.ip ?? ""),
			header: t("pages.xray.rules.destinationGroup"),
			priority: "high",
			minSize: "180px",
			cell: ({ rule }) => (
				<div className="flex flex-col items-start gap-1">
					{renderChipList(rule.ip, "blue")}
					{renderChipList(rule.domain, "blue")}
					{renderTextValue(rule.port)}
				</div>
			),
			mobileMetaLabel: t("pages.xray.rules.destinationGroup"),
		},
		{
			id: "inbound",
			sortValue: ({ rule }) => String(rule.inboundTag ?? ""),
			header: t("inbound"),
			priority: "medium",
			hideBelow: "lg",
			cell: ({ rule }) => (
				<div className="flex flex-col items-start gap-1">
					{renderChipList(rule.inboundTag, "teal")}
					{renderChipList(rule.user, "cyan")}
				</div>
			),
			mobileMetaLabel: t("inbound"),
		},
		{
			id: "target",
			sortValue: ({ rule }) => String(rule.outboundTag ?? rule.balancerTag ?? ""),
			header: t("pages.xray.rules.outbound"),
			priority: "high",
			mobileSummary: true,
			cell: ({ rule }) => (
				<div className="flex flex-col items-start gap-1">
					{renderTextValue(rule.outboundTag)}
					{renderTextValue(rule.balancerTag)}
				</div>
			),
			mobileMetaLabel: t("pages.xray.rules.outbound"),
		},
	];

	const routingRuleActions = (
		row: RoutingRuleDisplayRow,
	): DataTableRowAction<RoutingRuleDisplayRow>[] => [
		{
			id: "edit",
			label: t("edit"),
			icon: <EditIconStyled />,
			onClick: () => editRule(row.originalIndex),
		},
		{
			id: "test",
			label: t("pages.xray.routeTester.test"),
			icon: <BoltIconStyled />,
			onClick: () => openRouteTest(row.originalIndex),
		},
		{
			id: "move-top",
			label: t("pages.xray.rules.top"),
			icon: <ChevronDoubleUpIconStyled />,
			isDisabled:
				routingRuleSearch.trim().length > 0 || row.originalIndex === 0,
			onClick: () => replaceRule(row.originalIndex, 0),
		},
		{
			id: "move-up",
			label: t("pages.xray.rules.up"),
			icon: <ArrowUpIconStyled />,
			isDisabled:
				routingRuleSearch.trim().length > 0 || row.originalIndex === 0,
			onClick: () => replaceRule(row.originalIndex, row.originalIndex - 1),
		},
		{
			id: "move-down",
			label: t("pages.xray.rules.down"),
			icon: <ArrowDownIconStyled />,
			isDisabled:
				routingRuleSearch.trim().length > 0 ||
				row.originalIndex === routingRuleData.length - 1,
			onClick: () => replaceRule(row.originalIndex, row.originalIndex + 1),
		},
		{
			id: "delete",
			label: t("delete"),
			icon: <DeleteIconStyled />,
			isDanger: true,
			onClick: () => deleteRule(row.originalIndex),
		},
	];

	const outboundColumns: DataTableColumn<OutboundDisplayRow>[] = [
		{
			id: "tag",
			sortValue: ({ outbound }) => outbound.tag ?? "",
			header: t("pages.xray.outbound.tag"),
			isPrimary: true,
			priority: "primary",
			minSize: { base: "170px", lg: "210px" },
			cell: ({ outbound }) => (
				<div className="flex flex-col items-start gap-1">
					<div className="flex flex-row items-center gap-1.5 max-w-full min-w-0!">
						{managedOutboundMeta(outbound)?.provider === "tor" && (
							<Tooltip label="Tor">
								<div className="inline-flex shrink-0">
									<TorIconStyled size={20} />
								</div>
							</Tooltip>
						)}
						<p className="font-semibold truncate">
							{String(outbound.tag ?? "-")}
						</p>
						<ManagedOutboundBadge outbound={outbound} />
					</div>
					{renderOutboundBadges(outbound)}
				</div>
			),
		},
		{
			id: "address",
			sortValue: ({ outbound }) => findOutboundAddress(outbound).join(", "),
			header: t("pages.xray.outbound.address"),
			priority: "high",
			minSize: "190px",
			cell: ({ outbound }) => renderAddressList(findOutboundAddress(outbound)),
			mobileMetaLabel: t("pages.xray.outbound.address"),
		},
		{
			id: "traffic",
			sortValue: ({ outbound, originalIndex }) => {
				const traffic = findOutboundTraffic(outbound, originalIndex);
				return (traffic?.up ?? 0) + (traffic?.down ?? 0);
			},
			header: t("pages.inbounds.traffic"),
			priority: "high",
			mobileSummary: true,
			cell: ({ outbound, originalIndex }) =>
				renderOutboundTraffic(findOutboundTraffic(outbound, originalIndex)),
		},
		{
			id: "latency",
			sortValue: ({ originalIndex }) => outboundTestStates[originalIndex]?.result?.delay ?? Number.POSITIVE_INFINITY,
			header: t("pages.xray.outbound.testTypeLatency"),
			priority: "high",
			cell: ({ originalIndex }) =>
				renderOutboundTestResult(outboundTestStates[originalIndex]),
			mobileMetaLabel: t("pages.xray.outbound.testTypeLatency"),
		},
		{
			id: "test",
			header: t("pages.xray.routeTester.test"),
			priority: "medium",
			hideBelow: "lg",
			cell: ({ outbound, originalIndex }) =>
				<div className="flex flex-row items-center gap-1">
					{renderOutboundTestButton(
						outbound,
						outboundTestStates[originalIndex],
						() => testOutbound(originalIndex),
					)}
					{renderOutboundHealthButton(
						outbound,
						outboundHealthStates[originalIndex],
						() => checkOutboundHealth(originalIndex),
					)}
				</div>,
			mobileMetaLabel: t("pages.xray.routeTester.test"),
		},
	];

	const outboundActions = (
		row: OutboundDisplayRow,
	): DataTableRowAction<OutboundDisplayRow>[] => [
		{
			id: "edit",
			label: t("edit"),
			icon: <EditIconStyled />,
			onClick: () => editOutbound(row.originalIndex),
		},
		...(isMullvadOutbound(form.getValues("config.outbounds")?.[row.originalIndex])
			? [
					{
						id: "edit-mullvad",
						label: t("pages.xray.mullvad.edit"),
						icon: <MullvadIconStyled />,
						onClick: () =>
							openMullvad(
								String(
									form.getValues("config.outbounds")?.[row.originalIndex]?.tag ?? "",
								),
							),
					},
				]
			: []),
		{
			id: "move-top",
			label: t("pages.xray.outbound.moveToTop"),
			icon: <ChevronDoubleUpIconStyled />,
			isDisabled:
				outboundSearch.trim().length > 0 ||
				outboundTrafficSort !== "default" ||
				row.originalIndex === 0,
			onClick: () => moveOutboundToTop(row.originalIndex),
		},
		{
			id: "move-up",
			label: t("pages.xray.outbound.moveUp"),
			icon: <ArrowUpIconStyled />,
			isDisabled:
				outboundSearch.trim().length > 0 ||
				outboundTrafficSort !== "default" ||
				row.originalIndex === 0,
			onClick: () => moveOutboundUp(row.originalIndex),
		},
		{
			id: "move-down",
			label: t("pages.xray.outbound.moveDown"),
			icon: <ArrowDownIconStyled />,
			isDisabled:
				outboundSearch.trim().length > 0 ||
				outboundTrafficSort !== "default" ||
				row.originalIndex === outboundData.length - 1,
			onClick: () => moveOutboundDown(row.originalIndex),
		},
		{
			id: "reset",
			label: t("pages.xray.outbound.resetTraffic"),
			icon: <ReloadIconStyled />,
			onClick: () =>
				setOutboundReset({ index: row.originalIndex, scope: "target" }),
		},
		{
			id: "delete",
			label: t("delete"),
			icon: <DeleteIconStyled />,
			isDanger: true,
			onClick: () => deleteOutbound(row.originalIndex),
		},
	];

	const outboundBulkActions: DataTableBulkAction<OutboundDisplayRow>[] = [
		{
			id: "delete",
			label: t("delete"),
			icon: <DeleteIconStyled />,
			isDanger: true,
			onClick: (_rows, rowIds) => deleteSelectedOutbounds(rowIds),
		},
	];

	const subscriptionOutboundRows = useMemo<SubscriptionOutboundDisplayRow[]>(
		() =>
			subscriptionOutbounds.map((outbound, index) => ({
				outbound,
				index,
				stateKey: String(outbound.tag ?? `subscription-${index}`),
			})),
		[subscriptionOutbounds],
	);

	const subscriptionOutboundColumns: DataTableColumn<SubscriptionOutboundDisplayRow>[] =
		[
			{
				id: "tag",
				sortValue: ({ outbound }) => outbound.tag ?? "",
				header: t("pages.xray.outbound.tag"),
				isPrimary: true,
				priority: "primary",
				cell: ({ outbound }) => (
					<div className="flex flex-col items-start gap-1">
						<p className="font-semibold truncate">
							{String(outbound.tag ?? "-")}
						</p>
						<Tag size="sm" colorScheme="green">
							{t("pages.xray.outboundSub.sourceBadge")}
						</Tag>
					</div>
				),
			},
			{
				id: "protocol",
				sortValue: ({ outbound }) => outbound.protocol ?? "",
				header: t("protocol"),
				priority: "high",
				cell: ({ outbound }) => renderOutboundBadges(outbound),
				mobileMetaLabel: t("protocol"),
			},
			{
				id: "address",
				sortValue: ({ outbound }) => findOutboundAddress(outbound).join(", "),
				header: t("pages.xray.outbound.address"),
				priority: "medium",
				hideBelow: "lg",
				cell: ({ outbound }) =>
					renderAddressList(findOutboundAddress(outbound)),
				mobileMetaLabel: t("pages.xray.outbound.address"),
			},
			{
				id: "traffic",
				sortValue: ({ outbound }) => {
					const traffic = findSubscriptionOutboundTraffic(outbound);
					return (traffic?.up ?? 0) + (traffic?.down ?? 0);
				},
				header: t("pages.inbounds.traffic"),
				priority: "high",
				mobileSummary: true,
				cell: ({ outbound }) =>
					renderOutboundTraffic(findSubscriptionOutboundTraffic(outbound)),
			},
			{
				id: "latency",
				sortValue: ({ stateKey }) => subscriptionOutboundTestStates[stateKey]?.result?.delay ?? Number.POSITIVE_INFINITY,
				header: t("pages.xray.outbound.testTypeLatency"),
				priority: "high",
				cell: ({ stateKey }) =>
					renderOutboundTestResult(subscriptionOutboundTestStates[stateKey]),
				mobileMetaLabel: t("pages.xray.outbound.testTypeLatency"),
			},
			{
				id: "test",
				header: t("pages.xray.routeTester.test"),
				priority: "medium",
				hideBelow: "lg",
				cell: ({ outbound, index, stateKey }) =>
					renderOutboundTestButton(
						outbound,
						subscriptionOutboundTestStates[stateKey],
						() => testSubscriptionOutbound(outbound, index),
					),
				mobileMetaLabel: t("pages.xray.routeTester.test"),
			},
		];

	const reverseColumns: DataTableColumn<ReverseRow>[] = [
		{
			id: "type",
			sortValue: (reverse) => reverse.type ?? "",
			header: t("pages.xray.reverse.type"),
			isPrimary: true,
			priority: "primary",
			cell: (reverse) => (
				<Tag colorScheme={reverse.type === "internal" ? "blue" : "purple"} size="sm">
					{reverse.type === "internal"
						? t("pages.xray.reverse.internal")
						: t("pages.xray.reverse.public")}
				</Tag>
			),
		},
		{
			id: "tag",
			sortValue: (reverse) => reverse.tag ?? "",
			header: t("pages.xray.reverse.tag"),
			priority: "high",
			cell: (reverse) => renderTextValue(reverse.tag),
			mobileSummary: true,
		},
		{
			id: "connection",
			sortValue: (reverse) => reverse.connectionTag ?? "",
			header: t("pages.xray.reverse.connection"),
			priority: "high",
			cell: (reverse) => renderTextValue(reverse.connectionTag),
		},
		{
			id: "target",
			sortValue: (reverse) => (reverse.type === "internal" ? reverse.targetTag ?? "" : String(reverse.inboundTags ?? "")),
			header: t("pages.xray.reverse.target"),
			priority: "medium",
			hideBelow: "lg",
			cell: (reverse) =>
				reverse.type === "internal"
					? renderTextValue(reverse.targetTag)
					: renderChipList(reverse.inboundTags, "cyan"),
		},
	];

	const reverseActions = (
		row: ReverseRow,
	): DataTableRowAction<ReverseRow>[] => [
		{
			id: "edit",
			label: t("edit"),
			icon: <EditIconStyled />,
			onClick: () => editReverse(row.index),
		},
		{
			id: "delete",
			label: t("delete"),
			icon: <DeleteIconStyled />,
			isDanger: true,
			onClick: () => deleteReverse(row.index),
		},
	];

	const balancerColumns: DataTableColumn<BalancerRow>[] = [
		{
			id: "tag",
			sortValue: (balancer) => balancer.tag ?? "",
			header: t("pages.xray.balancer.tag"),
			isPrimary: true,
			priority: "primary",
			cell: (balancer) => <p className="font-semibold">{balancer.tag}</p>,
		},
		{
			id: "strategy",
			sortValue: (balancer) => balancer.strategy ?? "",
			header: t("pages.xray.balancer.balancerStrategy"),
			priority: "high",
			mobileSummary: true,
			cell: (balancer) => (
				<Tag colorScheme={balancer.strategy === "random" ? "purple" : "green"} size="sm">
					{balancer.strategy === "random"
						? "Random"
						: balancer.strategy === "roundRobin"
							? "Round Robin"
							: balancer.strategy === "leastLoad"
								? "Least Load"
								: "Least Ping"}
				</Tag>
			),
		},
		{
			id: "selector",
			sortValue: (balancer) => String(balancer.selector ?? ""),
			header: t("pages.xray.balancer.balancerSelectors"),
			priority: "high",
			cell: (balancer) => renderChipList(balancer.selector, "blue"),
		},
	];

	const balancerActions = (
		row: BalancerRow,
	): DataTableRowAction<BalancerRow>[] => [
		{
			id: "edit",
			label: t("edit"),
			icon: <EditIconStyled />,
			onClick: () => editBalancer(row.key),
		},
		{
			id: "delete",
			label: t("delete"),
			icon: <DeleteIconStyled />,
			isDanger: true,
			onClick: () => deleteBalancer(row.key),
		},
	];

	const dnsRows = useMemo<DnsDisplayRow[]>(
		() => dnsServers.map((dns, index) => ({ dns, index })),
		[dnsServers],
	);
	const dnsColumns: DataTableColumn<DnsDisplayRow>[] = [
		{
			id: "address",
			sortValue: ({ dns }) => String(typeof dns === "object" ? dns.address : dns),
			header: t("pages.xray.outbound.address"),
			isPrimary: true,
			priority: "primary",
			cell: ({ dns }) =>
				renderTextValue(typeof dns === "object" ? dns.address : dns),
		},
		{
			id: "domains",
			sortValue: ({ dns }) => (typeof dns === "object" ? String(dns.domains ?? "") : ""),
			header: t("pages.xray.dns.domains"),
			priority: "high",
			cell: ({ dns }) =>
				typeof dns === "object" ? renderChipList(dns.domains, "blue") : "",
			mobileSummary: true,
		},
		{
			id: "expectIPs",
			sortValue: ({ dns }) => (typeof dns === "object" ? String(dns.expectIPs ?? "") : ""),
			header: t("pages.xray.dns.expectIPs"),
			priority: "medium",
			hideBelow: "lg",
			cell: ({ dns }) =>
				typeof dns === "object" ? renderChipList(dns.expectIPs, "green") : "",
		},
	];
	const dnsActions = (
		row: DnsDisplayRow,
	): DataTableRowAction<DnsDisplayRow>[] => [
		{
			id: "edit",
			label: t("edit"),
			icon: <EditIconStyled />,
			onClick: () => editDnsServer(row.index),
		},
		{
			id: "delete",
			label: t("delete"),
			icon: <DeleteIconStyled />,
			isDanger: true,
			onClick: () => deleteDnsServer(row.index),
		},
	];

	const fakeDnsRows = useMemo<FakeDnsDisplayRow[]>(
		() => fakeDns.map((fake, index) => ({ fake, index })),
		[fakeDns],
	);
	const fakeDnsColumns: DataTableColumn<FakeDnsDisplayRow>[] = [
		{
			id: "ipPool",
			sortValue: ({ fake }) => String(fake.ipPool ?? ""),
			header: t("pages.xray.fakedns.ipPool"),
			isPrimary: true,
			priority: "primary",
			cell: ({ fake }) => renderTextValue(fake.ipPool),
		},
		{
			id: "poolSize",
			sortValue: ({ fake }) => Number(fake.poolSize) || 0,
			header: t("pages.xray.fakedns.poolSize"),
			priority: "high",
			mobileSummary: true,
			cell: ({ fake }) => renderTextValue(fake.poolSize),
		},
	];
	const fakeDnsActions = (
		row: FakeDnsDisplayRow,
	): DataTableRowAction<FakeDnsDisplayRow>[] => [
		{
			id: "edit",
			label: t("edit"),
			icon: <EditIconStyled />,
			onClick: () => editFakeDns(row.index),
		},
		{
			id: "delete",
			label: t("delete"),
			icon: <DeleteIconStyled />,
			isDanger: true,
			onClick: () => deleteFakeDns(row.index),
		},
	];

	if (!getUserIsSuccess) {
		return <PageLoadingSkeleton />;
	}

	if (!canManageXraySettings) {
		return (
			<div className="flex flex-col gap-4 items-stretch">
				<h1 className="font-semibold text-[1.5rem]">
					{t("header.xraySettings")}
				</h1>
				<p className="text-[0.875rem] text-gray-500 dark:text-gray-400">
					{t("xraySettings.noPermission")}
				</p>
			</div>
		);
	}

	const observatoryJsonValue = activeTab === 4 ? getObsJson() : "";
	const advancedJsonValue = activeTab === 6 ? getAdvancedJson() : "";
	const advancedJsonModes = [
		{
			value: "xraySetting",
			label: t("pages.xray.completeTemplate"),
			description: t("pages.xray.completeTemplateDesc"),
		},
		{
			value: "inboundSettings",
			label: t("pages.xray.Inbounds"),
			description: t("pages.xray.inboundsJsonDesc"),
		},
		{
			value: "outboundSettings",
			label: t("pages.xray.Outbounds"),
			description: t("pages.xray.outboundsJsonDesc"),
		},
		{
			value: "routingRuleSettings",
			label: t("pages.xray.Routings"),
			description: t("pages.xray.routingRulesJsonDesc"),
		},
	];
	const activeAdvancedJsonMode =
		advancedJsonModes.find((option) => option.value === advSettings) ||
		advancedJsonModes[0];
	const advancedJsonContext: RebeccaJsonContext =
		advSettings === "inboundSettings"
			? "inbounds"
			: advSettings === "outboundSettings"
				? "outbounds"
				: advSettings === "routingRuleSettings"
					? "routingRules"
					: "config";

	const handleTabChange = (index: number) => {
		setActiveTab(index);
		const key = tabKeys[index] || "";
		if (readHashTab() !== key) window.location.hash = key;
	};

	const openRouteTest = (index: number) => {
		const rule = getRoutingRules()[index];
		if (!rule) return;
		setRouteTestRule(rule);
		onRouteTestOpen();
	};

	return (
		<div className="flex flex-col gap-4 items-stretch">
			<div className={cn(pageShellBorder, "hover:md:shadow-sm hover:md:border-panel-border-strong!", cn("border rounded-2xl p-4 md:p-5 [transition:box-shadow_0.2s_ease,_border-color_0.2s_ease]", pageShellBg))}>
				<div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end justify-between">
					<div className="min-w-0!">
						<h1 className="font-semibold text-[1.5rem]">
							{t("header.coreSettings")}
						</h1>
						<p className={cn("text-[0.875rem] mt-1", pageHintColor)}>
							{t("pages.xray.coreDescription")}
						</p>
					</div>
					<div className="flex flex-row items-center gap-2 flex-wrap justify-stretch lg:justify-end">
						<Button size="sm" colorScheme="primary" isLoading={isPostLoading} isDisabled={!hasConfigChanges || isPostLoading} onClick={handleOnSave} className="w-full sm:w-auto">
							{t("save")}
						</Button>
						<Button size="sm" leftIcon={<ReloadIconStyled />} isLoading={isRestarting} onClick={() => handleRestartCore(selectedTarget)} variant="outline" className="w-full sm:w-auto">
							{t(isRestarting ? "core.restarting" : "core.restartCore")}
						</Button>
					</div>
				</div>
				{hasNodeTargets && (
					<div className={cn(pageShellBorderTop, "flex flex-row mt-4 pt-3 border-t gap-3 items-end flex-wrap w-full")}>
						<FormControl className="w-full sm:w-[260px]">
							<FormLabel className={cn("mb-1 text-[0.75rem]", pageHintColor)}>
								{t("pages.xray.routeTester.target")}
							</FormLabel>
							<Select size="sm" value={selectedTarget} onChange={(event) => setSelectedTarget(event.target.value)} options={[
									{ label: t("core.defaultConfig"), value: "master" },
									...configTargets
										.filter((target) => target.type === "node")
										.map((target) => ({
											label: (
												<span className="flex flex-row items-center min-w-0! gap-1">
													<span className="truncate">
														{target.name}
														{target.address ? ` - ${target.address}` : ""}
													</span>
													{target.mode === "custom" && (
														<span className="shrink-0 text-[10px] opacity-70">
															(custom)
														</span>
													)}
												</span>
											),
											searchLabel: target.name,
											value: target.id,
										})),
								]} className="h-[32px]" />
						</FormControl>
						{selectedTargetInfo?.type === "node" && (
							<FormControl className="flex items-center w-full sm:w-auto min-h-[32px]">
								<FormLabel className="mb-0 text-[0.875rem]">
									{t("core.customNodeConfig")}
								</FormLabel>
								<Switch size="sm" isChecked={selectedTargetInfo.mode === "custom"} isDisabled={isChangingTargetMode} onChange={(event) =>
										handleTargetModeChange(event.target.checked)
									} />
							</FormControl>
						)}
					</div>
				)}
			</div>
			<TabSystem tabs={[
					{
						value: "basic",
						isActive: activeTab === 0,
						onClick: () => handleTabChange(0),
						label: (
							<div className="flex flex-row gap-2 items-center">
								<BasicTabIcon />
								<span>{t("pages.xray.basicTemplate")}</span>
							</div>
						),
					},
					{
						value: "routing",
						isActive: activeTab === 1,
						onClick: () => handleTabChange(1),
						label: (
							<div className="flex flex-row gap-2 items-center">
								<RoutingTabIcon />
								<span>{t("pages.xray.Routings")}</span>
							</div>
						),
					},
					{
						value: "outbounds",
						isActive: activeTab === 2,
						onClick: () => handleTabChange(2),
						label: (
							<div className="flex flex-row gap-2 items-center">
								<OutboundTabIcon />
								<span>{t("pages.xray.Outbounds")}</span>
							</div>
						),
					},
					{
						value: "reverse",
						isActive: activeTab === 3,
						onClick: () => handleTabChange(3),
						label: (
							<div className="flex flex-row gap-2 items-center">
								<ReloadIconStyled />
								<span>{t("pages.xray.reverse.title")}</span>
							</div>
						),
					},
					{
						value: "balancers",
						isActive: activeTab === 4,
						onClick: () => handleTabChange(4),
						label: (
							<div className="flex flex-row gap-2 items-center">
								<BalancerTabIcon />
								<span>{t("pages.xray.Balancers")}</span>
							</div>
						),
					},
					{
						value: "dns",
						isActive: activeTab === 5,
						onClick: () => handleTabChange(5),
						label: (
							<div className="flex flex-row gap-2 items-center">
								<DnsTabIcon />
								<span>{t("DNS")}</span>
							</div>
						),
					},
					{
						value: "advanced",
						isActive: activeTab === 6,
						onClick: () => handleTabChange(6),
						label: (
							<div className="flex flex-row gap-2 items-center">
								<AdvancedTabIcon />
								<span>{t("pages.xray.advancedTemplate")}</span>
							</div>
						),
					},
				]} className="overflow-x-auto overflow-y-hidden max-w-full" />
			<div className="mt-2 md:mt-3">
				{activeTab === 0 && (
					<div className="p-0 mt-3">
						<div className="flex flex-col gap-4 items-stretch">
							<div className="flex flex-col gap-3 items-stretch">
								<SettingsSection title={t("pages.xray.serverIPs")} defaultOpen>
									<SettingRow label="IPv4" controlId="server-ipv4">
										{(_controlId) => (
											<CompactTextWithCopy
												text={serverIPs?.ipv4 || "Loading..."}
											/>
										)}
									</SettingRow>
									<SettingRow label="IPv6" controlId="server-ipv6">
										{(_controlId) => (
											<CompactTextWithCopy
												text={serverIPs?.ipv6 || "Loading..."}
											/>
										)}
									</SettingRow>
								</SettingsSection>
								<SettingsSection title={t("pages.xray.generalConfigs")}>
									<SettingRow
										label={t("pages.xray.FreedomStrategy")}
										controlId="freedom-domain-strategy"
									>
										{(id) => (
											<Select id={id} size="sm" value={freedomDomainStrategy} onChange={(event) =>
													handleFreedomDomainStrategyChange(event.target.value)
												} isDisabled={freedomOutboundIndex === -1} className="max-w-[220px]">
												<option value="">{t("common.default")}</option>
												{[
													"AsIs",
													"UseIP",
													"UseIPv4",
													"UseIPv6",
													"UseIPv6v4",
													"UseIPv4v6",
												].map((s) => (
													<option key={s} value={s}>
														{s}
													</option>
												))}
											</Select>
										)}
									</SettingRow>
									<SettingRow
										label={t("pages.xray.RoutingStrategy")}
										controlId="routing-domain-strategy"
									>
										{(id) => (
											<Controller
												name="config.routing.domainStrategy"
												control={form.control}
												render={({ field }) => (
													<Select {...field} id={id} size="sm" className="max-w-[220px]">
														{["AsIs", "IPIfNonMatch", "IPOnDemand"].map((s) => (
															<option key={s} value={s}>
																{s}
															</option>
														))}
													</Select>
												)}
											/>
										)}
									</SettingRow>
								</SettingsSection>
								<SettingsSection title={t("pages.xray.warpRouting")}>
									<div className="p-3 md:p-4">
										<div className="flex flex-col items-stretch gap-3">
											<div className="flex flex-row gap-2 justify-between items-center">
												<p className={cn("text-[0.875rem]", warpDomainHelper)}>
													{t("pages.xray.warpRoutingDesc")}
												</p>
												<Button variant="outline" size="sm" leftIcon={<WarpIconStyled />} onClick={onWarpOpen} className="shrink-0">
													{warpExists
														? t("pages.xray.warp.manage")
														: t("pages.xray.warp.create")}
												</Button>
											</div>
											<div className="flex flex-wrap gap-2">
												{warpDomains.length === 0 && (
													<div>
														<Tag colorScheme="gray" variant="subtle">
															<TagLabel>{t("core.empty")}</TagLabel>
														</Tag>
													</div>
												)}
												{warpDomains.map((domain) => (
													<div key={domain}>
														<Tag colorScheme="primary" className="rounded-full">
															<TagLabel>{domain}</TagLabel>
															<TagCloseButton aria-label={t("remove")} onClick={() => handleWarpDomainRemove(domain)} />
														</Tag>
													</div>
												))}
											</div>
											<div className="flex flex-row items-center gap-3 flex-wrap">
												<Select placeholder={t("core.select")} size="sm" value={warpOptionValue} onChange={(event) => {
														const { value } = event.target;
														if (value) {
															handleWarpDomainAdd(value);
														}
														setWarpOptionValue("");
													}} isDisabled={availableWarpOptions.length === 0} className="max-w-[240px]">
													{availableWarpOptions.map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</Select>
												<div className="flex flex-row items-center gap-2 max-w-[320px] flex-1">
													<Input size="sm" value={warpCustomDomain} onChange={(event) =>
															setWarpCustomDomain(event.target.value)
														} placeholder="geosite:google" />
													<Button size="sm" colorScheme="primary" onClick={() => {
															handleWarpDomainAdd(warpCustomDomain);
															setWarpCustomDomain("");
														}} isDisabled={!warpCustomDomain.trim()}>
														{t("add")}
													</Button>
												</div>
											</div>
										</div>
									</div>
								</SettingsSection>
								<SettingsSection title={t("pages.xray.statistics")}>
									<SettingRow
										label={t("pages.xray.statsInboundUplink")}
										controlId="stats-inbound-uplink"
									>
										{(id) => (
											<Controller
												name="config.policy.system.statsInboundUplink"
												control={form.control}
												render={({ field }) => (
													<Switch id={id} isChecked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />
												)}
											/>
										)}
									</SettingRow>
									<SettingRow
										label={t("pages.xray.statsInboundDownlink")}
										controlId="stats-inbound-downlink"
									>
										{(id) => (
											<Controller
												name="config.policy.system.statsInboundDownlink"
												control={form.control}
												render={({ field }) => (
													<Switch id={id} isChecked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />
												)}
											/>
										)}
									</SettingRow>
									<SettingRow
										label={t("pages.xray.statsOutboundUplink")}
										controlId="stats-outbound-uplink"
									>
										{(id) => (
											<Controller
												name="config.policy.system.statsOutboundUplink"
												control={form.control}
												render={({ field }) => (
													<Switch id={id} isChecked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />
												)}
											/>
										)}
									</SettingRow>
									<SettingRow
										label={t("pages.xray.statsOutboundDownlink")}
										controlId="stats-outbound-downlink"
									>
										{(id) => (
											<Controller
												name="config.policy.system.statsOutboundDownlink"
												control={form.control}
												render={({ field }) => (
													<Switch id={id} isChecked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />
												)}
											/>
										)}
									</SettingRow>
								</SettingsSection>
								<SettingsSection title={t("pages.xray.logConfigs")}>
									<SettingRow
										label={t("pages.xray.logLevel")}
										controlId="log-level"
									>
										{(id) => (
											<Controller
												name="config.log.loglevel"
												control={form.control}
												render={({ field }) => (
													<Select {...field} id={id} size="sm" className="max-w-[220px]">
														{["none", "debug", "info", "warning", "error"].map(
															(s) => (
																<option key={s} value={s}>
																	{s}
																</option>
															),
														)}
													</Select>
												)}
											/>
										)}
									</SettingRow>
									<SettingRow
										label={t("pages.xray.accessLog")}
										controlId="access-log"
									>
										{(id) => (
											<div className="flex flex-row items-center gap-2 w-full flex-wrap">
												<Controller
													name="config.log.access"
													control={form.control}
													render={({ field }) => (
														<Select {...field} id={id} size="sm" className="max-w-[220px]">
															<option value="">{t("common.empty")}</option>
															{["none", DEFAULT_ACCESS_LOG_PATH].map((s) => (
																<option key={s} value={s}>
																	{s}
																</option>
															))}
														</Select>
													)}
												/>
												<Controller
													name="config.log.accessCleanupInterval"
													control={form.control}
													render={({ field }) => (
														<Select id={`${id}-cleanup`} size="sm" value={
																field.value === undefined ||
																field.value === null ||
																field.value === ""
																	? "0"
																	: String(field.value)
															} onChange={(e) =>
																field.onChange(Number(e.target.value))
															} className="max-w-[220px]">
															{LOG_CLEANUP_INTERVAL_OPTIONS.map((option) => (
																<option
																	key={option.value}
																	value={String(option.value)}
																>
																	{t(option.labelKey, option.fallback)}
																</option>
															))}
														</Select>
													)}
												/>
											</div>
										)}
									</SettingRow>
									<SettingRow
										label={t("pages.xray.errorLog")}
										controlId="error-log"
									>
										{(id) => (
											<div className="flex flex-row items-center gap-2 w-full flex-wrap">
												<Controller
													name="config.log.error"
													control={form.control}
													render={({ field }) => (
														<Select {...field} id={id} size="sm" className="max-w-[220px]">
															<option value="">{t("common.empty")}</option>
															{["none", DEFAULT_ERROR_LOG_PATH].map((s) => (
																<option key={s} value={s}>
																	{s}
																</option>
															))}
														</Select>
													)}
												/>
												<Controller
													name="config.log.errorCleanupInterval"
													control={form.control}
													render={({ field }) => (
														<Select id={`${id}-cleanup`} size="sm" value={
																field.value === undefined ||
																field.value === null ||
																field.value === ""
																	? "0"
																	: String(field.value)
															} onChange={(e) =>
																field.onChange(Number(e.target.value))
															} className="max-w-[220px]">
															{LOG_CLEANUP_INTERVAL_OPTIONS.map((option) => (
																<option
																	key={option.value}
																	value={String(option.value)}
																>
																	{t(option.labelKey, option.fallback)}
																</option>
															))}
														</Select>
													)}
												/>
											</div>
										)}
									</SettingRow>
									<SettingRow
										label={t("pages.xray.maskAddress")}
										controlId="mask-address"
									>
										{(id) => (
											<Controller
												name="config.log.maskAddress"
												control={form.control}
												render={({ field }) => (
													<Select {...field} id={id} size="sm" className="max-w-[220px]">
														<option value="">{t("common.empty")}</option>
														{["quarter", "half", "full"].map((s) => (
															<option key={s} value={s}>
																{s}
															</option>
														))}
													</Select>
												)}
											/>
										)}
									</SettingRow>
									<SettingRow
										label={t("pages.xray.dnsLog")}
										controlId="dns-log"
									>
										{(id) => (
											<Controller
												name="config.log.dnsLog"
												control={form.control}
												render={({ field }) => (
													<Switch id={id} isChecked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />
												)}
											/>
										)}
									</SettingRow>
								</SettingsSection>
							</div>
						</div>
					</div>
				)}
				{activeTab === 1 && (
					<div className="p-0 mt-3">
						<div className="flex flex-col gap-4 items-stretch">
							<ResourceListCard
								title={t("pages.xray.Routings")}
								summaryItems={[
									{
										label: t("total"),
										value: routingRuleData.length,
									},
									{
										label: t("listed"),
										value: filteredRoutingRules.length,
										colorScheme: "green",
									},
								]}
								actions={
									<div className="flex flex-row items-center gap-2 flex-wrap justify-end">
										<Button leftIcon={<AddIconStyled />} {...compactActionButtonProps} size="xs" onClick={addRule}>
											{t("pages.xray.rules.add")}
										</Button>
									</div>
								}
							>
								<SearchInput containerProps={{ className: "max-w-full_md:max-w-[320px]" }} placeholder={t("search")} value={routingRuleSearch} onChange={(e) => setRoutingRuleSearch(e.target.value)} matchOptions={routingRuleSearchMatch} onMatchOptionsChange={setRoutingRuleSearchMatch} />
							</ResourceListCard>
							<DataTable
								data={filteredRoutingRules}
								columns={routingRuleColumns}
								getRowId={(row) => String(row.originalIndex)}
								rowActions={routingRuleActions}
								actionsDisplay="menu"
								actionsColumnWidth="52px"
								emptyState={t("pages.xray.rules.empty")}
								ariaLabel={t("pages.xray.Routings")}
							/>
							{subscriptionOutbounds.length > 0 && (
								<div className="flex flex-col items-stretch gap-3">
									<ResourceListCard
										title={t("pages.xray.outboundSub.fromSubsTitle")}
										summaryItems={[
											{
												label: t("total"),
												value: subscriptionOutbounds.length,
												colorScheme: "green",
											},
										]}
									>
										<p className="text-panel-text-muted text-[0.75rem]">
											{t("pages.xray.outboundSub.fromSubsDesc")}
										</p>
									</ResourceListCard>
									<DataTable
										data={subscriptionOutboundRows}
										columns={subscriptionOutboundColumns}
										getRowId={(row) => `${row.stateKey}-${row.index}`}
										actionsDisplay="none"
										emptyState={t("pages.xray.outbound.empty")}
										ariaLabel={t("pages.xray.outboundSub.fromSubsTitle")}
									/>
								</div>
							)}
						</div>
					</div>
				)}
				{activeTab === 2 && (
					<div className="p-0 mt-3">
						<div className="flex flex-col gap-4 items-stretch">
							<ResourceListCard
								title={t("pages.xray.Outbounds")}
								summaryItems={[
									{
										label: t("total"),
										value: outboundData.length - managedOutboundTotal,
									},
									{
										label: t("listed"),
										value: standardOutboundData.length,
										colorScheme: "green",
									},
									{
										label: t("services.selected"),
										value: selectedOutboundIds.length,
										colorScheme: "blue",
									},
								]}
								actions={
									<div className="flex flex-row items-center gap-2 flex-wrap justify-end">
										<Button leftIcon={<AddIconStyled />} {...compactActionButtonProps} onClick={addOutbound}>
											{t("pages.xray.outbound.addOutbound")}
										</Button>
										<Button leftIcon={<CloudArrowUpIcon className="w-14" />} size="xs" variant="ghost" onClick={onOutboundSubsOpen}>
											{t("pages.xray.outboundSub.title")}
										</Button>
										<Menu placement="bottom-end" isLazy>
											<MenuButton as={Button} leftIcon={<MoreIconStyled />} size="xs" variant="ghost">
												{t("more")}
											</MenuButton>
											<Portal>
												<MenuList className="z-[popover] min-w-[210px]!">
													<MenuItem icon={<WarpIconStyled />} onClick={onWarpOpen}>
														{warpExists
															? t("pages.xray.warp.manage")
															: t("pages.xray.warp.create")}
													</MenuItem>
													<MenuItem icon={<NordVPNIconStyled />} onClick={onNordOpen}>
														NordVPN
													</MenuItem>
													<MenuItem icon={<MullvadIconStyled />} onClick={() => openMullvad()}>
														Mullvad
													</MenuItem>
													<MenuItem icon={<TorIconStyled />} isDisabled={isApplyingTorProxy} onClick={onTorProxyOpen}>
														{t("pages.xray.tor.setup")}
													</MenuItem>
													<MenuItem icon={<WindscribeIconStyled />} isDisabled={isApplyingWindscribeProxy} onClick={onWindscribeProxyOpen}>
														Windscribe
													</MenuItem>
													<MenuItem icon={<PsiphonIconStyled />} isDisabled={isApplyingPsiphonProxy} onClick={onPsiphonProxyOpen}>
														Psiphon
													</MenuItem>
												</MenuList>
											</Portal>
										</Menu>
									</div>
								}
								footerActions={
									<>
										<Button leftIcon={<ReloadIconStyled />} size="xs" variant="ghost" onClick={fetchOutboundsTraffic}>
											{t("refresh")}
										</Button>
										<Button size="xs" variant="ghost" onClick={() =>
												setOutboundReset({ index: -1, scope: "target" })
											}>
											{t("pages.xray.outbound.resetTarget")}
										</Button>
										<Button size="xs" variant="ghost" colorScheme="red" onClick={() =>
												setOutboundReset({ index: -1, scope: "all" })
											}>
											{t("pages.xray.outbound.resetAll")}
										</Button>
										<Button leftIcon={<BoltIconStyled />} {...compactActionButtonProps} isLoading={testingAllOutbounds} isDisabled={isMasterTarget} onClick={testAllOutbounds}>
											{t("pages.xray.outbound.testAll")}
										</Button>
									</>
								}
							>
								<div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
									<SearchInput containerProps={{ className: "max-w-full_md:max-w-[320px]" }} placeholder={t("search")} value={outboundSearch} onChange={(e) => setOutboundSearch(e.target.value)} matchOptions={outboundSearchMatch} onMatchOptionsChange={setOutboundSearchMatch} />
									<Select size="sm" value={outboundTrafficSort} showSearch={false} options={[
											{ value: "default", label: t("trafficSort.default") },
											{ value: "highest", label: t("trafficSort.highest") },
											{ value: "lowest", label: t("trafficSort.lowest") },
										]} placeholder={t("trafficSort.label")} onChange={(event) =>
											setOutboundTrafficSort(
												event.target.value as TrafficSortOrder,
											)
										} className="w-full md:w-[210px]" />
									<RadioGroup size="sm" value={outboundTestType} onChange={(value) =>
											setOutboundTestType(value as OutboundTestType)
										}>
										<div className="flex flex-row items-center gap-2 border rounded-md px-2 py-1 flex-wrap">
											{(["latency", "tcp", "icmp"] as OutboundTestType[]).map(
												(type) => (
													<Radio key={type} value={type} size="sm">
														{outboundTestTypeLabels[type]}
													</Radio>
												),
											)}
										</div>
									</RadioGroup>
								</div>
							</ResourceListCard>
							<DataTable
								data={standardOutboundData}
								columns={outboundColumns}
								getRowId={(row) => String(row.originalIndex)}
								enableSelection
								selectedRowIds={selectedOutboundIds}
								onSelectionChange={(ids) => setSelectedOutboundIds(ids)}
								bulkActions={outboundBulkActions}
								rowActions={outboundActions}
								actionsDisplay="menu"
								actionsColumnWidth="52px"
								emptyState={t("pages.xray.outbound.empty")}
								ariaLabel={t("pages.xray.Outbounds")}
							/>
							{managedOutboundTotal > 0 && (
								<div className="flex flex-col items-stretch gap-3">
									<ResourceListCard
										title={t("pages.xray.outboundManaged.title")}
										summaryItems={[
											{
												label: t("total"),
												value: managedOutboundTotal,
												colorScheme: "green",
											},
											{
												label: t("listed"),
												value: managedOutboundData.length,
												colorScheme: "blue",
											},
										]}
									>
										<p className="text-panel-text-muted text-[0.75rem]">
											{t("pages.xray.outboundManaged.description")}
										</p>
									</ResourceListCard>
									<DataTable
										data={managedOutboundData}
										columns={outboundColumns}
										getRowId={(row) => String(row.originalIndex)}
										rowActions={outboundActions}
										actionsDisplay="menu"
										actionsColumnWidth="52px"
										emptyState={t("pages.xray.outbound.empty")}
										ariaLabel={t("pages.xray.outboundManaged.title")}
									/>
								</div>
							)}
						</div>
					</div>
				)}
				{activeTab === 3 && (
					<div className="p-0 mt-3">
						<div className="flex flex-col gap-4 items-stretch">
							<ResourceListCard
								title={t("pages.xray.reverse.title")}
								summaryItems={[
									{
										label: t("total"),
										value: reverseData.length,
									},
									{
										label: t("pages.xray.reverse.internal"),
										value: reverseData.filter(
											(reverse) => reverse.type === "internal",
										).length,
										colorScheme: "blue",
									},
									{
										label: t("pages.xray.reverse.public"),
										value: reverseData.filter(
											(reverse) => reverse.type === "public",
										).length,
										colorScheme: "purple",
									},
								]}
								actions={
									<Button leftIcon={<AddIconStyled />} {...compactActionButtonProps} onClick={addReverse}>
										{t("pages.xray.reverse.add")}
									</Button>
								}
							/>
							<DataTable
								data={reverseData}
								columns={reverseColumns}
								getRowId={(row) => row.key}
								rowActions={reverseActions}
								actionsDisplay="menu"
								actionsColumnWidth="52px"
								emptyState={t("pages.xray.reverse.empty")}
								ariaLabel={t("pages.xray.reverse.title")}
							/>
						</div>
					</div>
				)}
				{activeTab === 4 && (
					<div className="p-0 mt-3">
						<div className="flex flex-col gap-4 items-stretch">
							<ResourceListCard
								title={t("pages.xray.Balancers")}
								summaryItems={[
									{
										label: t("total"),
										value: balancersData.length,
									},
									{
										label: t("pages.xray.balancer.balancerSelectors"),
										value: balancersData.reduce(
											(total, balancer) => total + balancer.selector.length,
											0,
										),
										colorScheme: "blue",
									},
								]}
								actions={
									<Button leftIcon={<AddIconStyled />} {...compactActionButtonProps} onClick={addBalancer}>
										{t("pages.xray.balancer.addBalancer")}
									</Button>
								}
							/>
							<DataTable
								data={balancersData}
								columns={balancerColumns}
								getRowId={(row) => String(row.key)}
								rowActions={balancerActions}
								actionsDisplay="menu"
								actionsColumnWidth="52px"
								emptyState={t("emptyBalancersDesc")}
								ariaLabel={t("pages.xray.Balancers")}
							/>
							{/* Observatory / Burst Observatory editor (if present in config) */}
							{(form.getValues("config")?.observatory ||
								form.getValues("config")?.burstObservatory) && (
								<div className="flex flex-col gap-3 items-stretch">
									<RadioGroup onChange={(v) => {
											setObsSettings(v);
											setJsonKey((prev) => prev + 1);
										}} value={obsSettings}>
										<div className="flex flex-row items-center gap-3">
											{form.getValues("config")?.observatory && (
												<Radio value="observatory">Observatory</Radio>
											)}
											{form.getValues("config")?.burstObservatory && (
												<Radio value="burstObservatory">
													Burst Observatory
												</Radio>
											)}
										</div>
									</RadioGroup>
									<div className="h-[300px]">
										<Suspense fallback={<Spinner size="sm" />}>
											<JsonEditor
												key={`obs-${obsSettings}-${jsonKey}`}
												json={observatoryJsonValue}
												onChange={(value) => setObsJson(value)}
											/>
										</Suspense>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
				{activeTab === 5 && (
					<div className="p-0 mt-3">
						<div className="flex flex-col gap-4 items-stretch">
							<SettingsSection title={t("pages.xray.generalConfigs")}>
								<SettingRow
									label={t("pages.xray.dns.enable")}
									description={t("pages.xray.dns.enableDesc")}
									controlId="dns-enable"
								>
									{(id) => (
										<Switch id={id} isChecked={dnsEnabled} onChange={(e) => {
												const checked = e.target.checked;
												const newConfig = {
													...form.getValues("config"),
												};
												if (checked) {
													newConfig.dns =
														newConfig.dns || createDefaultDnsConfig();
													newConfig.fakedns = Array.isArray(newConfig.fakedns)
														? newConfig.fakedns
														: [];
													setDnsServers(newConfig.dns?.servers || []);
													setFakeDns(newConfig.fakedns || []);
												} else {
													delete newConfig.dns;
													delete newConfig.fakedns;
													setDnsServers([]);
													setFakeDns([]);
												}
												setDnsEnabledState(checked);
												form.setValue("config", newConfig, {
													shouldDirty: true,
												});
											}} />
									)}
								</SettingRow>
								{dnsEnabled && (
									<>
										<SettingRow
											label={t("pages.xray.dns.tag")}
											description={t("pages.xray.dns.tagDesc")}
											controlId="dns-tag"
										>
											{(id) => (
												<Controller
													name="config.dns.tag"
													control={form.control}
													render={({ field }) => (
														<Input id={id} size="sm" value={field.value ?? ""} onChange={(event) =>
																field.onChange(event.target.value)
															} placeholder="dns_inbound" className="max-w-[240px]" />
													)}
												/>
											)}
										</SettingRow>
										<SettingRow
											label={t("pages.xray.dns.clientIp")}
											description={t("pages.xray.dns.clientIpDesc")}
											controlId="dns-client-ip"
										>
											{(id) => (
												<Controller
													name="config.dns.clientIp"
													control={form.control}
													render={({ field }) => (
														<Input id={id} size="sm" value={field.value ?? ""} onChange={(event) =>
																field.onChange(event.target.value)
															} placeholder="1.1.1.1" className="max-w-[240px]" />
													)}
												/>
											)}
										</SettingRow>
										<SettingRow
											label={t("pages.xray.dns.strategy")}
											description={t("pages.xray.dns.strategyDesc")}
											controlId="dns-strategy"
										>
											{(id) => (
												<Controller
													name="config.dns.queryStrategy"
													control={form.control}
													render={({ field }) => (
														<Select id={id} size="sm" value={field.value ?? "UseIP"} onChange={(event) =>
																field.onChange(event.target.value)
															} className="max-w-[220px]">
															{DNS_STRATEGY_OPTIONS.map((strategy) => (
																<option key={strategy} value={strategy}>
																	{strategy}
																</option>
															))}
														</Select>
													)}
												/>
											)}
										</SettingRow>
										<SettingRow
											label={t("pages.xray.dns.disableCache")}
											description={t("pages.xray.dns.disableCacheDesc")}
											controlId="dns-disable-cache"
										>
											{(id) => (
												<Controller
													name="config.dns.disableCache"
													control={form.control}
													render={({ field }) => (
														<Switch id={id} isChecked={Boolean(field.value)} onChange={(event) =>
																field.onChange(event.target.checked)
															} />
													)}
												/>
											)}
										</SettingRow>
										<SettingRow
											label={t("pages.xray.dns.disableFallback")}
											description={t("pages.xray.dns.disableFallbackDesc")}
											controlId="dns-disable-fallback"
										>
											{(id) => (
												<Controller
													name="config.dns.disableFallback"
													control={form.control}
													render={({ field }) => (
														<Switch id={id} isChecked={Boolean(field.value)} onChange={(event) =>
																field.onChange(event.target.checked)
															} />
													)}
												/>
											)}
										</SettingRow>
										<SettingRow
											label={t("pages.xray.dns.disableFallbackIfMatch")}
											description={t(
												"pages.xray.dns.disableFallbackIfMatchDesc",
											)}
											controlId="dns-disable-fallback-match"
										>
											{(id) => (
												<Controller
													name="config.dns.disableFallbackIfMatch"
													control={form.control}
													render={({ field }) => (
														<Switch id={id} isChecked={Boolean(field.value)} onChange={(event) =>
																field.onChange(event.target.checked)
															} />
													)}
												/>
											)}
										</SettingRow>
										<SettingRow
											label={t("pages.xray.dns.enableParallelQuery")}
											description={t("pages.xray.dns.enableParallelQueryDesc")}
											controlId="dns-parallel-query"
										>
											{(id) => (
												<Controller
													name="config.dns.enableParallelQuery"
													control={form.control}
													render={({ field }) => (
														<Switch id={id} isChecked={Boolean(field.value)} onChange={(event) =>
																field.onChange(event.target.checked)
															} />
													)}
												/>
											)}
										</SettingRow>
										<SettingRow
											label={t("pages.xray.dns.useSystemHosts")}
											description={t("pages.xray.dns.useSystemHostsDesc")}
											controlId="dns-system-hosts"
										>
											{(id) => (
												<Controller
													name="config.dns.useSystemHosts"
													control={form.control}
													render={({ field }) => (
														<Switch id={id} isChecked={Boolean(field.value)} onChange={(event) =>
																field.onChange(event.target.checked)
															} />
													)}
												/>
											)}
										</SettingRow>
									</>
								)}
							</SettingsSection>
							{dnsEnabled && (
								<div className="flex flex-col items-stretch gap-3">
									<ResourceListCard
										title={t("DNS")}
										summaryItems={[
											{
												label: t("total"),
												value: dnsServers.length,
											},
											{
												label: t("pages.xray.dns.domains"),
												value: dnsRows.reduce(
													(total, row) =>
														total +
														(typeof row.dns === "object"
															? toChipList(row.dns.domains).length
															: 0),
													0,
												),
												colorScheme: "blue",
											},
										]}
										actions={
											<div className="flex flex-row items-center gap-2 flex-wrap justify-end">
												<Button leftIcon={<AddIconStyled />} {...compactActionButtonProps} onClick={addDnsServer}>
													{t("pages.xray.dns.add")}
												</Button>
												<Button size="xs" variant="outline" onClick={onDnsPresetsOpen}>
													{t("pages.xray.dns.presets")}
												</Button>
											</div>
										}
									/>
									<DataTable
										data={dnsRows}
										columns={dnsColumns}
										getRowId={(row) => String(row.index)}
										rowActions={dnsActions}
										actionsDisplay="menu"
										actionsColumnWidth="52px"
										emptyState={t("emptyDnsDesc")}
										ariaLabel={t("DNS")}
									/>
								</div>
							)}
							{dnsEnabled && (
								<div className="flex flex-col items-stretch gap-3">
									<ResourceListCard
										title={t("pages.xray.fakedns.title")}
										summaryItems={[
											{
												label: t("total"),
												value: fakeDns.length,
											},
										]}
										actions={
											<Button leftIcon={<AddIconStyled />} {...compactActionButtonProps} onClick={addFakeDns}>
												{t("pages.xray.fakedns.add")}
											</Button>
										}
									/>
									<DataTable
										data={fakeDnsRows}
										columns={fakeDnsColumns}
										getRowId={(row) => String(row.index)}
										rowActions={fakeDnsActions}
										actionsDisplay="menu"
										actionsColumnWidth="52px"
										emptyState={t("emptyFakeDnsDesc")}
										ariaLabel={t("pages.xray.fakedns.title")}
									/>
								</div>
							)}
						</div>
					</div>
				)}
				{activeTab === 6 && (
					<div className="p-0 mt-3">
						<div className="flex flex-col gap-4 items-stretch">
							<ResourceListCard
								title={t("pages.xray.advancedJsonEditor")}
								summaryItems={[
									{
										label: t("pages.xray.advancedTemplate"),
										value: activeAdvancedJsonMode.label,
										colorScheme: "blue",
									},
									{
										label: t("status"),
										value: advancedJsonValid
											? t("jsonEditor.valid")
											: t("jsonEditor.invalid"),
										colorScheme: advancedJsonValid ? "green" : "red",
									},
								]}
								actions={
									<div className="flex flex-row items-center gap-2 flex-wrap justify-end">
										{advancedJsonModes.map((option) => {
											const selected = advSettings === option.value;
											return (
												<Button key={option.value} size="xs" variant={selected ? "solid" : "outline"} colorScheme={selected ? "primary" : "gray"} onClick={() => {
														setAdvSettings(option.value);
														setJsonKey((prev) => prev + 1);
													}}>
													{option.label}
												</Button>
											);
										})}
									</div>
								}
							/>
							<div className="relative w-full h-[calc(100vh_-_350px)] min-h-[400px]">
								<div className={cn(isFullScreen ? "w-screen" : "w-full", isFullScreen ? "h-screen" : "h-full", isFullScreen ? "fixed" : "relative", isFullScreen ? "top-0" : "top-auto", isFullScreen ? "left-0" : "left-auto", isFullScreen ? "z-[1000]" : "z-[auto]")}>
									<Suspense fallback={<Spinner size="sm" />}>
										<JsonEditor
											key={`advanced-${advSettings}-${jsonKey}`}
											label={activeAdvancedJsonMode.label}
											description={activeAdvancedJsonMode.description}
											json={advancedJsonValue}
											canonicalContext={advancedJsonContext}
											onValidityChange={setAdvancedJsonValid}
											toolbarActions={
												<IconButton aria-label={
														isFullScreen ? "Exit Full Screen" : "Full Screen"
													} icon={
														isFullScreen ? (
															<ExitFullScreenIconStyled />
														) : (
															<FullScreenIconStyled />
														)
													} onClick={toggleFullScreen} size="xs" variant="outline" />
											}
											onChange={(value) => {
												setAdvancedJson(value);
											}}
										/>
									</Suspense>
								</div>
								{isFullScreen && isMobile && (
									<Button size="sm" colorScheme="primary" onClick={toggleFullScreen} className="fixed bottom-4 left-[50%] [transform:translateX(-50%)] z-[1102]">
										{t("pages.xray.exitFullscreen")}
									</Button>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
			<Suspense fallback={null}>
				{isOutboundOpen && (
					<OutboundModal
						isOpen={isOutboundOpen}
						onClose={handleOutboundModalClose}
						mode={editingOutboundIndex !== null ? "edit" : "create"}
						initialOutbound={
							editingOutboundIndex !== null
								? canonicalOutbounds[editingOutboundIndex]
								: null
						}
						existingTags={availableOutboundTags}
						sourceTarget={selectedTarget}
						propagationBase={
							propagationBaseFor(
								"outbounds",
								editingOutboundIndex !== null
									? (canonicalOutbounds[editingOutboundIndex] ?? null)
									: null,
							) as Record<string, unknown> | null
						}
						onSubmitOutbound={handleOutboundSave}
					/>
				)}
				{isRuleOpen && (
					<RuleModal
						isOpen={isRuleOpen}
						mode={editingRuleIndex !== null ? "edit" : "create"}
						initialRule={
							editingRuleIndex !== null
								? canonicalRoutingRules[editingRuleIndex] || null
								: null
						}
						availableInboundTags={availableInboundTags}
						availableOutboundTags={outboundTagOptions}
						availableBalancerTags={availableBalancerTags}
						onTestOutbound={testOutboundByTag}
						outboundTestingByTag={outboundTestingByTag}
						sourceTarget={selectedTarget}
						propagationBase={
							propagationBaseFor(
								"routing.rules",
								editingRuleIndex !== null
									? (canonicalRoutingRules[editingRuleIndex] ?? null)
									: null,
							) as RoutingRule | null
						}
						onSubmit={handleRuleModalSubmit}
						onClose={handleRuleModalClose}
					/>
				)}
				{isRouteTestOpen && (
					<RouteTestModal
						isOpen={isRouteTestOpen}
						onClose={onRouteTestClose}
						rule={routeTestRule}
						target={selectedTarget}
						targetName={selectedTargetInfo?.name || selectedTarget || "master"}
						isMasterTarget={isMasterTarget}
						config={form.getValues("config")}
					/>
				)}
				{isReverseOpen && (
					<ReverseModal
						isOpen={isReverseOpen}
						onClose={handleReverseModalClose}
						mode={editingReverseIndex !== null ? "edit" : "create"}
						initialReverse={editingReverseInitial}
						inboundTags={availableInboundTags}
						outboundTags={availableOutboundTags}
						outboundOptions={outboundTagOptions}
						vlessInboundTags={vlessInboundTags}
						vlessOutboundTags={vlessOutboundTags}
						vlessOutboundOptions={vlessOutboundTagOptions}
						vlessOutboundDetails={vlessOutboundDetails}
						existingTags={existingReverseTags}
						reverseCount={reverseData.length}
						onTestOutbound={testOutboundByTag}
						outboundTestingByTag={outboundTestingByTag}
						onSubmit={handleReverseSubmit}
					/>
				)}
				{isWarpOpen && (
					<WarpModal
						isOpen={isWarpOpen}
						onClose={handleWarpModalClose}
						initialOutbound={warpOutbound}
						onSave={handleWarpSave}
						onDelete={handleWarpDelete}
					/>
				)}
				{isNordOpen && (
					<NordVPNModal
						isOpen={isNordOpen}
						onClose={handleNordModalClose}
						initialOutbounds={getOutbounds()}
						onSave={handleNordSave}
						onDelete={handleNordDelete}
					/>
				)}
				{isMullvadOpen && (
					<MullvadModal
						isOpen={isMullvadOpen}
						onClose={onMullvadClose}
						initialTag={mullvadEditTag}
						targetID={selectedTarget}
						canPing={!isMasterTarget}
						initialOutbounds={getOutbounds()}
						onSave={handleMullvadSave}
						onDelete={handleNordDelete}
					/>
				)}
				{isOutboundSubsOpen && (
					<OutboundSubscriptionsModal
						isOpen={isOutboundSubsOpen}
						onClose={onOutboundSubsClose}
						onChanged={async () => {
							await fetchActiveSubscriptionOutbounds();
							await fetchOutboundsTraffic();
						}}
					/>
				)}
				{isTorProxyOpen && (
					<TorProxyModal
						isOpen={isTorProxyOpen}
						isLoading={isApplyingTorProxy}
						isMasterTarget={isMasterTarget}
						existingTags={availableOutboundTags}
						onClose={onTorProxyClose}
						onSubmit={addTorOutbound}
					/>
				)}
				{isWindscribeProxyOpen && (
					<WindscribeProxyModal
						isOpen={isWindscribeProxyOpen}
						isLoading={isApplyingWindscribeProxy}
						isMasterTarget={isMasterTarget}
						targetID={selectedTarget}
						existingTags={availableOutboundTags}
						onClose={onWindscribeProxyClose}
						onSubmit={addWindscribeOutbound}
					/>
				)}
				{isPsiphonProxyOpen && (
					<PsiphonProxyModal
						isOpen={isPsiphonProxyOpen}
						isLoading={isApplyingPsiphonProxy}
						isMasterTarget={isMasterTarget}
						targetID={selectedTarget}
						existingTags={availableOutboundTags}
						onClose={onPsiphonProxyClose}
						onSubmit={addPsiphonOutbounds}
					/>
				)}
				{isBalancerOpen && (
					<BalancerModal
						isOpen={isBalancerOpen}
						onClose={handleBalancerModalClose}
						mode={editingBalancerIndex !== null ? "edit" : "create"}
						initialBalancer={
							editingBalancerIndex !== null
								? {
										tag: balancersData[editingBalancerIndex]?.tag ?? "",
										strategy:
											balancersData[editingBalancerIndex]?.strategy ?? "random",
										selector:
											balancersData[editingBalancerIndex]?.selector ?? [],
										fallbackTag:
											balancersData[editingBalancerIndex]?.fallbackTag ?? "",
									}
								: null
						}
						outboundTags={availableOutboundTags}
						outboundOptions={outboundTagOptions}
						excludedOutboundTags={excludedBalancerOutboundTags}
						onTestOutbound={testOutboundByTag}
						outboundTestingByTag={outboundTestingByTag}
						existingTags={availableBalancerTags
							.map((tag) => tag.trim())
							.filter(
								(tag) =>
									tag &&
									tag !==
										(editingBalancerIndex !== null
											? balancersData[editingBalancerIndex]?.tag
											: ""),
							)}
						sourceTarget={selectedTarget}
						propagationBase={
							propagationBaseFor(
								"balancers",
								editingBalancerIndex !== null
									? (getBalancers()[editingBalancerIndex] ?? null)
									: null,
							) as Record<string, unknown> | null
						}
						onSubmit={handleBalancerSubmit}
					/>
				)}
				{isDnsOpen && (
					<DnsModal
						isOpen={isDnsOpen}
						onClose={handleDnsModalClose}
						form={form}
						setDnsServers={setDnsServers}
						dnsIndex={editingDnsIndex}
						currentDnsData={
							editingDnsIndex !== null ? dnsServers[editingDnsIndex] : null
						}
					/>
				)}
				{isDnsPresetsOpen && (
					<DnsPresetsModal
						isOpen={isDnsPresetsOpen}
						onClose={onDnsPresetsClose}
						onSelectPreset={applyDnsPreset}
					/>
				)}
				{isFakeDnsOpen && (
					<FakeDnsModal
						isOpen={isFakeDnsOpen}
						onClose={handleFakeDnsModalClose}
						form={form}
						setFakeDns={setFakeDns}
						fakeDnsIndex={editingFakeDnsIndex}
						currentFakeDnsData={
							editingFakeDnsIndex !== null ? fakeDns[editingFakeDnsIndex] : null
						}
					/>
				)}
			</Suspense>
			<ConfirmDialog
				isOpen={Boolean(deleteWarning)}
				onClose={() => setDeleteWarning(null)}
				onConfirm={() => {
					deleteWarning?.onConfirm();
					setDeleteWarning(null);
				}}
				title={t("pages.xray.propagate.deleteTitle")}
				description={deleteWarning?.description ?? ""}
				colorScheme="red"
			/>
			<ConfirmDialog
				isOpen={Boolean(outboundReset)}
				onClose={() => setOutboundReset(null)}
				onConfirm={confirmOutboundTrafficReset}
				title={t("pages.xray.outbound.resetTraffic")}
				description={
					outboundReset?.index === -1
						? t("pages.xray.outbound.resetTrafficScopeConfirm")
						: t("pages.xray.outbound.resetTrafficConfirm", {
								tag: outboundData[outboundReset?.index ?? -1]?.tag ?? "",
							})
				}
				confirmLabel={t("reset")}
			/>
		</div>
	);
};

export default CoreSettingsPage;
