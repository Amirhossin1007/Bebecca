import { useToast } from "components/shadcn/toast";
import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { Spinner } from "components/shadcn/feedback";
import { FormControl, FormHelperText, FormLabel } from "components/shadcn/field";
import { Input } from "components/shadcn/input";
import { Button } from "components/shadcn/button";
import { Alert, AlertDescription, AlertIcon } from "components/shadcn/alert";
import { Badge, Tag } from "components/shadcn/badge";
import { PanelSelect as Select } from "components/common/PanelSelect";
import {
	ArrowPathIcon,
	CloudArrowDownIcon,
	KeyIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch as apiFetch } from "service/http";
import {
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
	XrayModalHeader,
} from "./xray/XrayDialog";

type OutboundJson = Record<string, any>;

type NordAPIResponse = {
	success?: boolean;
	obj?: string;
	detail?: string;
};

type NordData = {
	token?: string;
	private_key?: string;
};

type Country = {
	id: number;
	name: string;
	code?: string;
};

type City = {
	id: number;
	name: string;
};

type NordServer = {
	id: number;
	name?: string;
	hostname: string;
	station: string;
	load: number;
	technologies?: Array<{
		id?: number;
		metadata?: Array<{ name?: string; value?: string }>;
	}>;
	location_ids?: number[];
	cityId?: number | null;
	cityName?: string;
};

type Props = {
	open: boolean;
	onClose: () => void;
	initialOutbounds: OutboundJson[];
	onSave: (outbound: OutboundJson, replaceIndex: number | null) => void;
	onDelete: (index: number) => void;
};

const parseAPIError = (error: any, fallback: string) =>
	error?.response?._data?.detail ??
	error?.data?.detail ??
	error?.message ??
	fallback;

const parseObj = <T,>(response: NordAPIResponse, fallback: T): T => {
	if (!response?.obj) return fallback;
	try {
		return JSON.parse(response.obj) as T;
	} catch {
		return fallback;
	}
};

const loadColor = (load: number) => {
	if (load < 30) return "green";
	if (load < 70) return "orange";
	return "red";
};

export const NordVPNModal: FC<Props> = ({
	open: isOpen,
	onClose,
	initialOutbounds,
	onSave,
	onDelete,
}) => {
	const { t } = useTranslation();
	const toast = useToast();
	const [loading, setLoading] = useState(false);
	const [nordData, setNordData] = useState<NordData | null>(null);
	const [token, setToken] = useState("");
	const [manualKey, setManualKey] = useState("");
	const [countries, setCountries] = useState<Country[]>([]);
	const [cities, setCities] = useState<City[]>([]);
	const [servers, setServers] = useState<NordServer[]>([]);
	const [countryID, setCountryID] = useState("");
	const [cityID, setCityID] = useState("");
	const [serverID, setServerID] = useState("");

	const nordOutboundIndex = useMemo(
		() =>
			initialOutbounds.findIndex((outbound) =>
				String(outbound?.tag ?? "").startsWith("nord-"),
			),
		[initialOutbounds],
	);

	const filteredServers = useMemo(() => {
		if (!cityID) return servers;
		return servers.filter((server) => String(server.cityId ?? "") === cityID);
	}, [cityID, servers]);

	useEffect(() => {
		setServerID(filteredServers[0]?.id ? String(filteredServers[0].id) : "");
	}, [filteredServers]);

	const fetchCountries = useCallback(async () => {
		const response = await apiFetch<NordAPIResponse>(
			"/panel/xray/nord/countries",
			{ method: "POST" },
		);
		setCountries(parseObj<Country[]>(response, []));
	}, []);

	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const response = await apiFetch<NordAPIResponse>("/panel/xray/nord/data", {
				method: "POST",
			});
			const next = parseObj<NordData | null>(response, null);
			setNordData(next);
			if (next?.private_key) {
				await fetchCountries();
			}
		} catch (error: any) {
			toast({
				title: parseAPIError(
					error,
					t("pages.xray.nord.loadFailed"),
				),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setLoading(false);
		}
	}, [fetchCountries, t, toast]);

	useEffect(() => {
		if (isOpen) {
			void loadData();
		}
	}, [isOpen, loadData]);

	const register = async () => {
		setLoading(true);
		try {
			const response = await apiFetch<NordAPIResponse>("/panel/xray/nord/reg", {
				method: "POST",
				body: { token },
			});
			const next = parseObj<NordData | null>(response, null);
			setNordData(next);
			await fetchCountries();
			toast({
				title: t("pages.xray.nord.loginSuccess"),
				status: "success",
				isClosable: true,
				position: "top",
			});
		} catch (error: any) {
			toast({
				title: parseAPIError(
					error,
					t("pages.xray.nord.loginFailed"),
				),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setLoading(false);
		}
	};

	const saveManualKey = async () => {
		setLoading(true);
		try {
			const response = await apiFetch<NordAPIResponse>("/panel/xray/nord/setKey", {
				method: "POST",
				body: { key: manualKey },
			});
			const next = parseObj<NordData | null>(response, null);
			setNordData(next);
			await fetchCountries();
			toast({
				title: t("pages.xray.nord.keySaved"),
				status: "success",
				isClosable: true,
				position: "top",
			});
		} catch (error: any) {
			toast({
				title: parseAPIError(
					error,
					t("pages.xray.nord.keyFailed"),
				),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setLoading(false);
		}
	};

	const deleteData = async () => {
		setLoading(true);
		try {
			await apiFetch<NordAPIResponse>("/panel/xray/nord/del", {
				method: "POST",
			});
			if (nordOutboundIndex >= 0) {
				onDelete(nordOutboundIndex);
			}
			setNordData(null);
			setToken("");
			setManualKey("");
			setCountries([]);
			setCities([]);
			setServers([]);
			setCountryID("");
			setCityID("");
			setServerID("");
		} catch (error: any) {
			toast({
				title: parseAPIError(
					error,
					t("pages.xray.nord.deleteFailed"),
				),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setLoading(false);
		}
	};

	const fetchServers = async (nextCountryID: string) => {
		setCountryID(nextCountryID);
		setCityID("");
		setServerID("");
		setServers([]);
		setCities([]);
		if (!nextCountryID) return;
		setLoading(true);
		try {
			const response = await apiFetch<NordAPIResponse>("/panel/xray/nord/servers", {
				method: "POST",
				body: { countryId: nextCountryID },
			});
			const data = parseObj<{ locations?: any[]; servers?: NordServer[] }>(
				response,
				{},
			);
			const locToCity: Record<number, City> = {};
			const cityMap = new Map<number, City>();
			for (const loc of data.locations ?? []) {
				const city = loc?.country?.city;
				if (city?.id && city?.name) {
					locToCity[loc.id] = city;
					cityMap.set(city.id, city);
				}
			}
			const nextServers = (data.servers ?? [])
				.map((server) => {
					const firstLocID = server.location_ids?.[0];
					const city =
						typeof firstLocID === "number" ? locToCity[firstLocID] : undefined;
					return {
						...server,
						cityId: city?.id ?? null,
						cityName: city?.name ?? "Unknown",
					};
				})
				.sort((a, b) => (a.load ?? 0) - (b.load ?? 0));
			setCities(
				Array.from(cityMap.values()).sort((a, b) =>
					a.name.localeCompare(b.name),
				),
			);
			setServers(nextServers);
			if (nextServers.length === 0) {
				toast({
					title: t("pages.xray.nord.noServers"),
					status: "warning",
					isClosable: true,
					position: "top",
				});
			}
		} catch (error: any) {
			toast({
				title: parseAPIError(
					error,
					t("pages.xray.nord.serversFailed"),
				),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setLoading(false);
		}
	};

	const buildOutbound = (): OutboundJson | null => {
		const server = servers.find((item) => String(item.id) === serverID);
		if (!server) return null;
		const technology = server.technologies?.find((item) => item.id === 35);
		const publicKey = technology?.metadata?.find(
			(item) => item.name === "public_key",
		)?.value;
		if (!publicKey) {
			toast({
				title: t("pages.xray.nord.noPublicKey"),
				status: "error",
				isClosable: true,
				position: "top",
			});
			return null;
		}
		return {
			tag: `nord-${server.hostname}`,
			protocol: "wireguard",
			settings: {
				secretKey: nordData?.private_key,
				address: ["10.5.0.2/32"],
				peers: [{ publicKey, endpoint: `${server.station}:51820` }],
				noKernelTun: true,
			},
		};
	};

	const saveOutbound = () => {
		const outbound = buildOutbound();
		if (!outbound) return;
		onSave(outbound, nordOutboundIndex >= 0 ? nordOutboundIndex : null);
		toast({
			title:
				nordOutboundIndex >= 0
					? t("pages.xray.nord.outboundUpdated")
					: t("pages.xray.nord.outboundAdded"),
			status: "success",
			isClosable: true,
			position: "top",
		});
		onClose();
	};

	const selectedServer = servers.find((item) => String(item.id) === serverID);

	return (
		<Modal open={isOpen} onClose={onClose} size="3xl" isCentered>
			<ModalOverlay />
			<XrayModalContent>
				<XrayModalHeader>NordVPN NordLynx</XrayModalHeader>
				<ModalCloseButton />
				<XrayModalBody>
					<div className="flex flex-col gap-4 items-stretch">
						{loading && (
							<div className="flex flex-row items-center gap-2">
								<Spinner size="sm" />
								<p className="text-[0.875rem] text-gray-500">
									{t("loading")}
								</p>
							</div>
						)}
						{!nordData?.private_key ? (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="border rounded-md p-4">
									<div className="flex flex-col gap-3">
										<p className="font-bold">
											{t("pages.xray.warp.accessToken")}
										</p>
										<FormControl>
											<FormLabel>{t("userDialog.links.subscriptionToken")}</FormLabel>
											<Input value={token} onChange={(event) => setToken(event.target.value)} placeholder="NordVPN access token" />
											<FormHelperText>
												{t("pages.xray.nord.tokenHelp")}
											</FormHelperText>
										</FormControl>
										<Button size="md" loading={loading} onClick={register} colorScheme="primary">{<KeyIcon className="w-[16px]" />}
											{t("login")}
										</Button>
									</div>
								</div>
								<div className="border rounded-md p-4">
									<div className="flex flex-col gap-3">
										<p className="font-bold">
											{t("pages.xray.nord.manualKey")}
										</p>
										<FormControl>
											<FormLabel>
												{t("inbounds.wireguard.privateKey")}
											</FormLabel>
											<Input value={manualKey} onChange={(event) => setManualKey(event.target.value)} placeholder="NordLynx private key" />
										</FormControl>
										<Button variant="solid" size="md" loading={loading} onClick={saveManualKey}>{<CloudArrowDownIcon className="w-[16px]" />}
											{t("save")}
										</Button>
									</div>
								</div>
							</div>
						) : (
							<div className="flex flex-col gap-4">
								<Alert status="success" className="rounded-md">
									<AlertIcon />
									<AlertDescription>
										{t("pages.xray.nord.ready")}
									</AlertDescription>
								</Alert>
								<table className="w-full border-separate border-spacing-0">
									<thead>
										<tr>
											<th className="bg-panel-elevated px-6 py-3 text-start text-[0.75rem] font-bold uppercase leading-4 tracking-wider text-panel-text">{t("field")}</th>
											<th className="bg-panel-elevated px-6 py-3 text-start text-[0.75rem] font-bold uppercase leading-4 tracking-wider text-panel-text">{t("value")}</th>
										</tr>
									</thead>
									<tbody>
										{nordData.token && (
											<tr>
												<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text">{t("pages.xray.warp.accessToken")}</td>
												<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text">
													<Badge colorScheme="green">
														{t("configured")}
													</Badge>
												</td>
											</tr>
										)}
										<tr>
											<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text">{t("inbounds.wireguard.privateKey")}</td>
											<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text">
												<p className="truncate font-mono text-[0.75rem]">
													{nordData.private_key}
												</p>
											</td>
										</tr>
									</tbody>
								</table>
								<Button size="md" colorScheme="red" variant="outline" loading={loading} onClick={deleteData} className="self-start">{<TrashIcon className="w-[16px]" />}
									{t("logout.variant2")}
								</Button>
								<hr className="w-full border-0 border-b border-panel-border! opacity-60" />
								<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
									<FormControl>
										<FormLabel>{t("pages.xray.outbound.country")}</FormLabel>
										<Select
											value={countryID}
											onChange={(event) => void fetchServers(event.target.value)}
										>
											<option value="">
												{t("select")}
											</option>
											{countries.map((country) => (
												<option key={country.id} value={country.id}>
													{country.name}
													{country.code ? ` (${country.code})` : ""}
												</option>
											))}
										</Select>
									</FormControl>
									<FormControl disabled={cities.length === 0}>
										<FormLabel>{t("pages.xray.outbound.city")}</FormLabel>
										<Select
											value={cityID}
											onChange={(event) => setCityID(event.target.value)}
										>
											<option value="">
												{t("pages.xray.outbound.allCities")}
											</option>
											{cities.map((city) => (
												<option key={city.id} value={city.id}>
													{city.name}
												</option>
											))}
										</Select>
									</FormControl>
									<FormControl disabled={filteredServers.length === 0}>
										<FormLabel>{t("pages.xray.outbound.server")}</FormLabel>
										<Select
											value={serverID}
											onChange={(event) => setServerID(event.target.value)}
										>
											<option value="">
												{t("select")}
											</option>
											{filteredServers.map((server) => (
												<option key={server.id} value={server.id}>
													{server.cityName} - {server.name ?? server.hostname} ({server.load}%)
												</option>
											))}
										</Select>
									</FormControl>
								</div>
								{selectedServer && (
									<div className="flex flex-row items-center gap-2 flex-wrap">
										<Tag colorScheme={loadColor(selectedServer.load)}>
											{selectedServer.load}% load
										</Tag>
										<Tag>{selectedServer.hostname}</Tag>
										<Tag>{selectedServer.station}:51820</Tag>
									</div>
								)}
							</div>
						)}
					</div>
				</XrayModalBody>
				<XrayModalFooter>
					<Button size="md" variant="ghost" onClick={onClose}>
						{t("close")}
					</Button>
					{nordData?.private_key && (
						<>
							<Button size="md" disabled={!serverID} onClick={saveOutbound} colorScheme="primary">{<ArrowPathIcon className="w-[16px]" />}
								{nordOutboundIndex >= 0
									? t("pages.xray.nord.updateOutbound")
									: t("pages.xray.nord.addOutbound")}
							</Button>
							{nordOutboundIndex >= 0 && (
								<Button size="md" colorScheme="red" variant="outline" onClick={() => onDelete(nordOutboundIndex)}>
									{t("delete")}
								</Button>
							)}
						</>
					)}
				</XrayModalFooter>
			</XrayModalContent>
		</Modal>
	);
};
