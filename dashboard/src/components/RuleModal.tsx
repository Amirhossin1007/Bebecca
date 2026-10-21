import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "components/shadcn/tabs";
import { FormControl, FormLabel } from "components/shadcn/field";
import { Button, IconButton } from "components/shadcn/button";
import { Checkbox, CheckboxGroup } from "components/shadcn/selection";
import { Input } from "components/shadcn/input";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { type FC, useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { MultiValueAutocomplete } from "./common/MultiValueAutocomplete";
import {
	SearchableTagSelect,
	type SearchableTagSelectOption,
} from "./common/SearchableTagSelect";
import { OutboundTestButton } from "./xray/OutboundTestButton";
import { PropagationTargets } from "./xray/PropagationTargets";
import {
	XrayDialogSection,
	XrayFieldGrid,
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
	XrayModalHeader,
} from "./xray/XrayDialog";

type AttributePair = {
	key: string;
	value: string;
};

type RuleFormValues = {
	type: string;
	domainMatcher: string;
	outboundTag: string;
	balancerTag: string;
	inboundTags: string[];
	networks: string[];
	protocols: string[];
	sourceIps: string;
	sourcePort: string;
	localOS: string;
	domain: string;
	ip: string;
	user: string;
	port: string;
	attrs: AttributePair[];
};

export type RoutingRule = {
	type?: string;
	domainMatcher?: string;
	outboundTag?: string;
	balancerTag?: string;
	inboundTag?: string[];
	network?: string[];
	protocol?: string[];
	source?: string[];
	sourcePort?: string[];
	localOS?: string[];
	domain?: string[];
	ip?: string[];
	user?: string[];
	port?: string;
	attrs?: Record<string, string>;
};

export interface RuleModalProps {
	open: boolean;
	mode: "create" | "edit";
	initialRule?: RoutingRule | null;
	availableInboundTags: string[];
	availableOutboundTags: SearchableTagSelectOption[];
	availableBalancerTags: string[];
	onTestOutbound?: (tag: string) => void;
	outboundTestingByTag?: Record<string, boolean>;
	sourceTarget: string;
	propagationBase: RoutingRule | null;
	onSubmit: (rule: RoutingRule, targetIds: string[]) => void;
	onClose: () => void;
}

const NETWORK_OPTIONS = ["tcp", "udp", "http", "quic", "grpc"];
const PROTOCOL_OPTIONS = ["http", "tls", "bittorrent", "quic"];
const TYPE_OPTIONS = ["field", "chained"];
const DOMAIN_MATCHER_OPTIONS = ["", "hybrid", "linear"];

const defaultFormValues: RuleFormValues = {
	type: "field",
	domainMatcher: "",
	outboundTag: "",
	balancerTag: "",
	inboundTags: [],
	networks: [],
	protocols: [],
	sourceIps: "",
	sourcePort: "",
	localOS: "",
	domain: "",
	ip: "",
	user: "",
	port: "",
	attrs: [],
};

const toDelimitedString = (value?: string | string[]) => {
	if (!value) {
		return "";
	}
	if (Array.isArray(value)) {
		return value.join(", ");
	}
	return value;
};

const splitStringList = (value: string) =>
	value
		.split(/[\s,]+/)
		.map((item) => item.trim())
		.filter(Boolean);

const toSingleTag = (value: unknown) => {
	if (Array.isArray(value)) {
		const firstValue = value.find(
			(item) => item != null && String(item).trim(),
		);
		return firstValue == null ? "" : String(firstValue).trim();
	}
	return value == null ? "" : String(value).trim();
};

const ruleToFormValues = (rule?: RoutingRule | null): RuleFormValues => {
	if (!rule) {
		return { ...defaultFormValues };
	}

	const attrs: AttributePair[] = rule.attrs
		? Object.entries(rule.attrs).map(([key, value]) => ({
				key,
				value: value == null ? "" : String(value),
			}))
		: [];

	const balancerTag = toSingleTag(rule.balancerTag);
	return {
		type: rule.type ?? "field",
		domainMatcher: rule.domainMatcher ?? "",
		outboundTag: balancerTag ? "" : toSingleTag(rule.outboundTag),
		balancerTag,
		inboundTags: Array.isArray(rule.inboundTag) ? rule.inboundTag : [],
		networks: Array.isArray(rule.network) ? rule.network : [],
		protocols: Array.isArray(rule.protocol) ? rule.protocol : [],
		sourceIps: toDelimitedString(rule.source),
		sourcePort: toDelimitedString(rule.sourcePort),
		localOS: toDelimitedString(rule.localOS),
		domain: toDelimitedString(rule.domain),
		ip: toDelimitedString(rule.ip),
		user: toDelimitedString(rule.user),
		port: toDelimitedString(rule.port),
		attrs,
	};
};

const formValuesToRule = (values: RuleFormValues): RoutingRule => {
	const rule: RoutingRule = {};

	if (values.type) rule.type = values.type;
	if (values.domainMatcher) rule.domainMatcher = values.domainMatcher;
	if (values.balancerTag) {
		rule.balancerTag = values.balancerTag;
	} else if (values.outboundTag) {
		rule.outboundTag = values.outboundTag;
	}
	if (values.inboundTags.length) rule.inboundTag = values.inboundTags;
	if (values.networks.length) rule.network = values.networks;
	if (values.protocols.length) rule.protocol = values.protocols;

	const source = splitStringList(values.sourceIps);
	if (source.length) rule.source = source;

	const sourcePort = splitStringList(values.sourcePort);
	if (sourcePort.length) rule.sourcePort = sourcePort;
	const localOS = splitStringList(values.localOS).map((value) =>
		value.toLowerCase(),
	);
	if (localOS.length) rule.localOS = localOS;

	const domain = splitStringList(values.domain);
	if (domain.length) rule.domain = domain;

	const ip = splitStringList(values.ip);
	if (ip.length) rule.ip = ip;

	const user = splitStringList(values.user);
	if (user.length) rule.user = user;

	const portValue = values.port.trim();
	if (portValue) rule.port = portValue;

	if (values.attrs.length) {
		const attrs: Record<string, string> = {};
		values.attrs.forEach(({ key, value }) => {
			if (!key.trim()) return;
			attrs[key.trim()] = value;
		});
		if (Object.keys(attrs).length) {
			rule.attrs = attrs;
		}
	}

	if (!rule.type) {
		rule.type = "field";
	}

	return rule;
};

export const RuleModal: FC<RuleModalProps> = ({
	open: isOpen,
	mode,
	initialRule,
	availableInboundTags,
	availableOutboundTags,
	availableBalancerTags,
	onTestOutbound,
	outboundTestingByTag = {},
	sourceTarget,
	propagationBase,
	onSubmit,
	onClose,
}) => {
	const { t } = useTranslation();
	const [targetIds, setTargetIds] = useState<string[]>([]);

	const {
		control,
		register,
		handleSubmit,
		reset,
		setValue,
		formState: { isSubmitting },
	} = useForm<RuleFormValues>({
		defaultValues: defaultFormValues,
	});

	const { fields, append, remove } = useFieldArray({
		control,
		name: "attrs",
	});

	useEffect(() => {
		if (isOpen) {
			reset(ruleToFormValues(initialRule));
			setTargetIds([]);
		}
	}, [isOpen, initialRule, reset]);

	const onAddAttribute = () => append({ key: "", value: "" });

	const handleClose = () => {
		onClose();
	};

	const handleSave = handleSubmit((values) => {
		const rule = formValuesToRule(values);
		onSubmit(rule, targetIds);
		handleClose();
	});

	const title = useMemo(
		() =>
			mode === "edit" ? t("pages.xray.rules.edit") : t("pages.xray.rules.add"),
		[mode, t],
	);

	return (
		<Modal open={isOpen} onClose={handleClose} size="3xl" scrollBehavior="inside">
			<ModalOverlay className="bg-blackAlpha-400" />
			<XrayModalContent as="form" onSubmit={handleSave}>
				<XrayModalHeader>{title}</XrayModalHeader>
				<ModalCloseButton />
				<XrayModalBody>
					<Tabs isLazy lazyBehavior="keepMounted" variant="unstyled">
						<TabList>
							<Tab>{t("form")}</Tab>
							<Tab>{t("pages.xray.propagate.tab")}</Tab>
						</TabList>
						<TabPanels>
							<TabPanel className="px-0">
								<div className="flex flex-col gap-3">
									<XrayDialogSection title={t("pages.outbound.basicSettings")}>
										<div className="flex flex-col gap-3">
											<FormControl>
												<FormLabel>{t("pages.xray.rules.type")}</FormLabel>
												<Controller
													control={control}
													name="type"
													render={({ field }) => (
														<SearchableTagSelect
															mode="single"
															options={TYPE_OPTIONS}
															value={field.value ?? ""}
															onChange={(value) => field.onChange(value as string)}
															placeholder={t("pages.xray.rules.type")}
															searchPlaceholder={t("search")}
														/>
													)}
												/>
											</FormControl>

											<FormControl>
												<FormLabel>{t("pages.xray.rules.outboundTag")}</FormLabel>
												<Controller
													control={control}
													name="outboundTag"
													render={({ field }) => (
														<div className="flex flex-row gap-2 items-start">
															<div className="flex-1 min-w-0!">
																<SearchableTagSelect
																	mode="single"
																	options={availableOutboundTags}
																	value={field.value ?? ""}
																	onChange={(value) => {
																		const nextValue = value as string;
																		field.onChange(nextValue);
																		if (nextValue) {
																			setValue("balancerTag", "", {
																				shouldDirty: true,
																			});
																		}
																	}}
																	placeholder={t("userDialog.flow.none")}
																	searchPlaceholder={t("search")}
																	emptyText={t("pages.xray.outbound.empty")}
																	rightElement={
																		<OutboundTestButton
																			label={t("pages.xray.routeTester.test")}
																			tag={field.value ?? ""}
																			isTesting={
																				outboundTestingByTag[field.value ?? ""]
																			}
																			onTest={onTestOutbound}
																		/>
																	}
																/>
															</div>
															<IconButton aria-label={t("remove")} size="sm" variant="ghost" disabled={!field.value} onClick={() => field.onChange("")} >{<XMarkIcon />}</IconButton>
														</div>
													)}
												/>
											</FormControl>

											<FormControl>
												<FormLabel>{t("pages.xray.rules.balancer")}</FormLabel>
												<Controller
													control={control}
													name="balancerTag"
													render={({ field }) => (
														<div className="flex flex-row gap-2 items-start">
															<div className="flex-1 min-w-0!">
																<SearchableTagSelect
																	mode="single"
																	options={availableBalancerTags}
																	value={field.value ?? ""}
																	onChange={(value) => {
																		const nextValue = value as string;
																		field.onChange(nextValue);
																		if (nextValue) {
																			setValue("outboundTag", "", {
																				shouldDirty: true,
																			});
																		}
																	}}
																	placeholder={t("userDialog.flow.none")}
																	searchPlaceholder={t("search")}
																	emptyText={t("pages.xray.balancer.empty")}
																/>
															</div>
															<IconButton aria-label={t("remove")} size="sm" variant="ghost" disabled={!field.value} onClick={() => field.onChange("")} >{<XMarkIcon />}</IconButton>
														</div>
													)}
												/>
											</FormControl>

											<FormControl>
												<FormLabel>{t("pages.xray.rules.inboundTag")}</FormLabel>
												<Controller
													control={control}
													name="inboundTags"
													render={({ field }) => (
														<SearchableTagSelect
															mode="multiple"
															options={availableInboundTags}
															value={field.value ?? []}
															onChange={(value) => field.onChange(value as string[])}
															placeholder={t("pages.xray.rules.inboundTag")}
															searchPlaceholder={t("search")}
															emptyText={t("pages.inbounds.empty")}
														/>
													)}
												/>
											</FormControl>
										</div>
									</XrayDialogSection>

									<XrayDialogSection title={t("pages.xray.Routings")}>
										<div className="flex flex-col gap-3">
											<FormControl>
												<FormLabel>{t("pages.xray.rules.domainMatcher")}</FormLabel>
												<Controller
													control={control}
													name="domainMatcher"
													render={({ field }) => (
														<SearchableTagSelect
															mode="single"
															options={DOMAIN_MATCHER_OPTIONS.map((option) => ({
																value: option,
																label: option || t("common.default"),
															}))}
															value={field.value ?? ""}
															onChange={(value) => field.onChange(value as string)}
															placeholder={t("common.default")}
															searchPlaceholder={t("search")}
														/>
													)}
												/>
											</FormControl>

											<FormControl>
												<FormLabel>{t("pages.xray.rules.network")}</FormLabel>
												<Controller
													control={control}
													name="networks"
													render={({ field }) => (
														<CheckboxGroup {...field}>
															<div className="flex flex-wrap gap-3">
																{NETWORK_OPTIONS.map((network) => (
																	<div key={network}>
																		<Checkbox value={network}>{network}</Checkbox>
																	</div>
																))}
															</div>
														</CheckboxGroup>
													)}
												/>
											</FormControl>

											<FormControl>
												<FormLabel>{t("pages.xray.rules.protocol")}</FormLabel>
												<Controller
													control={control}
													name="protocols"
													render={({ field }) => (
														<CheckboxGroup {...field}>
															<div className="flex flex-wrap gap-3">
																{PROTOCOL_OPTIONS.map((protocol) => (
																	<div key={protocol}>
																		<Checkbox value={protocol}>{protocol}</Checkbox>
																	</div>
																))}
															</div>
														</CheckboxGroup>
													)}
												/>
											</FormControl>
										</div>
									</XrayDialogSection>

									<XrayDialogSection title={t("pages.xray.rules.sourceGroup")}>
										<XrayFieldGrid>
											<FormControl>
												<FormLabel>{t("pages.xray.rules.source")}</FormLabel>
												<Controller
													control={control}
													name="sourceIps"
													render={({ field }) => (
														<MultiValueAutocomplete
															value={field.value ?? ""}
															onChange={field.onChange}
															placeholder={t("pages.xray.rules.useComma")}
														/>
													)}
												/>
											</FormControl>

											<FormControl>
												<FormLabel>{t("pages.xray.rules.sourcePort")}</FormLabel>
												<Controller
													control={control}
													name="sourcePort"
													render={({ field }) => (
														<MultiValueAutocomplete
															value={field.value ?? ""}
															onChange={field.onChange}
															placeholder="80, 443, 1000-2000"
														/>
													)}
												/>
											</FormControl>
											<FormControl>
												<FormLabel>Node OS (Xray 26.9.8+)</FormLabel>
												<Input size="sm" placeholder="linux, windows, darwin" {...register("localOS")} />
											</FormControl>
										</XrayFieldGrid>
									</XrayDialogSection>

									<XrayDialogSection title={t("pages.xray.rules.destinationGroup")}>
										<XrayFieldGrid>
											<FormControl>
												<FormLabel>{t("pages.xray.rules.ip")}</FormLabel>
												<Controller
													control={control}
													name="ip"
													render={({ field }) => (
														<MultiValueAutocomplete
															value={field.value ?? ""}
															onChange={field.onChange}
															placeholder="8.8.8.8, geoip:private"
														/>
													)}
												/>
											</FormControl>

											<FormControl>
												<FormLabel>{t("pages.xray.rules.domain")}</FormLabel>
												<Controller
													control={control}
													name="domain"
													render={({ field }) => (
														<MultiValueAutocomplete
															value={field.value ?? ""}
															onChange={field.onChange}
															placeholder="domain:example.com, geosite:category-ads"
														/>
													)}
												/>
											</FormControl>

											<FormControl>
												<FormLabel>{t("users")}</FormLabel>
												<Controller
													control={control}
													name="user"
													render={({ field }) => (
														<MultiValueAutocomplete
															value={field.value ?? ""}
															onChange={field.onChange}
															placeholder="email@example.com, user-tag"
														/>
													)}
												/>
											</FormControl>

											<FormControl>
												<FormLabel>{t("pages.xray.rules.port")}</FormLabel>
												<Controller
													control={control}
													name="port"
													render={({ field }) => (
														<MultiValueAutocomplete
															value={field.value ?? ""}
															onChange={field.onChange}
															placeholder="80, 443, 1000-2000"
														/>
													)}
												/>
											</FormControl>
										</XrayFieldGrid>
									</XrayDialogSection>

									<XrayDialogSection title={t("pages.xray.rules.attrs")}>
										<FormControl>
											<FormLabel>{t("pages.xray.rules.attrs")}</FormLabel>
											<Button onClick={onAddAttribute} size="xs" variant="outline" colorScheme="primary">{<PlusIcon className="w-[16px]" />}
												{t("add")}
											</Button>
										</FormControl>
										<div className="flex flex-col gap-2 mt-3">
											{fields.length === 0 && (
												<p className="text-[0.875rem] text-gray-500">
													{t("pages.xray.rules.attrsHelper")}
												</p>
											)}
											{fields.map((field, index) => (
												<div key={field.id} className="flex flex-row gap-2 items-start">
													<Input size="sm" placeholder={t("myaccount.apiKeyMasked")} {...register(`attrs.${index}.key` as const)} />
													<Input size="sm" placeholder={t("value")} {...register(`attrs.${index}.value` as const)} />
													<IconButton aria-label={t("a11y.removeAttribute")} size="sm" variant="ghost" onClick={() => remove(index)} >{<XMarkIcon className="w-[16px]" />}</IconButton>
												</div>
											))}
										</div>
									</XrayDialogSection>
								</div>
							</TabPanel>
							<TabPanel className="px-0">
								<PropagationTargets
									source={sourceTarget}
									section="routing.rules"
									before={propagationBase}
									after={null}
									selectedIds={targetIds}
									onChange={setTargetIds}
								/>
							</TabPanel>
						</TabPanels>
					</Tabs>
				</XrayModalBody>
				<XrayModalFooter className="justify-end">
					<Button size="md" variant="outline" onClick={handleClose}>
						{t("cancel")}
					</Button>
					<Button size="md" colorScheme="primary" type="submit" loading={isSubmitting}>
						{mode === "edit"
							? t("pages.xray.rules.edit")
							: t("pages.xray.rules.add")}
					</Button>
				</XrayModalFooter>
			</XrayModalContent>
		</Modal>
	);
};
