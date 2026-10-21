import { FormControl, FormErrorMessage, FormHelperText, FormLabel } from "components/shadcn/field";
import { Button } from "components/shadcn/button";
import { Input, Select, Textarea } from "components/shadcn/input";
import { Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel } from "components/shadcn/accordion";
import { cn } from "lib/cn";
import { useTranslation } from "react-i18next";
import { hostClientSettingsError, parseHostClientSettings } from "utils/hostClientSettings";

const TLS_FIELDS = [
	["echConfigList", "ECH Config List", "cloudflare-ech.com+udp://1.1.1.1"],
	["cipherSuites", "TLS Cipher Suites", "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"],
	["curvePreferences", "TLS Curve Preferences", "X25519, CurveP256"],
] as const;

const PERFORMANCE_FIELDS: Record<string, readonly string[]> = {
	sockopt: ["tcpFastOpen", "tcpMptcp", "tcpKeepAliveIdle", "tcpKeepAliveInterval", "tcpUserTimeout", "tcpCongestion", "tcpMaxSeg", "tcpWindowClamp", "domainStrategy"],
	wsSettings: ["heartbeatPeriod"],
	grpcSettings: ["multiMode", "idle_timeout", "health_check_timeout", "permit_without_stream", "initial_windows_size", "user_agent"],
	kcpSettings: ["uplinkCapacity", "downlinkCapacity"],
	xhttpSettings: ["scMaxEachPostBytes", "scMinPostsIntervalMs"],
	mux: ["concurrency", "xudpConcurrency", "xudpProxyUDP443"],
};
const BOOL_FIELDS = new Set(["tcpFastOpen", "tcpMptcp", "permit_without_stream", "multiMode"]);
const TEXT_FIELDS = new Set(["tcpCongestion", "domainStrategy", "user_agent", "scMaxEachPostBytes", "scMinPostsIntervalMs", "xudpProxyUDP443"]);

export const HostClientSettingsEditor = ({ value, onChange, usesTLS, protocol, network }: {
	value: string;
	onChange: (value: string) => void;
	usesTLS: boolean;
	protocol?: string;
	network?: string;
}) => {
	const { t } = useTranslation();
	const error = hostClientSettingsError(value);
	const settings = error ? {} : parseHostClientSettings(value);
	const object = (group: string) => {
		const result = settings[group];
		return result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : {};
	};
	const update = (group: string, key: string, next: unknown) => {
		const changed = { ...object(group) };
		if (next === undefined) delete changed[key];
		else changed[key] = next;
		const result = { ...settings };
		if (Object.keys(changed).length) result[group] = changed;
		else delete result[group];
		onChange(JSON.stringify(result, null, 2));
	};
	const transportGroup = ({ ws: "wsSettings", httpupgrade: "httpupgradeSettings", grpc: "grpcSettings", gun: "grpcSettings", kcp: "kcpSettings", mkcp: "kcpSettings", xhttp: "xhttpSettings", splithttp: "xhttpSettings" } as Record<string, string>)[network ?? ""];
	return (
		<div className="flex flex-col gap-3">
			<p className="text-[0.875rem] text-gray-500">{t("hostsDialog.clientSettingsHint")}</p>
			{usesTLS && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{TLS_FIELDS.map(([key, label, placeholder]) => (
						<FormControl key={key} isDisabled={Boolean(error)} className={cn(key === "echConfigList" ? "[grid-column:1_/_-1]" : "")}>
							<div className="flex flex-row items-center gap-2 justify-between">
								<FormLabel>{label}</FormLabel>
								<Button size="xs" variant="ghost" isDisabled={Boolean(error)} onClick={() => update("tlsSettings", key, undefined)}>{t("hostsDialog.clientInherit")}</Button>
							</div>
							<Input dir="ltr" value={String(object("tlsSettings")[key] ?? "")} placeholder={placeholder} onChange={(event) => update("tlsSettings", key, key === "curvePreferences" ? event.target.value ? event.target.value.split(",").map((item) => item.trim()) : [] : event.target.value.trim())} onBlur={() => {
									if (key === "curvePreferences" && Array.isArray(object("tlsSettings")[key])) {
										update("tlsSettings", key, (object("tlsSettings")[key] as string[]).filter(Boolean));
									}
								}} />
							{key === "echConfigList" && <FormHelperText>{t("hostsDialog.clientECHHint")}</FormHelperText>}
						</FormControl>
					))}
					{["minVersion", "maxVersion", "enableSessionResumption", "disableSystemRoot"].map((key) => {
						const bool = key === "enableSessionResumption" || key === "disableSystemRoot";
						return <FormControl key={key} isDisabled={Boolean(error)}>
							<FormLabel>{key}</FormLabel>
							<Select value={String(object("tlsSettings")[key] ?? "")} onChange={(event) => update("tlsSettings", key, event.target.value === "" ? undefined : bool ? event.target.value === "true" : event.target.value)}>
								<option value="">{t("hostsDialog.clientInherit")}</option>
								{(bool ? ["true", "false"] : ["1.0", "1.1", "1.2", "1.3"]).map((option) => <option key={option} value={option}>{option}</option>)}
							</Select>
						</FormControl>;
					})}
				</div>
			)}
			{protocol === "vmess" && <FormControl isDisabled={Boolean(error)}>
				<FormLabel>VMess Client Encryption</FormLabel>
				<Select value={String(settings.vmessSecurity ?? "")} onChange={(event) => {
					const next = { ...settings };
					if (event.target.value) next.vmessSecurity = event.target.value;
					else delete next.vmessSecurity;
					onChange(JSON.stringify(next, null, 2));
				}}>
					{["", "auto", "aes-128-gcm", "chacha20-poly1305", "none", "zero"].map((option) => <option key={option} value={option}>{option || t("hostsDialog.clientInherit")}</option>)}
				</Select>
			</FormControl>}
			<Accordion allowToggle>
				<AccordionItem className="border-0">
					<AccordionButton><div className="flex-1 text-start">{t("hostsDialog.clientTuning")}</div><AccordionIcon /></AccordionButton>
					<AccordionPanel className="px-0">
						<div className="flex flex-col gap-4">
							<p className="text-[0.875rem] text-orange-400">{t("hostsDialog.clientJSONHint")}</p>
							{["sockopt", transportGroup, "mux"].filter(Boolean).map((group) => (
								<div key={group} className="flex flex-col gap-2">
									<p className="font-semibold">{group}</p>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{(PERFORMANCE_FIELDS[group] ?? []).map((key) => <FormControl key={key} isDisabled={Boolean(error)}>
											<FormLabel className="text-[0.875rem]">{key}</FormLabel>
											{BOOL_FIELDS.has(key) ? <Select value={String(object(group)[key] ?? "")} onChange={(event) => update(group, key, event.target.value === "" ? undefined : event.target.value === "true")}>
												<option value="">{t("hostsDialog.clientInherit")}</option><option value="true">true</option><option value="false">false</option>
											</Select> : <Input dir="ltr" type={TEXT_FIELDS.has(key) ? "text" : "number"} min={-1} step={1} value={String(object(group)[key] ?? "")} placeholder={t("hostsDialog.clientInherit")} onChange={(event) => update(group, key, event.target.value === "" ? undefined : TEXT_FIELDS.has(key) ? event.target.value : Number(event.target.value))} />}
										</FormControl>)}
									</div>
								</div>
							))}
							<FormControl isInvalid={Boolean(error)}>
								<FormLabel>{t("hostsDialog.clientSettingsJSON")}</FormLabel>
								<Textarea dir="ltr" rows={8} value={value} onChange={(event) => onChange(event.target.value)} placeholder={'{"wsSettings":{"headers":{"User-Agent":"Mozilla/5.0"}}}'} className="font-mono" />
								<FormErrorMessage>{error}</FormErrorMessage>
								<FormHelperText>{t("hostsDialog.clientExtraHint")}</FormHelperText>
							</FormControl>
						</div>
					</AccordionPanel>
				</AccordionItem>
			</Accordion>
		</div>
	);
};
