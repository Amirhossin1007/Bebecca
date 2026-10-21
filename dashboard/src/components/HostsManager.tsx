import type { SortingState } from "@tanstack/react-table";
import { buildSortOptions, DataTableSortMenu } from "components/ui/DataTableSortMenu";
import { FormControl, FormErrorMessage, FormHelperText, FormLabel } from "components/shadcn/field";
import { Popover, PopoverArrow, PopoverBody, PopoverCloseButton, PopoverContent, PopoverTrigger } from "components/shadcn/popover";
import { Portal } from "components/shadcn/portal";
import { Badge, Tag } from "components/shadcn/badge";
import { useToast } from "components/shadcn/toast";
import { Input, InputGroup, InputRightElement } from "components/shadcn/input";
import { Button } from "components/shadcn/button";
import { Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel } from "components/shadcn/accordion";
import { Card } from "components/shadcn/card";
import { Checkbox, Switch } from "components/shadcn/selection";
import { Spinner } from "components/shadcn/feedback";
import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "components/shadcn/tabs";
import { Tooltip } from "components/shadcn/tooltip";
import { MenuItem } from "components/shadcn/menu";
import { withClass } from "components/shadcn/icon";
import { cn } from "lib/cn";
import {
	ArrowPathIcon,
	CheckCircleIcon,
	InformationCircleIcon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import {
	proxyALPN,
	proxyFingerprint,
	proxyHostSecurity,
} from "constants/Proxies";
import { fetchInbounds, useDashboard } from "contexts/DashboardContext";
import { type HostsSchema, useHosts } from "contexts/HostsContext";
import { type NodeType, useNodesQuery } from "contexts/NodesContext";
import {
	type FC,
	lazy,
	type ReactNode,
	type RefObject,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { EntityNotePanel } from "components/EntityNotePanel";
import { fetch as apiFetch } from "service/http";
import {
	cloneFinalMask,
	type FinalMaskObject,
	finalMaskValidationError,
	getFinalMaskCapabilities,
	hostFinalMaskValue,
	isFinalMaskObject,
	sanitizeFinalMask,
} from "utils/finalmask";
import { getHostFormFields } from "utils/hostFormFields";
import { hostClientSettingsError, parseHostClientSettings } from "utils/hostClientSettings";
import { HostClientSettingsEditor } from "./HostClientSettingsEditor";
import {
	DEFAULT_SEARCH_MATCH_OPTIONS,
	matchesAnySearch,
} from "utils/searchMatch";
import { generateErrorMessage } from "utils/toastHandler";
import { AppleEmojiText } from "./common/AppleEmojiText";
import { DeleteIcon } from "./common/DeleteIcon";
import {
	MultiValueAutocomplete,
	type MultiValueAutocompleteOption,
} from "./common/MultiValueAutocomplete";
import { NumericInput } from "./common/NumericInput";
import { SearchableTagSelect } from "./common/SearchableTagSelect";
import { SearchInput } from "./common/SearchInput";
import { DeleteConfirmDialog } from "./dialogs/ConfirmDialog";
import {
	DataTable,
	type DataTableColumn,
	type DataTableRowAction,
	ResourceListCard,
	ResourceRefreshButton,
	type ResourceSummaryItem,
} from "./ui";
import {
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
	XrayModalHeader,
} from "./xray/XrayDialog";

const FinalMaskEditor = lazy(async () => ({
	default: (await import("./FinalMaskEditor")).FinalMaskEditor,
}));
const JsonEditor = lazy(async () => ({
	default: (await import("./JsonEditor")).JsonEditor,
}));

type HostData = {
	id: number | null;
	remark: string;
	address: string;
	dns_primary: string;
	dns_secondary: string;
	address_options: string;
	address_selection_mode: string;
	address_ttl_seconds: number | null;
	port: number | null;
	path: string;
	sni: string;
	sni_options: string;
	sni_selection_mode: string;
	sni_ttl_seconds: number | null;
	host: string;
	host_options: string;
	host_selection_mode: string;
	host_ttl_seconds: number | null;
	mux_enable: boolean;
	allowinsecure: boolean;
	is_disabled: boolean;
	fragment_setting: string;
	noise_setting: string;
	finalmask: FinalMaskObject | null;
	client_settings: string;
	random_user_agent: boolean;
	security: string;
	alpn: string;
	fingerprint: string;
	verify_peer_cert_by_name: string;
	pinned_peer_cert_sha256: string;
	use_sni_as_host: boolean;
};

const coerceHostValue = <Key extends keyof HostData>(
	key: Key,
	value: unknown,
	currentData: HostData,
): HostData[Key] => {
	if (
		key === "port" ||
		key === "address_ttl_seconds" ||
		key === "sni_ttl_seconds" ||
		key === "host_ttl_seconds"
	) {
		if (value === null || value === "") {
			return null as HostData[Key];
		}
		const numeric = Number(value);
		return Number.isFinite(numeric)
			? (numeric as HostData[Key])
			: (currentData[key] as HostData[Key]);
	}
	if (key === "id") {
		if (value === null || value === "") {
			return null as HostData[Key];
		}
		const numeric = Number(value);
		return Number.isFinite(numeric)
			? (numeric as HostData[Key])
			: (currentData.id as HostData[Key]);
	}
	if (
		key === "mux_enable" ||
		key === "allowinsecure" ||
		key === "is_disabled" ||
		key === "random_user_agent" ||
		key === "use_sni_as_host"
	) {
		return Boolean(value) as HostData[Key];
	}
	if (
		key === "address_options" ||
		key === "sni_options" ||
		key === "host_options"
	) {
		if (Array.isArray(value)) {
			return rotationOptionsToText(
				value.filter((item): item is string => typeof item === "string"),
			) as HostData[Key];
		}
		return String(value ?? "") as HostData[Key];
	}
	if (
		key === "address_selection_mode" ||
		key === "sni_selection_mode" ||
		key === "host_selection_mode"
	) {
		return normalizeRotationMode(String(value ?? "")) as HostData[Key];
	}
	if (key === "finalmask") {
		return (
			isFinalMaskObject(value)
				? cloneFinalMask(value)
				: value === null
					? null
					: currentData.finalmask
		) as HostData[Key];
	}
	if (key === "client_settings") {
		return (typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)) as HostData[Key];
	}
	return (value ?? "") as HostData[Key];
};

const EMPTY_HOST_DATA: HostData = {
	id: null,
	remark: "",
	address: "",
	dns_primary: "1.1.1.1",
	dns_secondary: "8.8.8.8",
	address_options: "",
	address_selection_mode: "random",
	address_ttl_seconds: null,
	port: null,
	path: "",
	sni: "",
	sni_options: "",
	sni_selection_mode: "random",
	sni_ttl_seconds: null,
	host: "",
	host_options: "",
	host_selection_mode: "random",
	host_ttl_seconds: null,
	mux_enable: false,
	allowinsecure: false,
	is_disabled: false,
	fragment_setting: "",
	noise_setting: "",
	finalmask: null,
	client_settings: "{}",
	random_user_agent: false,
	security: "inbound_default",
	alpn: "",
	fingerprint: "",
	verify_peer_cert_by_name: "",
	pinned_peer_cert_sha256: "",
	use_sni_as_host: false,
};

type HostState = {
	uid: string;
	inboundTag: string;
	initialInboundTag: string;
	data: HostData;
	original: HostData;
};

type InboundOption = {
	label: string;
	value: string;
	protocol: string;
	network: string;
	headerType?: string;
	alpn?: string;
	tls?: string;
	flow?: string;
	proxyNetwork?: string;
	port?: number;
	validationError?: string;
};

const profileHostNameError = (protocol: string | undefined, value: string) => {
	const name = value.trim();
	if (!name) return null;
	if (protocol === "wireguard") {
		if (name.length > 15) return "hostsPage.profileName.wireguardLength";
		if (!/^[A-Za-z0-9_]+$/.test(name)) {
			return "hostsPage.profileName.wireguardCharacters";
		}
	}
	if (protocol === "openvpn" && !/^[A-Za-z0-9._-]+$/.test(name)) {
		return "hostsPage.profileName.openvpnCharacters";
	}
	return null;
};

type CreateHostValues = HostData & {
	inboundTag: string;
};

const emptyCreateHostValues = (inboundTag: string): CreateHostValues => ({
	...EMPTY_HOST_DATA,
	inboundTag,
});

const EditIcon = withClass(PencilIcon, "w-4 h-4");

const AddIcon = withClass(PlusIcon, "w-4 h-4");

const InfoIcon = withClass(InformationCircleIcon, "w-4 h-4 text-gray-400 cursor-pointer");

const DYNAMIC_TOKENS: Array<{ token: string; labelKey: string }> = [
	{ token: "{SERVER_IP}", labelKey: "hostsDialog.currentServer" },
	{ token: "{SERVER_IPV6}", labelKey: "hostsDialog.currentServerv6" },
	{ token: "{USERNAME}", labelKey: "hostsDialog.username" },
	{ token: "{user_id}", labelKey: "hostsDialog.userId" },
	{ token: "{DATA_USAGE}", labelKey: "hostsDialog.dataUsage" },
	{ token: "{DATA_LEFT}", labelKey: "hostsDialog.remainingData" },
	{ token: "{DATA_LIMIT}", labelKey: "hostsDialog.dataLimit" },
	{ token: "{DAYS_LEFT}", labelKey: "hostsDialog.remainingDays" },
	{ token: "{EXPIRE_DATE}", labelKey: "hostsDialog.expireDate" },
	{ token: "{JALALI_EXPIRE_DATE}", labelKey: "hostsDialog.jalaliExpireDate" },
	{ token: "{TIME_LEFT}", labelKey: "hostsDialog.remainingTime" },
	{ token: "{STATUS_TEXT}", labelKey: "hostsDialog.statusText" },
	{ token: "{STATUS_EMOJI}", labelKey: "hostsDialog.statusEmoji" },
	{ token: "{PROTOCOL}", labelKey: "hostsDialog.proxyProtocol" },
	{ token: "{TRANSPORT}", labelKey: "hostsDialog.proxyMethod" },
];

type RotationControlsProps = {
	mode: string;
	ttl: number | null;
	onModeChange: (value: string) => void;
	onTTLChange: (value: number | null) => void;
};

const RotationControls: FC<RotationControlsProps> = ({
	mode,
	ttl,
	onModeChange,
	onTTLChange,
}) => {
	const { t } = useTranslation();
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
			<FormControl>
				<FormLabel className="text-[0.75rem] text-gray-500 mb-1">
					{t("hostsDialog.rotationMode")}
				</FormLabel>
				<SearchableTagSelect
					size="sm"
					value={mode}
					options={[
						{
							value: "random",
							label: t("inbounds.randomPort"),
						},
						{ value: "ttl", label: t("hostsDialog.rotationTTL") },
					]}
					placeholder={t("hostsDialog.rotationMode")}
					onChange={(value) => onModeChange(String(value))}
				/>
			</FormControl>
			<FormControl>
				<FormLabel className="text-[0.75rem] text-gray-500 mb-1">
					{t("hostsDialog.rotationTTLSeconds")}
				</FormLabel>
				<NumericInput size="sm" value={ttl ?? ""} min={1} max={2592000} fieldProps={{ className: "[placeholder:120]" }} disabled={mode !== "ttl"} onChange={(_, num) => onTTLChange(Number.isNaN(num) ? null : num)} />
			</FormControl>
		</div>
	);
};

const shortNodeName = (name?: string | null) => {
	const trimmed = (name ?? "").trim();
	if (!trimmed) return "Node";
	return trimmed.length > 5 ? `${trimmed.slice(0, 5)}...` : trimmed;
};

const getNodeAddressOptions = (
	nodes?: NodeType[],
): MultiValueAutocompleteOption[] =>
	(nodes ?? [])
		.filter((node) => node.status !== "disabled")
		.reduce<MultiValueAutocompleteOption[]>((options, node) => {
			const address =
				typeof node.address === "string" ? node.address.trim() : "";
			if (!address) return options;
			const fullName = String(node.name ?? "").trim();
			const labelName = shortNodeName(fullName);
			options.push({
				label: `${labelName} - ${address}`,
				title: fullName ? `${fullName} - ${address}` : address,
				value: address,
			});
			return options;
		}, []);

const alpnAutocompleteOptions = proxyALPN
	.map((option) => option.value)
	.filter(Boolean);

const inboundPortPlaceholder = (inbound?: InboundOption) =>
	inbound?.port ? `Inbound default: ${inbound.port}` : "Inherited from inbound";

const inheritedHostValue = (value: string, fallback?: string) =>
	["", "none", "default", "inbound_default", "inbound-default"].includes(
		value.trim().toLowerCase(),
	)
		? fallback
		: value;

const finalMaskCapabilitiesForHost = (
	data: HostData,
	inbound?: InboundOption,
) =>
	getFinalMaskCapabilities({
		protocol: inbound?.protocol,
		network: inbound?.network,
		alpn: inheritedHostValue(data.alpn, inbound?.alpn),
		security: inheritedHostValue(data.security, inbound?.tls),
		flow: inbound?.flow,
		proxyNetwork: inbound?.proxyNetwork,
	});

const fitHostToInbound = (
	data: HostData,
	inbound?: InboundOption,
): HostData => {
	const capabilities = finalMaskCapabilitiesForHost(data, inbound);
	return {
		...data,
		finalmask: sanitizeFinalMask(data.finalmask, capabilities),
		mux_enable: capabilities.mux && data.mux_enable,
	};
};

const DynamicTokensPopover: FC = () => {
	const { t } = useTranslation();

	return (
		<Popover isLazy placement="right">
			<PopoverTrigger>
				<div className="-mt-1">
					<InfoIcon />
				</div>
			</PopoverTrigger>
			<Portal>
				<PopoverContent className="max-w-[20rem] text-[0.75rem]">
					<PopoverArrow />
					<PopoverCloseButton />
					<PopoverBody>
						<div className="pr-5 leading-[1.4]">
							<p className="mb-2">{t("hostsDialog.desc")}</p>
							{DYNAMIC_TOKENS.map(({ token, labelKey }) => (
								<p key={token} className="mt-1">
									<Badge className="mr-2">{token}</Badge>
									<AppleEmojiText>{t(labelKey)}</AppleEmojiText>
								</p>
							))}
						</div>
					</PopoverBody>
				</PopoverContent>
			</Portal>
		</Popover>
	);
};

const createUid = () =>
	`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeString = (value: string | null | undefined) =>
	(value ?? "").trim();

const normalizeRotationMode = (value: string | null | undefined) =>
	value === "ttl" ? "ttl" : "random";

const rotationOptionsToText = (values: string[] | null | undefined) =>
	(values ?? [])
		.map((value) => value.trim())
		.filter(Boolean)
		.join("\n");

const rotationTextToOptions = (value: string) =>
	value
		.split(/\r?\n|,/)
		.map((item) => item.trim())
		.filter(Boolean);

const mergeRotationValue = (
	value: string | null | undefined,
	options: string[] | null | undefined,
) =>
	rotationTextToOptions([value ?? "", ...(options ?? [])].join(",")).join(", ");

const hasMultipleRotationValues = (value: string) =>
	rotationTextToOptions(value).length > 1;

const normalizeBoolean = (
	value: boolean | null | undefined,
	fallback = false,
) => (typeof value === "boolean" ? value : fallback);

const certificatePinsValid = (value: string) =>
	!value.trim() ||
	value
		.split(",")
		.every((pin) => /^[0-9a-f]{64}$/i.test(pin.trim().replaceAll(":", "")));

const CertificateFingerprintField: FC<{
	data: Pick<HostData, "address" | "sni" | "host" | "verify_peer_cert_by_name">;
	port: number;
	value: string;
	onChange: (value: string) => void;
}> = ({ data, port, value, onChange }) => {
	const { t } = useTranslation();
	const toast = useToast();
	const [isGenerating, setIsGenerating] = useState(false);
	const address = rotationTextToOptions(data.address)[0] ?? "";
	const serverName =
		rotationTextToOptions(data.sni)[0] ??
		rotationTextToOptions(data.host)[0] ??
		rotationTextToOptions(data.verify_peer_cert_by_name)[0] ??
		address;

	const generate = async () => {
		setIsGenerating(true);
		try {
			const result = await apiFetch<{ fingerprint: string }>(
				"/hosts/certificate-fingerprint",
				{
					method: "POST",
					body: { address, port, server_name: serverName },
				},
			);
			onChange(result.fingerprint);
			toast({
				title: t("hostsDialog.certificateFingerprintGenerated"),
				status: "success",
				isClosable: true,
				position: "top",
			});
		} catch (error) {
			generateErrorMessage(error, toast);
		} finally {
			setIsGenerating(false);
		}
	};

	return (
		<FormControl isInvalid={!certificatePinsValid(value)}>
			<FormLabel>{t("hostsDialog.pinnedPeerCertSha256")}</FormLabel>
			<div className="flex flex-row items-stretch gap-2">
				<Input dir="ltr" value={value} placeholder={t("hostsDialog.pinnedPeerCertSha256Hint")} onChange={(event) => onChange(event.target.value)} className="min-w-0!" />
				<Button size="sm" variant="outline" disabled={!address} loading={isGenerating} onClick={generate} className="shrink-0 self-center">{<ArrowPathIcon className="w-14" />}
					{t("hostsDialog.generateCertificateFingerprint")}
				</Button>
			</div>
		</FormControl>
	);
};

const normalizeHostData = (host: HostsSchema[string][number]): HostData => ({
	id: host.id ?? null,
	remark: host.remark ?? "",
	address: mergeRotationValue(host.address, host.address_options),
	dns_primary: normalizeString(host.dns_primary) || "1.1.1.1",
	dns_secondary: normalizeString(host.dns_secondary) || "8.8.8.8",
	address_options: "",
	address_selection_mode: normalizeRotationMode(host.address_selection_mode),
	address_ttl_seconds: host.address_ttl_seconds ?? null,
	port: host.port ?? null,
	path: normalizeString(host.path),
	sni: mergeRotationValue(host.sni, host.sni_options),
	sni_options: "",
	sni_selection_mode: normalizeRotationMode(host.sni_selection_mode),
	sni_ttl_seconds: host.sni_ttl_seconds ?? null,
	host: mergeRotationValue(host.host, host.host_options),
	host_options: "",
	host_selection_mode: normalizeRotationMode(host.host_selection_mode),
	host_ttl_seconds: host.host_ttl_seconds ?? null,
	mux_enable: normalizeBoolean(host.mux_enable),
	allowinsecure: normalizeBoolean(host.allowinsecure),
	is_disabled: normalizeBoolean(host.is_disabled, false),
	fragment_setting: "",
	noise_setting: "",
	finalmask: hostFinalMaskValue(
		host.finalmask,
		normalizeString(host.fragment_setting),
		normalizeString(host.noise_setting),
	),
	client_settings: JSON.stringify(host.client_settings ?? {}, null, 2),
	random_user_agent: normalizeBoolean(host.random_user_agent),
	security: host.security ?? "inbound_default",
	alpn: host.alpn ?? "",
	fingerprint: host.fingerprint ?? "",
	verify_peer_cert_by_name: host.verify_peer_cert_by_name ?? "",
	pinned_peer_cert_sha256: host.pinned_peer_cert_sha256 ?? "",
	use_sni_as_host: normalizeBoolean(host.use_sni_as_host),
});

const cloneHostData = (data: HostData): HostData => ({
	id: data.id ?? null,
	remark: data.remark,
	address: data.address,
	dns_primary: data.dns_primary,
	dns_secondary: data.dns_secondary,
	address_options: data.address_options,
	address_selection_mode: data.address_selection_mode,
	address_ttl_seconds: data.address_ttl_seconds ?? null,
	port: data.port ?? null,
	path: data.path,
	sni: data.sni,
	sni_options: data.sni_options,
	sni_selection_mode: data.sni_selection_mode,
	sni_ttl_seconds: data.sni_ttl_seconds ?? null,
	host: data.host,
	host_options: data.host_options,
	host_selection_mode: data.host_selection_mode,
	host_ttl_seconds: data.host_ttl_seconds ?? null,
	mux_enable: data.mux_enable,
	allowinsecure: data.allowinsecure,
	is_disabled: data.is_disabled,
	fragment_setting: data.fragment_setting,
	noise_setting: data.noise_setting,
	finalmask: cloneFinalMask(data.finalmask),
	client_settings: data.client_settings,
	random_user_agent: data.random_user_agent,
	security: data.security,
	alpn: data.alpn,
	fingerprint: data.fingerprint,
	verify_peer_cert_by_name: data.verify_peer_cert_by_name,
	pinned_peer_cert_sha256: data.pinned_peer_cert_sha256,
	use_sni_as_host: data.use_sni_as_host,
});

const serializeHostData = (data: HostData) => ({
	...data,
	client_settings: hostClientSettingsError(data.client_settings) ? data.client_settings : parseHostClientSettings(data.client_settings),
	id: data.id ?? null,
	port: data.port ?? null,
	path: normalizeString(data.path),
	sni: normalizeString(data.sni),
	host: normalizeString(data.host),
	address_options: rotationTextToOptions(data.address_options),
	address_selection_mode: normalizeRotationMode(data.address_selection_mode),
	address_ttl_seconds: data.address_ttl_seconds ?? null,
	sni_options: rotationTextToOptions(data.sni_options),
	sni_selection_mode: normalizeRotationMode(data.sni_selection_mode),
	sni_ttl_seconds: data.sni_ttl_seconds ?? null,
	host_options: rotationTextToOptions(data.host_options),
	host_selection_mode: normalizeRotationMode(data.host_selection_mode),
	host_ttl_seconds: data.host_ttl_seconds ?? null,
	fragment_setting: "",
	noise_setting: "",
	finalmask: data.finalmask,
});

const validateHostState = (
	inboundTag: string,
	data: HostData | CreateHostValues,
	inbound?: InboundOption,
): string[] => {
	const errors: string[] = [];
	if (!inboundTag.trim()) {
		errors.push("Inbound is required.");
	}
	if (!data.remark.trim()) {
		errors.push("Remark is required.");
	}
	const profileNameError = profileHostNameError(inbound?.protocol, data.remark);
	if (profileNameError) {
		errors.push(profileNameError);
	}
	if (
		!data.address.trim() &&
		rotationTextToOptions(data.address_options).length === 0
	) {
		errors.push("Address is required.");
	}
	if (data.port !== null) {
		const port = Number(data.port);
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			errors.push("Port must be a number between 1 and 65535.");
		}
	}
	const path = data.path.trim();
	if (path && !path.startsWith("/")) {
		errors.push("Path must start with /.");
	}
	if (!certificatePinsValid(data.pinned_peer_cert_sha256)) {
		errors.push(
			"Certificate pins must be comma-separated SHA-256 fingerprints.",
		);
	}
	const clientSettingsError = hostClientSettingsError(data.client_settings);
	if (clientSettingsError) errors.push(clientSettingsError);
	for (const [label, mode, ttl] of [
		["Address", data.address_selection_mode, data.address_ttl_seconds],
		["SNI", data.sni_selection_mode, data.sni_ttl_seconds],
		["Request Host", data.host_selection_mode, data.host_ttl_seconds],
	] as const) {
		if (mode === "ttl" && ttl !== null) {
			const numeric = Number(ttl);
			if (!Number.isInteger(numeric) || numeric < 1 || numeric > 2592000) {
				errors.push(`${label} TTL must be between 1 and 2592000 seconds.`);
			}
		}
	}
	for (const [label, value] of [
		["Primary DNS", data.dns_primary],
		["Secondary DNS", data.dns_secondary],
	] as const) {
		if (!value.trim()) {
			errors.push(`${label} is required.`);
		}
	}
	const finalMaskError = finalMaskValidationError(
		fitHostToInbound(data, inbound).finalmask,
	);
	if (finalMaskError) {
		errors.push(finalMaskError);
	}
	return errors;
};

const isHostDirty = (host: HostState) => {
	const current = serializeHostData(host.data);
	const original = serializeHostData(host.original);
	if (host.inboundTag !== host.initialInboundTag) {
		return true;
	}
	return JSON.stringify(current) !== JSON.stringify(original);
};

const formatHostForApi = (
	rawData: HostData,
	inbound?: InboundOption,
	fitToInbound = true,
): HostsSchema[string][number] => {
	const data = fitToInbound ? fitHostToInbound(rawData, inbound) : rawData;
	return {
		id: data.id ?? null,
		remark: data.remark.trim(),
		address: rotationTextToOptions(data.address).join(", "),
		dns_primary: data.dns_primary.trim(),
		dns_secondary: data.dns_secondary.trim(),
		address_options: [],
		address_selection_mode: normalizeRotationMode(data.address_selection_mode),
		address_ttl_seconds: data.address_ttl_seconds ?? null,
		port: data.port,
		path: data.path.trim() ? data.path.trim() : null,
		sni: rotationTextToOptions(data.sni).join(", ") || null,
		sni_options: [],
		sni_selection_mode: normalizeRotationMode(data.sni_selection_mode),
		sni_ttl_seconds: data.sni_ttl_seconds ?? null,
		host: rotationTextToOptions(data.host).join(", ") || null,
		host_options: [],
		host_selection_mode: normalizeRotationMode(data.host_selection_mode),
		host_ttl_seconds: data.host_ttl_seconds ?? null,
		mux_enable: data.mux_enable,
		allowinsecure: data.allowinsecure,
		is_disabled: data.is_disabled,
		fragment_setting: null,
		noise_setting: null,
		finalmask: cloneFinalMask(data.finalmask),
		client_settings: parseHostClientSettings(data.client_settings),
		random_user_agent: data.random_user_agent,
		security: data.security || "inbound_default",
		alpn: data.alpn || "",
		fingerprint: data.fingerprint || "",
		verify_peer_cert_by_name: data.verify_peer_cert_by_name.trim(),
		pinned_peer_cert_sha256: data.pinned_peer_cert_sha256.trim(),
		use_sni_as_host: data.use_sni_as_host,
	};
};

const sortHosts = (hosts: HostState[]) =>
	[...hosts].sort((a, b) => {
		const inboundDiff = a.inboundTag.localeCompare(b.inboundTag);
		if (inboundDiff !== 0) return inboundDiff;
		const leftID = a.data.id ?? Number.MAX_SAFE_INTEGER;
		const rightID = b.data.id ?? Number.MAX_SAFE_INTEGER;
		if (leftID !== rightID) return leftID - rightID;
		return a.data.remark.localeCompare(b.data.remark);
	});

const mapHostsToState = (hosts: HostsSchema): HostState[] => {
	const result: HostState[] = [];
	if (!hosts || typeof hosts !== "object") {
		return result;
	}
	Object.entries(hosts).forEach(([tag, hostList]) => {
		if (!Array.isArray(hostList)) {
			console.warn(`Host list for tag ${tag} is not an array:`, hostList);
			return;
		}
		hostList.forEach((host, index) => {
			try {
				const normalized = normalizeHostData(host);
				const persistentUid =
					normalized.id != null ? `host-${normalized.id}` : createUid();
				result.push({
					uid: persistentUid,
					inboundTag: tag,
					initialInboundTag: tag,
					data: cloneHostData(normalized),
					original: cloneHostData(normalized),
				});
			} catch (error) {
				console.error(
					`Failed to normalize host at index ${index} for tag ${tag}:`,
					error,
					host,
				);
			}
		});
	});
	return sortHosts(result);
};

const groupHostsByInbound = (
	items: HostState[],
	inboundOptions: InboundOption[],
	fitHostUid?: string,
): HostsSchema => {
	const grouped = new Map<string, HostState[]>();
	items.forEach((host) => {
		const list = grouped.get(host.inboundTag) ?? [];
		list.push(host);
		grouped.set(host.inboundTag, list);
	});
	const result: HostsSchema = {};
	grouped.forEach((value, key) => {
		result[key] = value.map((host) =>
			formatHostForApi(
				host.data,
				inboundOptions.find((option) => option.value === host.inboundTag),
				host.uid === fitHostUid,
			),
		);
	});
	return result;
};

const buildInboundPayload = (
	items: HostState[],
	inboundTags: Iterable<string>,
	inboundOptions: InboundOption[],
	fitHostUid?: string,
): Partial<HostsSchema> => {
	const grouped = groupHostsByInbound(items, inboundOptions, fitHostUid);
	const uniqueTags = Array.from(new Set(inboundTags));
	const payload: Partial<HostsSchema> = {};
	uniqueTags.forEach((tag) => {
		payload[tag] = grouped[tag] ?? [];
	});
	return payload;
};

const HostFormSection: FC<{
	title: string;
	description: string;
	badge?: string;
	children: ReactNode;
}> = ({ title, description, badge, children }) => (
	<section>
		<div className="flex flex-row items-center mb-1.5 gap-2 flex-wrap">
			<h3 className="text-[0.875rem] font-semibold">
				{title}
			</h3>
			{badge && (
				<Badge colorScheme="gray" variant="subtle" className="text-[10px] normal-case">
					{badge}
				</Badge>
			)}
		</div>
		<p className="mb-5 max-w-[48rem] text-[0.75rem] text-panel-text-muted">
			{description}
		</p>
		{children}
	</section>
);

const HostAdvancedSection: FC<{
	title: string;
	description: string;
	badge?: string;
	children: ReactNode;
}> = ({ title, description, badge, children }) => (
	<Accordion allowToggle>
		<AccordionItem className="border-0">
			<Card className="border-panel-border! rounded-xl bg-panel-surface overflow-hidden">
				<h3>
					<AccordionButton className="px-3 md:px-4 py-3 min-h-[48px] text-start hover:bg-panel-surface-muted aria-expanded:bg-panel-surface-muted">
						<AccordionIcon className="me-3 shrink-0" />
						<div className="flex flex-row items-center flex-1 min-w-0! gap-2 flex-wrap">
							<p className="text-[0.875rem] font-semibold leading-[1.375]">
								{title}
							</p>
							{badge && (
								<Badge colorScheme="gray" variant="subtle" className="text-[10px] normal-case">
									{badge}
								</Badge>
							)}
						</div>
					</AccordionButton>
				</h3>
				<AccordionPanel className="px-4 md:px-5 pt-4 pb-5 border-t border-panel-border!">
					<p className="mb-5 max-w-[48rem] text-[0.75rem] text-panel-text-muted">
						{description}
					</p>
					{children}
				</AccordionPanel>
			</Card>
		</AccordionItem>
	</Accordion>
);

const HostToggle: FC<{
	label: string;
	description: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	danger?: boolean;
}> = ({ label, description, checked: isChecked, onChange, danger = false }) => (
	<div className={cn("border rounded-lg px-4 py-3", danger && isChecked ? "border-orange-400!" : "")}>
		<div className="flex items-center justify-between gap-4">
			<div className="min-w-0!">
				<p className="text-[0.875rem] font-semibold">
					{label}
				</p>
				<p className="mt-1 text-[0.75rem] text-gray-500">
					{description}
				</p>
			</div>
			<Switch aria-label={label} checked={isChecked} onChange={(event) => onChange(event.target.checked)} className="shrink-0" />
		</div>
	</div>
);

type HostFormProps = {
	data: HostData;
	inboundTag: string;
	inboundOptions: InboundOption[];
	nodes?: NodeType[];
	initialFocusRef?: RefObject<HTMLInputElement>;
	onChange: <Key extends keyof HostData>(
		key: Key,
		value: HostData[Key],
	) => void;
	onChangeInbound: (value: string) => void;
};

const HostForm: FC<HostFormProps> = ({
	data,
	inboundTag,
	inboundOptions,
	nodes,
	initialFocusRef,
	onChange,
	onChangeInbound,
}) => {
	const { t } = useTranslation();
	const selectedInbound = useMemo(
		() => inboundOptions.find((option) => option.value === inboundTag),
		[inboundOptions, inboundTag],
	);
	const nodeAddressOptions = useMemo(
		() => getNodeAddressOptions(nodes),
		[nodes],
	);
	const isWireGuardInbound = selectedInbound?.protocol === "wireguard";
	const isProfileHostInbound =
		isWireGuardInbound || selectedInbound?.protocol === "openvpn";
	const isVirtualTunnelInbound = [
		"openvpn",
		"l2tp",
		"pptp",
		"ikev2",
		"anyconnect",
	].includes(selectedInbound?.protocol ?? "");
	const remarkError = profileHostNameError(
		selectedInbound?.protocol,
		data.remark,
	);
	const capabilities = finalMaskCapabilitiesForHost(data, selectedInbound);
	const sanitizedFinalMask = sanitizeFinalMask(data.finalmask, capabilities);
	const finalMaskError = finalMaskValidationError(sanitizedFinalMask);
	const maskCount =
		(sanitizedFinalMask?.tcp?.length ?? 0) +
		(sanitizedFinalMask?.udp?.length ?? 0) +
		(sanitizedFinalMask?.quicParams ? 1 : 0);
	const effectiveSecurity =
		inheritedHostValue(data.security, selectedInbound?.tls)
			?.trim()
			.toLowerCase() ?? "";
	const {
		showsRequestHost,
		showsRequestPath,
		showsSNI,
		showsALPN,
		showsFingerprint,
		showsCertificateVerification,
		supportsStreamSecurity,
		usesTLS,
	} = getHostFormFields(
		selectedInbound?.network,
		effectiveSecurity,
		selectedInbound?.headerType,
		selectedInbound?.protocol,
	);
	const hasAdvancedSettings =
		usesTLS || capabilities.supported || capabilities.mux || showsRequestHost;
	const transport = selectedInbound?.network.trim().toLowerCase() ?? "";
	const requestHostLabel =
		transport === "grpc"
			? t("inbounds.grpc.authority")
			: transport === "quic"
				? t("inbounds.quic.security")
				: t("hostsDialog.host");
	const requestPathLabel =
		transport === "grpc"
			? t("serviceName")
			: transport === "kcp"
				? t("inbounds.kcp.seed")
				: transport === "quic"
					? t("inbounds.quic.key")
					: t("hostsDialog.path");
	const requestPathPlaceholder = ["grpc", "kcp"].includes(transport)
		? ""
		: transport === "quic"
			? "none"
			: "/";

	return (
		<div className="flex flex-col gap-6 md:gap-8">
			<HostFormSection
				title={t("hostsPage.section.connection")}
				description={t("hostsPage.section.connectionDescription")}
				badge={t("hostsPage.required")}
			>
				<div className="flex flex-col items-stretch gap-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormControl required>
							<FormLabel>{t("hostsPage.inboundLabel")}</FormLabel>
							<SearchableTagSelect
								value={inboundTag}
								options={inboundOptions}
								placeholder={t("hostsPage.inboundLabel")}
								onChange={(value) => onChangeInbound(String(value))}
							/>
							<FormHelperText>{t("hostsPage.inboundHint")}</FormHelperText>
						</FormControl>
						<FormControl required isInvalid={Boolean(remarkError)}>
							<FormLabel>{t("hostsDialog.remark")}</FormLabel>
							<InputGroup>
								<Input ref={initialFocusRef} value={data.remark} maxLength={isWireGuardInbound ? 15 : undefined} placeholder={t("hostsPage.remarkPlaceholder")} onChange={(event) => onChange("remark", event.target.value)} />
								<InputRightElement className="w-auto pr-2 pointer-events-auto">
									{!isProfileHostInbound && <DynamicTokensPopover />}
								</InputRightElement>
							</InputGroup>
							{remarkError ? (
								<FormErrorMessage>{t(remarkError)}</FormErrorMessage>
							) : (
								<FormHelperText>{t("hostsPage.remarkHint")}</FormHelperText>
							)}
						</FormControl>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormControl required className={cn(isVirtualTunnelInbound ? "md:[grid-column:1_/_-1]" : "md:[grid-column:auto]")}>
							<FormLabel>{t("hostsDialog.address")}</FormLabel>
							<MultiValueAutocomplete
								value={data.address}
								options={nodeAddressOptions}
								placeholder={t("hostsDialog.addressPlaceholder")}
								onChange={(value) => onChange("address", value)}
								rightElement={<DynamicTokensPopover />}
							/>
							<FormHelperText>{t("hostsPage.addressHint")}</FormHelperText>
						</FormControl>
						{!isVirtualTunnelInbound && (
							<FormControl>
								<FormLabel>{t("port")}</FormLabel>
								<NumericInput
									value={data.port ?? ""}
									min={1}
									max={65535}
									allowMouseWheel
									fieldProps={{
										placeholder: inboundPortPlaceholder(selectedInbound),
									}}
									onChange={(_, num) =>
										onChange("port", Number.isNaN(num) ? null : num)
									}
								/>
								<FormHelperText>{t("hostsPage.portHint")}</FormHelperText>
							</FormControl>
						)}
					</div>

					{hasMultipleRotationValues(data.address) && (
						<RotationControls
							mode={data.address_selection_mode}
							ttl={data.address_ttl_seconds}
							onModeChange={(value) =>
								onChange("address_selection_mode", value)
							}
							onTTLChange={(value) => onChange("address_ttl_seconds", value)}
						/>
					)}

					{isWireGuardInbound && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormControl required>
								<FormLabel>{t("hostsDialog.dnsPrimary")}</FormLabel>
								<Input value={data.dns_primary} placeholder="1.1.1.1" onChange={(event) =>
										onChange("dns_primary", event.target.value)
									} />
							</FormControl>
							<FormControl required>
								<FormLabel>{t("hostsDialog.dnsSecondary")}</FormLabel>
								<Input value={data.dns_secondary} placeholder="8.8.8.8" onChange={(event) =>
										onChange("dns_secondary", event.target.value)
									} />
							</FormControl>
						</div>
					)}
				</div>
			</HostFormSection>

			{supportsStreamSecurity && (
				<HostFormSection
					title={t("hostsPage.section.security")}
					description={t("hostsPage.section.securityDescription")}
				>
					<div className="flex flex-col items-stretch gap-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormControl>
								<FormLabel>{t("hostsDialog.security")}</FormLabel>
								<SearchableTagSelect
									value={data.security}
									options={proxyHostSecurity.map((option) => ({
										value: option.value,
										label: option.title,
									}))}
									placeholder={t("hostsDialog.security")}
									onChange={(value) => onChange("security", String(value))}
								/>
							</FormControl>
							{showsSNI && (
								<FormControl>
									<FormLabel>{t("hostsDialog.sni")}</FormLabel>
									<MultiValueAutocomplete
										value={data.sni}
										placeholder={t("hostsDialog.sniPlaceholder")}
										onChange={(value) => onChange("sni", value)}
									/>
									<FormHelperText>{t("hostsPage.inheritHint")}</FormHelperText>
								</FormControl>
							)}
							{showsALPN && (
								<FormControl>
									<FormLabel>{t("hostsDialog.alpn")}</FormLabel>
									<MultiValueAutocomplete
										value={data.alpn}
										options={alpnAutocompleteOptions}
										placeholder={t("hostsDialog.alpnPlaceholder")}
										onChange={(value) => onChange("alpn", value)}
									/>
								</FormControl>
							)}
							{showsFingerprint && (
								<FormControl>
									<FormLabel>{t("hostsDialog.fingerprint")}</FormLabel>
									<SearchableTagSelect
										value={data.fingerprint}
										options={proxyFingerprint.map((option) => ({
											value: option.value,
											label: option.title,
										}))}
										placeholder={t("hostsDialog.fingerprint")}
										onChange={(value) => onChange("fingerprint", String(value))}
									/>
								</FormControl>
							)}
							{showsCertificateVerification && (
								<>
									<FormControl>
										<FormLabel>
											{t("hostsDialog.verifyPeerCertByName")}
										</FormLabel>
										<Input dir="ltr" value={data.verify_peer_cert_by_name} onChange={(event) =>
												onChange("verify_peer_cert_by_name", event.target.value)
											} />
									</FormControl>
									<CertificateFingerprintField
										data={data}
										port={data.port ?? selectedInbound?.port ?? 443}
										value={data.pinned_peer_cert_sha256}
										onChange={(value) =>
											onChange("pinned_peer_cert_sha256", value)
										}
									/>
								</>
							)}
							{showsRequestHost && (
								<FormControl>
									<FormLabel>{requestHostLabel}</FormLabel>
									<MultiValueAutocomplete
										value={data.host}
										placeholder={t("hostsDialog.hostPlaceholder")}
										onChange={(value) => onChange("host", value)}
										rightElement={<DynamicTokensPopover />}
									/>
									<FormHelperText>{t("hostsPage.inheritHint")}</FormHelperText>
								</FormControl>
							)}
							{showsRequestPath && (
								<FormControl>
									<FormLabel>{requestPathLabel}</FormLabel>
									<Input dir="ltr" value={data.path} placeholder={requestPathPlaceholder} onChange={(event) => onChange("path", event.target.value)} />
									{!["grpc", "kcp", "quic"].includes(transport) && (
										<FormHelperText>{t("hostsPage.pathHint")}</FormHelperText>
									)}
								</FormControl>
							)}
						</div>

						{((showsSNI && hasMultipleRotationValues(data.sni)) ||
							(showsRequestHost && hasMultipleRotationValues(data.host))) && (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{showsSNI && hasMultipleRotationValues(data.sni) && (
									<RotationControls
										mode={data.sni_selection_mode}
										ttl={data.sni_ttl_seconds}
										onModeChange={(value) =>
											onChange("sni_selection_mode", value)
										}
										onTTLChange={(value) => onChange("sni_ttl_seconds", value)}
									/>
								)}
								{showsRequestHost && hasMultipleRotationValues(data.host) && (
									<RotationControls
										mode={data.host_selection_mode}
										ttl={data.host_ttl_seconds}
										onModeChange={(value) =>
											onChange("host_selection_mode", value)
										}
										onTTLChange={(value) => onChange("host_ttl_seconds", value)}
									/>
								)}
							</div>
						)}
					</div>
				</HostFormSection>
			)}

			{!isVirtualTunnelInbound && hasAdvancedSettings && (
				<HostAdvancedSection
					title={t("hostsPage.section.advanced")}
					description={t("hostsPage.section.advancedDescription")}
					badge={
						maskCount
							? `${maskCount} ${t("hostsPage.configured")}`
							: t("hostsPage.optional")
					}
				>
					<div className="flex flex-col items-stretch gap-6">
						{capabilities.supported && (
							<div>
								<p className="mb-1 text-[0.875rem] font-semibold">
									{t("hostsDialog.finalMask")}
								</p>
								<p className="mb-4 text-[0.75rem] text-panel-text-muted">
									{t("hostsPage.section.finalMaskDescription")}
								</p>
								<Suspense fallback={<Spinner size="sm" />}>
									<FinalMaskEditor
										value={sanitizedFinalMask}
										onChange={(value) => onChange("finalmask", value)}
										capabilities={capabilities}
									/>
								</Suspense>
								{finalMaskError && (
									<p className="mt-3 text-[0.875rem] text-red-500">
										{finalMaskError}
									</p>
								)}
							</div>
						)}

						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							{usesTLS && (
								<HostToggle
									label={t("hostsDialog.allowinsecure")}
									description={t("hostsPage.allowInsecureHint")}
									checked={data.allowinsecure}
									danger
									onChange={(checked) => onChange("allowinsecure", checked)}
								/>
							)}
							{capabilities.mux && (
								<HostToggle
									label={t("hostsDialog.muxEnable")}
									description={t("hostsPage.muxHint")}
									checked={data.mux_enable}
									onChange={(checked) => onChange("mux_enable", checked)}
								/>
							)}
							{showsRequestHost && (
								<HostToggle
									label={t("hostsDialog.randomUserAgent")}
									description={t("hostsPage.randomUserAgentHint")}
									checked={data.random_user_agent}
									onChange={(checked) => onChange("random_user_agent", checked)}
								/>
							)}
							{showsSNI && showsRequestHost && (
								<HostToggle
									label={t("hostsDialog.useSniAsHost")}
									description={t("hostsPage.useSniAsHostHint")}
									checked={data.use_sni_as_host}
									onChange={(checked) => onChange("use_sni_as_host", checked)}
								/>
							)}
						</div>
					</div>
				</HostAdvancedSection>
			)}
			{supportsStreamSecurity && (
				<HostAdvancedSection title={t("hostsDialog.clientSettings")} description={t("hostsDialog.clientSettingsHint")}>
					<HostClientSettingsEditor value={data.client_settings} onChange={(value) => onChange("client_settings", value)} usesTLS={usesTLS} protocol={selectedInbound?.protocol} network={selectedInbound?.network} />
				</HostAdvancedSection>
			)}
		</div>
	);
};

type HostDetailModalProps = {
	host: HostState | null;
	inboundOptions: InboundOption[];
	open: boolean;
	onClose: () => void;
	onChange: <Key extends keyof HostData>(
		uid: string,
		key: Key,
		value: HostData[Key],
	) => void;
	onChangeInbound: (uid: string, inboundTag: string) => void;
	onSave: (uid: string) => void;
	onReset: (uid: string) => void;
	onDelete: (uid: string) => void;
	saving: boolean;
	deleting: boolean;
	nodes?: NodeType[];
	mode?: "edit" | "clone";
	onClone?: (uid: string) => void;
};

const HostDetailModal: FC<HostDetailModalProps> = ({
	host,
	inboundOptions,
	open: isOpen,
	onClose,
	onChange,
	onChangeInbound,
	onSave,
	onReset,
	onDelete,
	saving,
	deleting,
	nodes,
	mode = "edit",
	onClone,
}) => {
	const { t } = useTranslation();
	const [jsonText, setJsonText] = useState<string>("");
	const [jsonError, setJsonError] = useState<string | null>(null);
	const updatingFromJsonRef = useRef(false);
	const isCloneMode = mode === "clone";
	const dirty = host ? isHostDirty(host) : false;
	const selectedInbound = useMemo(
		() =>
			host
				? inboundOptions.find((option) => option.value === host.inboundTag)
				: undefined,
		[inboundOptions, host],
	);
	const isWireGuardInbound = selectedInbound?.protocol === "wireguard";
	const remarkError = profileHostNameError(
		selectedInbound?.protocol,
		host?.data.remark ?? "",
	);
	const finalMaskError = host
		? finalMaskValidationError(
				fitHostToInbound(host.data, selectedInbound).finalmask,
			)
		: null;
	const finalMaskValid = host ? finalMaskError === null : false;
	const canSubmit = host
		? Boolean(
				host.inboundTag &&
					host.data.remark.trim() &&
					!remarkError &&
					finalMaskValid &&
					!hostClientSettingsError(host.data.client_settings) &&
					(host.data.address.trim() ||
						rotationTextToOptions(host.data.address_options).length > 0) &&
					(!isWireGuardInbound ||
						(host.data.dns_primary.trim() && host.data.dns_secondary.trim())),
			)
		: false;
	const primaryDisabled =
		Boolean(jsonError) || (isCloneMode ? !canSubmit : !dirty || !canSubmit);
	const primaryLabel = isCloneMode ? t("hostsPage.clone.submit") : t("save");
	const hostPayload = useMemo(() => {
		if (!host) {
			return null;
		}
		return {
			inboundTag: host.inboundTag,
			...formatHostForApi(host.data, selectedInbound),
		};
	}, [host, selectedInbound]);
	useEffect(() => {
		if (!hostPayload) {
			setJsonText("");
			setJsonError(null);
			return;
		}
		if (updatingFromJsonRef.current) {
			updatingFromJsonRef.current = false;
			return;
		}
		const formatted = JSON.stringify(hostPayload, null, 2);
		setJsonText((prev) => (prev === formatted ? prev : formatted));
		setJsonError(null);
	}, [hostPayload]);

	const handleJsonEditorChange = useCallback(
		(value: string) => {
			if (!host) {
				return;
			}
			setJsonText(value);
			try {
				const parsed: unknown = JSON.parse(value);
				if (!isFinalMaskObject(parsed)) {
					throw new Error("Invalid JSON payload");
				}
				const payload = parsed;
				if (
					Object.hasOwn(payload, "finalmask") &&
					payload.finalmask !== null &&
					!isFinalMaskObject(payload.finalmask)
				) {
					throw new Error(t("hostsPage.error.finalMaskObject"));
				}
				const nextInboundTag =
					typeof payload.inboundTag === "string"
						? payload.inboundTag
						: host.inboundTag;

				updatingFromJsonRef.current = true;
				if (nextInboundTag !== host.inboundTag) {
					onChangeInbound(host.uid, nextInboundTag);
				}

				(Object.keys(host.data) as Array<keyof HostData>).forEach((key) => {
					if (Object.hasOwn(payload, key)) {
						onChange(
							host.uid,
							key,
							coerceHostValue(key, payload[key], host.data),
						);
					}
				});

				setJsonError(null);
			} catch (error) {
				setJsonError(error instanceof Error ? error.message : "Invalid JSON");
			}
		},
		[host, onChange, onChangeInbound, t],
	);

	if (!host) {
		return null;
	}

	return (
		<Modal open={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside" isCentered returnFocusOnClose={false}>
			<ModalOverlay className="bg-blackAlpha-400" />
			<XrayModalContent className="mx-3 [&_.xray-dialog-section_label]:whitespace-nowrap [&_.xray-dialog-section_label]:mb-1.5">
				<ModalCloseButton />
				<XrayModalHeader
					subtitle={isCloneMode ? t("hostsPage.clone.description") : undefined}
				>
					<AppleEmojiText>
						{isCloneMode
							? t("hostsPage.clone.title")
							: host.data.remark || t("hostsPage.untitledHost")}
					</AppleEmojiText>
				</XrayModalHeader>
				<XrayModalBody>
					<Tabs isLazy variant="unstyled" className="xray-dialog-auto-sections">
						<TabList>
							<Tab>{t("form")}</Tab>
							<Tab>{t("json")}</Tab>
						</TabList>
						<TabPanels>
							<TabPanel className="px-0">
								<HostForm
									data={host.data}
									inboundTag={host.inboundTag}
									inboundOptions={inboundOptions}
									nodes={nodes}
									onChange={(key, value) => onChange(host.uid, key, value)}
									onChangeInbound={(value) => onChangeInbound(host.uid, value)}
								/>
							</TabPanel>
							<TabPanel className="px-0">
								<div className="flex flex-col items-stretch gap-3">
									<Suspense fallback={<Spinner size="sm" />}>
										<JsonEditor
											json={jsonText}
											onChange={handleJsonEditorChange}
										/>
									</Suspense>
									{jsonError && (
										<p className="text-[0.875rem] text-red-500">
											{jsonError}
										</p>
									)}
								</div>
							</TabPanel>
						</TabPanels>
					</Tabs>
					{!isCloneMode && host?.data.id ? (
						<EntityNotePanel entityType="host" entityKey={host.data.id} />
					) : null}
				</XrayModalBody>
				<XrayModalFooter className="justify-between">
					{isCloneMode ? (
						<Button size="sm" variant="ghost" onClick={onClose}>
							{t("hostsPage.cancel")}
						</Button>
					) : (
						<DeleteConfirmDialog
							description={t("hostsPage.deleteConfirmation")}
							loading={deleting}
							onConfirm={() => onDelete(host.uid)}
						>
							<Button size="sm" variant="ghost" colorScheme="red">{<DeleteIcon />}
								{t("delete")}
							</Button>
						</DeleteConfirmDialog>
					)}
					<div className="flex flex-row items-center gap-3">
						{!isCloneMode && onClone && (
							<Button size="sm" variant="outline" onClick={() => onClone(host.uid)} disabled={saving || deleting}>
								{t("hostsPage.clone")}
							</Button>
						)}
						<Button size="sm" variant="outline" onClick={() => onReset(host.uid)} disabled={!dirty || saving}>
							{t("reset")}
						</Button>
						<Button size="sm" colorScheme="primary" onClick={() => onSave(host.uid)} disabled={primaryDisabled} loading={saving}>
							{primaryLabel}
						</Button>
					</div>
				</XrayModalFooter>
			</XrayModalContent>
		</Modal>
	);
};

type CreateHostModalProps = {
	open: boolean;
	onClose: () => void;
	inboundOptions: InboundOption[];
	onSubmit: (values: CreateHostValues) => void;
	isSubmitting: boolean;
	nodes?: NodeType[];
};

const CreateHostModal: FC<CreateHostModalProps> = ({
	open: isOpen,
	onClose,
	inboundOptions,
	onSubmit,
	isSubmitting,
	nodes,
}) => {
	const { t } = useTranslation();
	const initialRef = useRef<HTMLInputElement | null>(null);
	const [formState, setFormState] = useState<CreateHostValues>(() =>
		emptyCreateHostValues(inboundOptions[0]?.value ?? ""),
	);
	const [jsonText, setJsonText] = useState("");
	const [jsonError, setJsonError] = useState<string | null>(null);
	const updatingFromJsonRef = useRef(false);
	const selectedInbound = useMemo(
		() =>
			inboundOptions.find((option) => option.value === formState.inboundTag),
		[inboundOptions, formState.inboundTag],
	);
	const isWireGuardInbound = selectedInbound?.protocol === "wireguard";
	const remarkError = profileHostNameError(
		selectedInbound?.protocol,
		formState.remark,
	);
	const finalMaskError = finalMaskValidationError(
		fitHostToInbound(formState, selectedInbound).finalmask,
	);
	const finalMaskValid = finalMaskError === null;

	useEffect(() => {
		if (isOpen) {
			updatingFromJsonRef.current = false;
			setFormState(emptyCreateHostValues(inboundOptions[0]?.value ?? ""));
			setJsonError(null);
			setTimeout(() => initialRef.current?.focus(), 150);
		}
	}, [inboundOptions, isOpen]);

	const jsonPayload = useMemo(
		() => ({
			inboundTag: formState.inboundTag,
			...formatHostForApi(formState, selectedInbound),
		}),
		[formState, selectedInbound],
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		if (updatingFromJsonRef.current) {
			updatingFromJsonRef.current = false;
			return;
		}
		const formatted = JSON.stringify(jsonPayload, null, 2);
		setJsonText((current) => (current === formatted ? current : formatted));
		setJsonError(null);
	}, [isOpen, jsonPayload]);

	const handleJsonEditorChange = useCallback(
		(value: string) => {
			setJsonText(value);
			try {
				const parsed: unknown = JSON.parse(value);
				if (!isFinalMaskObject(parsed)) {
					throw new Error("Invalid JSON payload");
				}
				const payload = parsed;
				if (
					Object.hasOwn(payload, "finalmask") &&
					payload.finalmask !== null &&
					!isFinalMaskObject(payload.finalmask)
				) {
					throw new Error(t("hostsPage.error.finalMaskObject"));
				}
				updatingFromJsonRef.current = true;
				setFormState((current) => {
					let next = {
						...current,
						inboundTag:
							typeof payload.inboundTag === "string"
								? payload.inboundTag
								: current.inboundTag,
					};
					for (const key of Object.keys(EMPTY_HOST_DATA) as Array<
						keyof HostData
					>) {
						if (Object.hasOwn(payload, key)) {
							next = {
								...next,
								[key]: coerceHostValue(key, payload[key], current),
							};
						}
					}
					return next;
				});
				setJsonError(null);
			} catch (error) {
				setJsonError(error instanceof Error ? error.message : "Invalid JSON");
			}
		},
		[t],
	);

	const handleSubmit = () => {
		if (
			jsonError ||
			!finalMaskValid ||
			hostClientSettingsError(formState.client_settings) ||
			!certificatePinsValid(formState.pinned_peer_cert_sha256) ||
			!formState.inboundTag ||
			!formState.remark.trim() ||
			Boolean(remarkError) ||
			(!formState.address.trim() &&
				rotationTextToOptions(formState.address_options).length === 0) ||
			(isWireGuardInbound &&
				(!formState.dns_primary.trim() || !formState.dns_secondary.trim()))
		) {
			return;
		}
		onSubmit(formState);
	};

	return (
		<Modal open={isOpen} onClose={onClose} size="4xl" initialFocusRef={initialRef} scrollBehavior="inside" isCentered returnFocusOnClose={false}>
			<ModalOverlay className="bg-blackAlpha-400" />
			<XrayModalContent className="mx-3 [&_.xray-dialog-section_label]:whitespace-nowrap [&_.xray-dialog-section_label]:mb-1.5">
				<XrayModalHeader subtitle={t("hostsPage.create.description")}>
					{t("hostsPage.create.title")}
				</XrayModalHeader>
				<ModalCloseButton />
				<XrayModalBody>
					<Tabs isLazy variant="unstyled" className="xray-dialog-auto-sections">
						<TabList>
							<Tab>{t("form")}</Tab>
							<Tab>{t("json")}</Tab>
						</TabList>
						<TabPanels>
							<TabPanel className="px-0">
								<HostForm
									data={formState}
									inboundTag={formState.inboundTag}
									inboundOptions={inboundOptions}
									nodes={nodes}
									initialFocusRef={initialRef}
									onChange={(key, value) =>
										setFormState((current) => ({ ...current, [key]: value }))
									}
									onChangeInbound={(value) =>
										setFormState((current) => ({
											...current,
											inboundTag: value,
										}))
									}
								/>
							</TabPanel>
							<TabPanel className="px-0">
								<div className="flex flex-col items-stretch gap-3">
									<Suspense fallback={<Spinner size="sm" />}>
										<JsonEditor
											json={jsonText}
											onChange={handleJsonEditorChange}
										/>
									</Suspense>
									{jsonError && (
										<p className="text-[0.875rem] text-red-500">
											{jsonError}
										</p>
									)}
								</div>
							</TabPanel>
						</TabPanels>
					</Tabs>
				</XrayModalBody>
				<XrayModalFooter className="justify-end">
					<Button size="md" variant="ghost" onClick={onClose}>
						{t("hostsPage.cancel")}
					</Button>
					<Button size="md" colorScheme="primary" onClick={handleSubmit} loading={isSubmitting} disabled={
							Boolean(jsonError) ||
							!finalMaskValid ||
							Boolean(hostClientSettingsError(formState.client_settings)) ||
							!certificatePinsValid(formState.pinned_peer_cert_sha256) ||
							!formState.inboundTag ||
							!formState.remark.trim() ||
							Boolean(remarkError) ||
							!rotationTextToOptions(formState.address).length ||
							(isWireGuardInbound &&
								(!formState.dns_primary.trim() ||
									!formState.dns_secondary.trim()))
						}>
						{t("hostsPage.create.submit")}
					</Button>
				</XrayModalFooter>
			</XrayModalContent>
		</Modal>
	);
};
export const HostsManager: FC = () => {
	const { t } = useTranslation();
	const toast = useToast();
	const hosts = useHosts((state) => state.hosts);
	const fetchHosts = useHosts((state) => state.fetchHosts);
	const isLoading = useHosts((state) => state.loading);
	const isPostLoading = useHosts((state) => state.isPostLoading);
	const setHosts = useHosts((state) => state.setHosts);
	const setHostStatus = useHosts((state) => state.setHostStatus);
	const inbounds = useDashboard((state) => state.inbounds);
	const { data: nodes = [] } = useNodesQuery();
	const [_hostItemsState, setHostItemsState] = useState<HostState[]>([]);
	const hostItemsRef = useRef<HostState[]>([]);
	const applyHostItems = useCallback(
		(updater: HostState[] | ((prev: HostState[]) => HostState[])) => {
			if (typeof updater === "function") {
				setHostItemsState((prev) => {
					const next = (updater as (prev: HostState[]) => HostState[])(prev);
					hostItemsRef.current = next;
					return next;
				});
			} else {
				hostItemsRef.current = updater;
				setHostItemsState(updater);
			}
		},
		[],
	);

	const [selectedHostUid, setSelectedHostUid] = useState<string | null>(null);
	const [selectedHostUids, setSelectedHostUids] = useState<string[]>([]);
	const [cloneHost, setCloneHost] = useState<HostState | null>(null);
	// Disabled hosts are hidden by default.
	const [includeDisabled, setIncludeDisabled] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchMatch, setSearchMatch] = useState(DEFAULT_SEARCH_MATCH_OPTIONS);
	const [createOpen, setCreateOpen] = useState(false);
	const [savingHostUid, setSavingHostUid] = useState<string | null>(null);
	const [deletingUid, setDeletingUid] = useState<string | null>(null);
	const [bulkAction, setBulkAction] = useState<
		"enable" | "disable" | "delete" | null
	>(null);

	const showHostValidationError = useCallback(
		(errors: string[]) => {
			if (!errors.length) {
				return false;
			}
			toast({
				title: t("hostsPage.error.invalidHost"),
				description: errors[0].startsWith("hostsPage.")
					? t(errors[0])
					: errors[0],
				status: "error",
				isClosable: true,
				position: "top",
			});
			return true;
		},
		[t, toast],
	);

	useEffect(() => {
		fetchHosts();
	}, [fetchHosts]);

	useEffect(() => {
		if (!inbounds.size) {
			fetchInbounds();
		}
	}, [inbounds]);

	useEffect(() => {
		try {
			const mapped = mapHostsToState(hosts);
			applyHostItems(mapped);
		} catch (error) {
			console.error("Failed to map hosts to state:", error, hosts);
			applyHostItems([]);
		}
	}, [hosts, applyHostItems]);

	useEffect(() => {
		if (
			selectedHostUid &&
			!hostItemsRef.current.some((host) => host.uid === selectedHostUid)
		) {
			setSelectedHostUid(null);
		}
	}, [selectedHostUid]);

	useEffect(() => {
		const existing = new Set(_hostItemsState.map((host) => host.uid));
		setSelectedHostUids((current) =>
			current.filter((uid) => existing.has(uid)),
		);
	}, [_hostItemsState]);

	const inboundOptions: InboundOption[] = useMemo(() => {
		const options: InboundOption[] = [];
		inbounds.forEach((list) => {
			list.forEach((inbound) => {
				if (["mtproto", "web"].includes(inbound.protocol.toLowerCase())) {
					return;
				}
				options.push({
					label: `${inbound.tag} (${inbound.protocol.toUpperCase()} - ${inbound.network})`,
					value: inbound.tag,
					protocol: inbound.protocol,
					network: inbound.network,
					headerType: inbound.header_type,
					alpn: inbound.alpn,
					tls: inbound.tls,
					flow: inbound.flow,
					proxyNetwork:
						typeof inbound.settings?.network === "string"
							? inbound.settings.network
							: undefined,
					port: inbound.port,
					validationError: (inbound as { validation_error?: string }).validation_error,
				});
			});
		});
		return options.sort((a, b) => a.label.localeCompare(b.label));
	}, [inbounds]);

	const activeHosts = useMemo(
		() => sortHosts(_hostItemsState.filter((host) => !host.data.is_disabled)),
		[_hostItemsState],
	);

	const allHosts = useMemo(() => sortHosts(_hostItemsState), [_hostItemsState]);

	const baseFilteredHosts = useMemo(
		() => (includeDisabled ? allHosts : activeHosts),
		[activeHosts, allHosts, includeDisabled],
	);

	const filteredHosts = useMemo(() => {
		if (!searchQuery.trim()) {
			return baseFilteredHosts;
		}
		return baseFilteredHosts.filter((host) => {
			const values = [
				host.data.remark,
				host.data.address,
				host.data.host,
				host.data.path,
				host.data.sni,
				host.inboundTag,
				host.data.port != null ? String(host.data.port) : "",
			];
			return matchesAnySearch(values, searchQuery, searchMatch);
		});
	}, [baseFilteredHosts, searchMatch, searchQuery]);

	const displayedHosts = filteredHosts;

	const hasLoadedHosts = hostItemsRef.current.length > 0;
	const isInitialLoading = isLoading && !hasLoadedHosts;
	const isRefreshing = isLoading && hasLoadedHosts;
	const isSearchActive = searchQuery.trim().length > 0;
	const showSearchEmptyState =
		!isInitialLoading &&
		isSearchActive &&
		baseFilteredHosts.length > 0 &&
		filteredHosts.length === 0;

	const selectedHost = selectedHostUid
		? (hostItemsRef.current.find((host) => host.uid === selectedHostUid) ??
			null)
		: null;

	const updateHost = <Key extends keyof HostData>(
		uid: string,
		key: Key,
		value: HostData[Key],
	) => {
		applyHostItems((prev) =>
			sortHosts(
				prev.map((host) =>
					host.uid === uid
						? { ...host, data: { ...host.data, [key]: value } }
						: host,
				),
			),
		);
	};

	const updateHostInbound = (uid: string, inboundTag: string) => {
		applyHostItems((prev) =>
			sortHosts(
				prev.map((host) => (host.uid === uid ? { ...host, inboundTag } : host)),
			),
		);
	};

	const saveHost = async (uid: string) => {
		const host = hostItemsRef.current.find((item) => item.uid === uid);
		if (!host) return;
		if (
			showHostValidationError(
				validateHostState(
					host.inboundTag,
					host.data,
					inboundOptions.find((option) => option.value === host.inboundTag),
				),
			)
		) {
			return;
		}
		setSavingHostUid(uid);
		try {
			const payload = buildInboundPayload(
				hostItemsRef.current,
				[host.inboundTag, host.initialInboundTag],
				inboundOptions,
				uid,
			);
			await setHosts(payload);
			await fetchHosts();
			toast({
				title: t("hostsPage.saved"),
				status: "success",
				isClosable: true,
				position: "top",
			});
			setSelectedHostUid(null);
		} catch (_error) {
			toast({
				title: t("hostsPage.error.save"),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setSavingHostUid(null);
		}
	};

	const resetHost = (uid: string) => {
		applyHostItems((prev) =>
			sortHosts(
				prev.map((host) =>
					host.uid === uid
						? {
								...host,
								inboundTag: host.initialInboundTag,
								data: cloneHostData(host.original),
							}
						: host,
				),
			),
		);
	};

	const openCloneModal = useCallback((uid: string) => {
		const source = hostItemsRef.current.find((item) => item.uid === uid);
		if (!source) return;
		const baseData = { ...cloneHostData(source.data), id: null };
		const cloneState: HostState = {
			uid: createUid(),
			inboundTag: source.inboundTag,
			initialInboundTag: source.inboundTag,
			data: cloneHostData(baseData),
			original: cloneHostData(baseData),
		};
		setSelectedHostUid(null);
		setCloneHost(cloneState);
	}, []);

	const updateCloneHost = <Key extends keyof HostData>(
		uid: string,
		key: Key,
		value: HostData[Key],
	) => {
		setCloneHost((prev) => {
			if (!prev || prev.uid !== uid) return prev;
			return {
				...prev,
				data: { ...prev.data, [key]: value },
			};
		});
	};

	const updateCloneInbound = (uid: string, inboundTag: string) => {
		setCloneHost((prev) => {
			if (!prev || prev.uid !== uid) return prev;
			return {
				...prev,
				inboundTag,
			};
		});
	};

	const resetCloneHost = (uid: string) => {
		setCloneHost((prev) =>
			prev && prev.uid === uid
				? {
						...prev,
						inboundTag: prev.initialInboundTag,
						data: cloneHostData(prev.original),
					}
				: prev,
		);
	};

	const addCloneHost = async (uid: string) => {
		if (!cloneHost || cloneHost.uid !== uid) return;
		if (
			showHostValidationError(
				validateHostState(
					cloneHost.inboundTag,
					cloneHost.data,
					inboundOptions.find(
						(option) => option.value === cloneHost.inboundTag,
					),
				),
			)
		) {
			return;
		}
		const remark = cloneHost.data.remark.trim();
		const address =
			cloneHost.data.address.trim() ||
			rotationTextToOptions(cloneHost.data.address_options)[0] ||
			"";
		if (!cloneHost.inboundTag || !remark || !address) {
			toast({
				title: t("hostsPage.clone.error"),
				status: "error",
				isClosable: true,
				position: "top",
			});
			return;
		}

		const newData: HostData = {
			...cloneHostData(cloneHost.data),
			id: null,
			remark,
			address,
		};
		const previousHosts = hostItemsRef.current;
		const newHost: HostState = {
			uid: createUid(),
			inboundTag: cloneHost.inboundTag,
			initialInboundTag: cloneHost.inboundTag,
			data: cloneHostData(newData),
			original: cloneHostData(newData),
		};

		setSavingHostUid(uid);
		try {
			const nextHosts = sortHosts([...previousHosts, newHost]);
			applyHostItems(nextHosts);
			const payload = buildInboundPayload(
				nextHosts,
				[cloneHost.inboundTag],
				inboundOptions,
				newHost.uid,
			);
			await setHosts(payload);
			await fetchHosts();
			toast({
				title: t("hostsPage.clone.created"),
				status: "success",
				isClosable: true,
				position: "top",
			});
			setCloneHost(null);
		} catch (_error) {
			applyHostItems(previousHosts);
			toast({
				title: t("hostsPage.clone.error"),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setSavingHostUid(null);
		}
	};

	const toggleActive = async (uid: string, isActive: boolean) => {
		if (isPostLoading) {
			return;
		}
		const previousHosts = hostItemsRef.current;
		const nextHosts = sortHosts(
			previousHosts.map((host) =>
				host.uid === uid
					? { ...host, data: { ...host.data, is_disabled: !isActive } }
					: host,
			),
		);
		applyHostItems(nextHosts);
		setSavingHostUid(uid);
		try {
			const updatedHost = nextHosts.find((host) => host.uid === uid);
			if (!updatedHost) {
				throw new Error("Host not found");
			}
			if (!updatedHost.data.id) {
				throw new Error("Host ID is missing");
			}
			await setHostStatus(updatedHost.data.id, !isActive);
			await fetchHosts();
		} catch (_error) {
			applyHostItems(previousHosts);
			toast({
				title: t("hostsPage.error.save"),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setSavingHostUid(null);
		}
	};

	const handleDeleteHost = async (uid: string) => {
		const host = hostItemsRef.current.find((item) => item.uid === uid);
		if (!host) return;
		const previousHosts = hostItemsRef.current;
		setDeletingUid(uid);
		try {
			const nextHosts = previousHosts.filter((item) => item.uid !== uid);
			applyHostItems(nextHosts);
			const payload = buildInboundPayload(
				nextHosts,
				[host.inboundTag, host.initialInboundTag],
				inboundOptions,
			);
			await setHosts(payload);
			await fetchHosts();
			toast({
				title: t("hostsPage.deleted"),
				status: "success",
				isClosable: true,
				position: "top",
			});
			if (selectedHostUid === uid) {
				setSelectedHostUid(null);
			}
		} catch (_error) {
			applyHostItems(previousHosts);
			toast({
				title: t("hostsPage.error.delete"),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setDeletingUid(null);
		}
	};

	const handleBulkToggleHosts = async (
		items: HostState[],
		isActive: boolean,
	) => {
		if (!items.length || isPostLoading || bulkAction) {
			return;
		}
		const selected = new Set(items.map((host) => host.uid));
		const affectedTags = new Set<string>();
		items.forEach((host) => {
			affectedTags.add(host.inboundTag);
			affectedTags.add(host.initialInboundTag);
		});
		const previousHosts = hostItemsRef.current;
		const nextHosts = sortHosts(
			previousHosts.map((host) =>
				selected.has(host.uid)
					? { ...host, data: { ...host.data, is_disabled: !isActive } }
					: host,
			),
		);
		applyHostItems(nextHosts);
		setBulkAction(isActive ? "enable" : "disable");
		try {
			const payload = buildInboundPayload(
				nextHosts,
				affectedTags,
				inboundOptions,
			);
			await setHosts(payload);
			await fetchHosts();
			setSelectedHostUids([]);
			toast({
				title: isActive
					? t("hostsPage.bulkEnabled")
					: t("hostsPage.bulkDisabled"),
				status: "success",
				isClosable: true,
				position: "top",
			});
		} catch (_error) {
			applyHostItems(previousHosts);
			toast({
				title: t("hostsPage.error.save"),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setBulkAction(null);
		}
	};

	const handleBulkDeleteHosts = async (items: HostState[]) => {
		if (!items.length || isPostLoading || bulkAction) {
			return;
		}
		const selected = new Set(items.map((host) => host.uid));
		const affectedTags = new Set<string>();
		items.forEach((host) => {
			affectedTags.add(host.inboundTag);
			affectedTags.add(host.initialInboundTag);
		});
		const previousHosts = hostItemsRef.current;
		const nextHosts = previousHosts.filter((host) => !selected.has(host.uid));
		applyHostItems(nextHosts);
		setBulkAction("delete");
		try {
			const payload = buildInboundPayload(
				nextHosts,
				affectedTags,
				inboundOptions,
			);
			await setHosts(payload);
			await fetchHosts();
			setSelectedHostUids([]);
			toast({
				title: t("hostsPage.bulkDeleted"),
				status: "success",
				isClosable: true,
				position: "top",
			});
		} catch (_error) {
			applyHostItems(previousHosts);
			toast({
				title: t("hostsPage.error.delete"),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setBulkAction(null);
		}
	};

	const handleCreateHost = async (values: CreateHostValues) => {
		if (
			showHostValidationError(
				validateHostState(
					values.inboundTag,
					values,
					inboundOptions.find((option) => option.value === values.inboundTag),
				),
			)
		) {
			return;
		}
		setSavingHostUid("create");
		try {
			const { inboundTag, ...hostData } = values;
			const newData = cloneHostData({ ...hostData, id: null });
			const newHost: HostState = {
				uid: createUid(),
				inboundTag,
				initialInboundTag: inboundTag,
				data: newData,
				original: cloneHostData(newData),
			};

			const nextHosts = sortHosts([...hostItemsRef.current, newHost]);
			applyHostItems(nextHosts);

			const payload = buildInboundPayload(
				nextHosts,
				[inboundTag],
				inboundOptions,
				newHost.uid,
			);
			await setHosts(payload);
			await fetchHosts();
			toast({
				title: t("hostsPage.created"),
				status: "success",
				isClosable: true,
				position: "top",
			});
			setCreateOpen(false);
		} catch (_error) {
			toast({
				title: t("hostsPage.error.create"),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setSavingHostUid(null);
		}
	};

	const hostSummaryItems = useMemo<ResourceSummaryItem[]>(() => {
		const total = allHosts.length;
		const disabled = allHosts.filter((host) => host.data.is_disabled).length;
		const enabled = total - disabled;
		const inboundCount = new Set(allHosts.map((host) => host.inboundTag)).size;
		return [
			{
				label: t("total"),
				value: total,
				colorScheme: "gray",
			},
			{
				label: t("nodes.enabled"),
				value: enabled,
				colorScheme: "green",
			},
			{
				label: t("nodes.disabled"),
				value: disabled,
				colorScheme: "red",
			},
			{
				label: t("pages.xray.Inbounds"),
				value: inboundCount,
				colorScheme: "purple",
			},
			{
				label: t("usersPage.filtered"),
				value: displayedHosts.length,
				colorScheme: "teal",
			},
		];
	}, [allHosts, displayedHosts.length, t]);

	const renderRotationValues = useCallback(
		(value: string, emptyLabel: string) => {
			const values = rotationTextToOptions(value);
			if (!values.length) {
				return <p className="text-panel-text-muted">{emptyLabel}</p>;
			}
			const visible = values.slice(0, 2);
			const hiddenCount = values.length - visible.length;
			return (
				<Tooltip label={values.join(", ")} disabled={values.length <= visible.length} hasArrow placement="top">
					<div className="flex flex-row items-center gap-1 flex-wrap max-w-full">
						{visible.map((item) => (
							<Tag key={item} size="sm" className="max-w-[120px]">
								<span className="truncate">
									{item}
								</span>
							</Tag>
						))}
						{hiddenCount > 0 && (
							<Tag size="sm" colorScheme="blue">
								+{hiddenCount}
							</Tag>
						)}
					</div>
				</Tooltip>
			);
		},
		[],
	);

	const [hostSorting, setHostSorting] = useState<SortingState>([]);
	const hostColumns = useMemo<DataTableColumn<HostState>[]>(
		() => [
			{
				id: "remark",
				sortValue: (host) => host.data.remark ?? "",
				header: t("hostsPage.host"),
				isPrimary: true,
				priority: "primary",
				width: { base: "150px", lg: "160px", xl: "180px" },
				minWidth: "130px",
				maxWidth: "220px",
				mobilePriority: 0,
				mobileMetaLabel: t("hostsPage.host"),
				cell: (host) => {
					const dirty = isHostDirty(host);
					const hostName = host.data.remark || t("hostsPage.untitledHost");
					return (
						<div className="flex flex-col gap-0.5 min-w-0!">
							<Tooltip label={<AppleEmojiText>{hostName}</AppleEmojiText>} disabled={hostName.length <= 24}>
								<p className="font-semibold truncate">
									<AppleEmojiText>{hostName}</AppleEmojiText>
								</p>
							</Tooltip>
							<div className="flex flex-row items-center gap-1 flex-wrap">
								{host.data.id != null && (
									<p className="text-[0.75rem] text-panel-text-muted">
										ID: {host.data.id}
									</p>
								)}
								{dirty && (
									<Tag size="sm" colorScheme="orange">
										{t("hostsPage.unsaved")}
									</Tag>
								)}
							</div>
						</div>
					);
				},
			},
			{
				id: "status",
				sortValue: (host) => (host.data.is_disabled ? 1 : 0),
				header: t("usersTable.status"),
				priority: "high",
				width: "112px",
				minWidth: "96px",
				maxWidth: "128px",
				headerAlign: "start",
				cellAlign: "start",
				mobilePriority: 1,
				mobileMetaLabel: t("usersTable.status"),
				cell: (host) => (
					<p className={cn("text-[0.875rem] font-semibold", host.data.is_disabled ? "text-red-400" : "text-green-400")}>
						{t(
							host.data.is_disabled ? "hostsPage.inactive" : "hostsPage.active",
						)}
					</p>
				),
			},
			{
				id: "address",
				sortValue: (host) => host.data.address ?? "",
				header: t("hostsDialog.address"),
				priority: "high",
				width: { base: "210px", lg: "240px", xl: "280px" },
				minWidth: "170px",
				maxWidth: "320px",
				mobilePriority: 1,
				mobileMetaLabel: t("hostsDialog.address"),
				cell: (host) =>
					renderRotationValues(host.data.address, t("hostsPage.noAddress")),
			},
			{
				id: "port",
				sortValue: (host) => host.data.port ?? 0,
				header: t("port"),
				priority: "high",
				width: "72px",
				minWidth: "64px",
				maxWidth: "82px",
				mobilePriority: 2,
				mobileMetaLabel: t("port"),
				cell: (host) =>
					host.data.port != null ? (
						<p dir="ltr" className="font-semibold [unicode-bidi:isolate]">
							{host.data.port}
						</p>
					) : (
						<p className="text-panel-text-muted">-</p>
					),
			},
			{
				id: "inbound",
				sortValue: (host) => host.inboundTag ?? "",
				header: t("hostsPage.inboundLabel"),
				priority: "high",
				width: { base: "150px", lg: "160px", xl: "190px" },
				minWidth: "130px",
				maxWidth: "230px",
				mobilePriority: 3,
				mobileMetaLabel: t("hostsPage.inboundLabel"),
				cell: (host) => {
					const inbound = inboundOptions.find(
						(option) => option.value === host.inboundTag,
					);
					return (
						<div className="flex flex-col gap-0.5 min-w-0!">
							<p className="font-semibold truncate">
								{host.inboundTag}
							</p>
							{(!inbound || inbound.validationError) && (
								<Tooltip label={inbound?.validationError || t("diagnostics.missingInbound", { tag: host.inboundTag })} hasArrow>
									<Tag size="sm" colorScheme="red" className="w-fit">{t("diagnostics.broken")}</Tag>
								</Tooltip>
							)}
							<p className="text-[0.75rem] text-panel-text-muted truncate">
								{inbound
									? `${inbound.protocol.toUpperCase()} / ${inbound.network}`
									: t("hostsPage.unknownInbound")}
							</p>
						</div>
					);
				},
			},
			{
				id: "sni",
				sortValue: (host) => host.data.sni ?? "",
				header: t("hostsDialog.sni"),
				priority: "low",
				hideBelow: "xl",
				width: "180px",
				minWidth: "140px",
				maxWidth: "220px",
				mobilePriority: 4,
				mobileMetaLabel: t("hostsDialog.sni"),
				cell: (host) => renderRotationValues(host.data.sni, "-"),
			},
			{
				id: "request_host",
				sortValue: (host) => host.data.host ?? "",
				header: t("hostsDialog.host"),
				priority: "low",
				hideBelow: "xl",
				width: "180px",
				minWidth: "140px",
				maxWidth: "220px",
				mobilePriority: 5,
				mobileMetaLabel: t("hostsDialog.host"),
				cell: (host) => renderRotationValues(host.data.host, "-"),
			},
			{
				id: "security",
				sortValue: (host) => host.data.security ?? "",
				header: t("hostsDialog.security"),
				priority: "low",
				hideBelow: "xl",
				width: "130px",
				maxWidth: "150px",
				mobilePriority: 6,
				mobileMetaLabel: t("hostsDialog.security"),
				cell: (host) => (
					<Tag size="sm" colorScheme="blue">
						{host.data.security || "inbound_default"}
					</Tag>
				),
			},
		],
		[inboundOptions, renderRotationValues, t],
	);

	const hostRowActions = (host: HostState): DataTableRowAction<HostState>[] => {
		const isActive = !host.data.is_disabled;
		return [
			{
				id: "edit",
				label: t("edit"),
				icon: <EditIcon />,
				onClick: () => setSelectedHostUid(host.uid),
			},
			{
				id: "toggle",
				label: isActive ? t("phpmyadmin.disableAction") : t("hostsPage.enable"),
				icon: isActive ? (
					<XCircleIcon className="w-16" />
				) : (
					<CheckCircleIcon className="w-16" />
				),
				onClick: () => toggleActive(host.uid, !isActive),
				disabled: isPostLoading,
			},
			{
				id: "delete",
				label: t("delete"),
				icon: <TrashIcon className="w-16" />,
				isDanger: true,
				render: (_row, onMenuClose) => (
					<DeleteConfirmDialog
						description={t("hostsPage.deleteConfirmation")}
						loading={deletingUid === host.uid && isPostLoading}
						onConfirm={async () => {
							await handleDeleteHost(host.uid);
							onMenuClose();
						}}
					>
						<MenuItem icon={<TrashIcon className="w-16" />} disabled={isPostLoading} onClick={(event) => event.stopPropagation()} className="text-red-400">
							{t("delete")}
						</MenuItem>
					</DeleteConfirmDialog>
				),
			},
		];
	};

	return (
		<div className="flex flex-col items-stretch gap-4">
			<ResourceListCard
				title={t("hostsPage.listHeader")}
				summaryItems={hostSummaryItems}
				actions={
					<Button colorScheme="primary" size="sm" onClick={() => setCreateOpen(true)} disabled={!inboundOptions.length} className="h-[36px] px-3 rounded-[4px]">{<AddIcon />}
						{t("hostsPage.addHost")}
					</Button>
				}
				footerActions={
					<ResourceRefreshButton
						aria-label={t("hostsPage.refresh")}
						label={t("hostsPage.refresh")}
						icon={<ArrowPathIcon className="w-16" />}
						loading={isRefreshing}
						onClick={fetchHosts}
					/>
				}
			>
				<div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-wrap">
					<SearchInput value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("hostsPage.searchPlaceholder")} containerProps={{ className: "w-full md:w-[320px]" }} matchOptions={searchMatch} onMatchOptionsChange={setSearchMatch} />
					<DataTableSortMenu
						options={buildSortOptions(hostColumns, displayedHosts)}
						sorting={hostSorting}
						onSortingChange={setHostSorting}
					/>
					<Checkbox checked={includeDisabled} onChange={(event) => setIncludeDisabled(event.target.checked)}>
						{t("hostsPage.showDisabled")}
					</Checkbox>
				</div>
			</ResourceListCard>

			<DataTable
				ariaLabel={t("hostsPage.tabHosts")}
				data={displayedHosts}
				columns={hostColumns}
				sorting={hostSorting}
				onSortingChange={setHostSorting}
				showSortMenu={false}
				getRowId={(host) => host.uid}
				loading={isInitialLoading}
				loadingRows={5}
				emptyState={
					<div className="text-center text-panel-text-muted">
						{showSearchEmptyState
							? t("hostsPage.searchEmpty")
							: t("hostsPage.emptyState")}
					</div>
				}
				rowActions={hostRowActions}
				actionsDisplay="menu"
				actionsPlacement="end"
				actionsColumnWidth="60px"
				showActionsOnHover
				enableSelection
				selectedRowIds={selectedHostUids}
				selectedCount={selectedHostUids.length}
				onSelectionChange={(rowIds) => setSelectedHostUids(rowIds)}
				selectedLabel={t("hostsPage.selectedCount", {
					count: selectedHostUids.length,
				})}
				renderBulkActions={(selectedRows) => {
					const enableTargets = selectedRows.filter(
						(host) => host.data.is_disabled,
					);
					const disableTargets = selectedRows.filter(
						(host) => !host.data.is_disabled,
					);
					return (
						<>
							<Button size="sm" variant="outline" loading={bulkAction === "enable"} disabled={
									Boolean(bulkAction) ||
									isPostLoading ||
									enableTargets.length === 0
								} onClick={() => handleBulkToggleHosts(enableTargets, true)}>{<CheckCircleIcon className="w-16" />}
								{t("hostsPage.enable")}
							</Button>
							<Button size="sm" variant="outline" loading={bulkAction === "disable"} disabled={
									Boolean(bulkAction) ||
									isPostLoading ||
									disableTargets.length === 0
								} onClick={() => handleBulkToggleHosts(disableTargets, false)}>{<XCircleIcon className="w-16" />}
								{t("phpmyadmin.disableAction")}
							</Button>
							<DeleteConfirmDialog
								description={t("hostsPage.confirmBulkDelete", {
									count: selectedRows.length,
								})}
								loading={bulkAction === "delete"}
								disabled={selectedRows.length === 0}
								onConfirm={() => handleBulkDeleteHosts(selectedRows)}
							>
								<Button size="sm" variant="outline" colorScheme="red" loading={bulkAction === "delete"} disabled={
										Boolean(bulkAction) ||
										isPostLoading ||
										selectedRows.length === 0
									}>{<TrashIcon className="w-16" />}
									{t("delete")}
								</Button>
							</DeleteConfirmDialog>
						</>
					);
				}}
				mobileBreakpoint="md"
				tableProps={{ className: "w-full [table-layout:fixed] [&_th]:px-2 [&_td]:px-2 [&_th]:py-2.5 [&_td]:py-2.5 [&_th]:align-middle [&_td]:align-middle xl:[&_th]:px-2.5 xl:[&_td]:px-2.5" }}
			/>

			{createOpen && (
				<CreateHostModal
					open={createOpen}
					onClose={() => setCreateOpen(false)}
					inboundOptions={inboundOptions}
					onSubmit={handleCreateHost}
					isSubmitting={savingHostUid === "create" && isPostLoading}
					nodes={nodes}
				/>
			)}

			{selectedHost && (
				<HostDetailModal
					host={selectedHost}
					inboundOptions={inboundOptions}
					open={Boolean(selectedHost)}
					onClose={() => setSelectedHostUid(null)}
					onChange={updateHost}
					onChangeInbound={updateHostInbound}
					onSave={saveHost}
					onReset={resetHost}
					onDelete={handleDeleteHost}
					onClone={openCloneModal}
					saving={
						!!selectedHost &&
						savingHostUid === selectedHost.uid &&
						isPostLoading
					}
					deleting={
						!!selectedHost && deletingUid === selectedHost.uid && isPostLoading
					}
					nodes={nodes}
				/>
			)}

			{cloneHost && (
				<HostDetailModal
					host={cloneHost}
					inboundOptions={inboundOptions}
					open={Boolean(cloneHost)}
					onClose={() => setCloneHost(null)}
					onChange={updateCloneHost}
					onChangeInbound={updateCloneInbound}
					onSave={addCloneHost}
					onReset={resetCloneHost}
					onDelete={() => {}}
					mode="clone"
					saving={
						!!cloneHost && savingHostUid === cloneHost.uid && isPostLoading
					}
					deleting={false}
					nodes={nodes}
				/>
			)}
		</div>
	);
};

export default HostsManager;
