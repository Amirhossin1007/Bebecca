import { useToast } from "components/shadcn/toast";
import { Alert, AlertIcon } from "components/shadcn/alert";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "components/shadcn/tabs";
import { Card, CardBody } from "components/shadcn/card";
import { FormControl, FormHelperText, FormLabel } from "components/shadcn/field";
import { Switch } from "components/shadcn/selection";
import { Badge } from "components/shadcn/badge";
import { Button } from "components/shadcn/button";
import { Input } from "components/shadcn/input";
import { cn } from "lib/cn";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { PanelSelect } from "components/common/PanelSelect";
import { PageLoadingSkeleton } from "components/ui";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "react-query";
import {
	getSubscriptionPlaceholderSettings,
	type SubscriptionPlaceholderSetting,
	updateSubscriptionPlaceholderSetting,
} from "service/settings";

const keyFor = (
	item: Pick<SubscriptionPlaceholderSetting, "admin_id" | "service_id">,
) => `${item.admin_id ?? "default"}:${item.service_id}`;

const PlaceholderSettingsPage = () => {
	const { t } = useTranslation();
	const toast = useToast();
	const panelBg = "bg-whiteAlpha-800 dark:bg-whiteAlpha-50";
	const subtleBg = "bg-blackAlpha-50 dark:bg-whiteAlpha-50";
	const borderColor = "border-blackAlpha-200! dark:border-whiteAlpha-200!";
	const query = useQuery(
		"subscription-placeholder-settings",
		getSubscriptionPlaceholderSettings,
		{ refetchOnWindowFocus: false },
	);
	const [selectedKey, setSelectedKey] = useState("");
	const [draft, setDraft] = useState<SubscriptionPlaceholderSetting | null>(
		null,
	);

	const items = query.data?.items ?? [];
	const selected =
		items.find((item) => keyFor(item) === selectedKey) ?? items[0] ?? null;

	useEffect(() => {
		if (selected && selectedKey !== keyFor(selected)) {
			setSelectedKey(keyFor(selected));
		}
	}, [selected, selectedKey]);

	useEffect(() => {
		setDraft(selected ? { ...selected } : null);
	}, [selected]);

	const admins = useMemo(
		() =>
			Array.from(
				new Map(
					items
						.filter((item) => item.admin_id !== null)
						.map((item) => [item.admin_id as number, item.admin_username]),
				).entries(),
			),
		[items],
	);
	const adminItems = selected
		? items.filter((item) => item.admin_id === selected.admin_id)
		: [];

	const save = useMutation(updateSubscriptionPlaceholderSetting, {
		onSuccess: async (updated) => {
			setDraft(updated);
			setSelectedKey(keyFor(updated));
			await query.refetch();
			toast({
				title: t("placeholders.saved"),
				status: "success",
				duration: 2500,
			});
		},
		onError: (error: Error) => {
			toast({
				title: t("placeholders.saveFailed"),
				description: error.message,
				status: "error",
				duration: 5000,
			});
		},
	});

	const selectAdmin = (value: string | string[]) => {
		const raw = Array.isArray(value) ? value[0] : value;
		const adminID = raw === "default" ? null : Number(raw);
		const first = items.find((item) => item.admin_id === adminID);
		if (first) setSelectedKey(keyFor(first));
	};
	const selectService = (value: string | string[]) => {
		if (!selected) return;
		const serviceID = Number(Array.isArray(value) ? value[0] : value);
		setSelectedKey(`${selected.admin_id ?? "default"}:${serviceID}`);
	};
	const updateDraft = <K extends keyof SubscriptionPlaceholderSetting>(
		key: K,
		value: SubscriptionPlaceholderSetting[K],
	) =>
		setDraft((current) => (current ? { ...current, [key]: value } : current));

	if (query.isLoading) {
		return <PageLoadingSkeleton />;
	}
	if (query.isError) {
		return (
			<Alert status="error" className="rounded-xl">
				<AlertIcon />
				{t("placeholders.loadFailed")}
			</Alert>
		);
	}

	return (
		<div className="flex flex-col gap-5 max-w-[1180px] mx-auto">
			<div>
				<h2 className="font-heading font-bold text-[1.5rem] leading-[1.33] md:text-[1.875rem] md:leading-[1.2]">{t("placeholders.title")}</h2>
				<p className="mt-2 text-panel-text-secondary max-w-[760px]">
					{t("placeholders.subtitle")}
				</p>
			</div>

			<Tabs variant="soft-rounded" colorScheme="pink">
				<TabList>
					<Tab>{t("placeholders.tab")}</Tab>
				</TabList>
				<TabPanels>
					<TabPanel className="px-0 pb-0">
						<Card className={cn("border rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,.12)] [backdrop-filter:blur(18px)]", panelBg, borderColor)}>
							<CardBody className="p-4 md:p-7">
								{!draft ? (
									<div className="text-center py-14">
										<DocumentDuplicateIcon style={{ margin: "0 auto" }} className="w-42" />
										<h2 className="font-heading font-bold text-[1rem] leading-[1.2] mt-4">
											{t("placeholders.noServices")}
										</h2>
										<p className="text-panel-text-secondary mt-2">
											{t("placeholders.noServicesHint")}
										</p>
									</div>
								) : (
									<div className="flex flex-col gap-7">
										<div className={cn("grid grid-cols-1 gap-4", query.data?.manage_all ? "md:grid-cols-2" : "md:grid-cols-1")}>
											{query.data?.manage_all && (
												<FormControl>
													<FormLabel>{t("placeholders.scope")}</FormLabel>
													<PanelSelect
														value={draft.admin_id === null ? "default" : String(draft.admin_id)}
														onValueChange={selectAdmin}
														options={[
															{ value: "default", label: t("placeholders.serviceDefaults") },
															...admins.map(([id, username]) => ({ value: String(id), label: username })),
														]}
													/>
												</FormControl>
											)}
											<FormControl>
												<FormLabel>{t("placeholders.service")}</FormLabel>
												<PanelSelect
													value={String(draft.service_id)}
													onValueChange={selectService}
													options={adminItems.map((item) => ({
														value: String(item.service_id),
														label: item.service_name,
													}))}
												/>
											</FormControl>
										</div>

										{!draft.is_default && (
											<div className={cn("flex flex-row items-center gap-2 border rounded-xl p-4 justify-between", subtleBg, borderColor)}>
												<div>
													<p className="font-semibold">{t("placeholders.inherit")}</p>
													<p className="text-[0.875rem] text-panel-text-secondary mt-1">{t("placeholders.inheritHint")}</p>
												</div>
												<Switch colorScheme="pink" isChecked={draft.inherited} onChange={(event) => updateDraft("inherited", event.target.checked)} />
											</div>
										)}

										<div className={cn("flex flex-row gap-2 border rounded-xl p-4 justify-between items-center", subtleBg, borderColor)}>
											<div>
												<p className="font-semibold">
													{t("placeholders.enabled")}
												</p>
												<p className="text-[0.875rem] text-panel-text-secondary mt-1">
													{t("placeholders.enabledHint")}
												</p>
											</div>
											<Switch colorScheme="pink" isChecked={draft.enabled} isDisabled={draft.inherited} onChange={(event) =>
													updateDraft("enabled", event.target.checked)
												} />
										</div>

										<div className="flex flex-col gap-5">
											<PlaceholderField label={t("placeholders.expired")} hint={t("placeholders.expiredHint")} value={draft.expired_remark} isDisabled={draft.inherited} onChange={(value) =>
													updateDraft("expired_remark", value)
												} className="text-orange-400" />
											<PlaceholderField label={t("placeholders.limited")} hint={t("placeholders.limitedHint")} value={draft.limited_remark} isDisabled={draft.inherited} onChange={(value) =>
													updateDraft("limited_remark", value)
												} className="text-red-400" />
											<PlaceholderField label={t("placeholders.disabled")} hint={t("placeholders.disabledHint")} value={draft.disabled_remark} isDisabled={draft.inherited} onChange={(value) =>
													updateDraft("disabled_remark", value)
												} className="text-gray-400" />
										</div>

										<div>
											<p className="text-[0.875rem] font-semibold mb-2">
												{t("placeholders.variables")}
											</p>
											<div className="flex flex-wrap gap-2">
												{[
													"{USERNAME}",
													"{STATUS_TEXT}",
													"{DATA_USAGE}",
													"{DATA_LIMIT}",
													"{EXPIRE_DATE}",
												].map((variable) => (
													<div key={variable}>
														<Badge className="px-2.5 py-1 rounded-full normal-case">
															{variable}
														</Badge>
													</div>
												))}
											</div>
											<p className="text-panel-text-secondary text-[0.875rem] mt-2">
												{t("placeholders.variablesHint")}
											</p>
										</div>

										<div className="flex flex-row items-center gap-2 justify-end">
											<Button size="md" colorScheme="pink" isLoading={save.isLoading} onClick={() => save.mutate({ ...draft, inherit_default: draft.inherited })}>
												{t("placeholders.save")}
											</Button>
										</div>
									</div>
								)}
							</CardBody>
						</Card>
					</TabPanel>
				</TabPanels>
			</Tabs>
		</div>
	);
};

const PlaceholderField = ({
	label,
	hint,
	className,
	value,
	isDisabled,
	onChange,
}: {
	label: string;
	hint: string;
	className?: string;
	value: string;
	isDisabled?: boolean;
	onChange: (value: string) => void;
}) => (
	<FormControl>
		<div className="flex flex-row items-center mb-2 gap-2">
			<div className={cn("size-[8px] rounded-full bg-current", className)} />
			<FormLabel className="mb-0">{label}</FormLabel>
		</div>
		<Input value={value} isDisabled={isDisabled} maxLength={255} onChange={(event) => onChange(event.target.value)} />
		<FormHelperText>{hint}</FormHelperText>
	</FormControl>
);

export default PlaceholderSettingsPage;
