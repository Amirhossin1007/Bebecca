import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { Alert, AlertIcon } from "components/shadcn/alert";
import { FormControl, FormErrorMessage, FormHelperText, FormLabel } from "components/shadcn/field";
import { Input, Textarea } from "components/shadcn/input";
import { Button } from "components/shadcn/button";
import { Badge } from "components/shadcn/badge";
import { cn } from "lib/cn";
import { type FC, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { fetch as apiFetch } from "service/http";
import { countrySelectOptions } from "../utils/countries";
import {
	MultiValueAutocomplete,
	splitMultiValueText,
} from "./common/MultiValueAutocomplete";
import {
	XrayDialogSection,
	XrayFieldGrid,
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
	XrayModalHeader,
} from "./xray/XrayDialog";

export type PsiphonProxyFormValues = {
	config: string;
	locations: string;
	port: number;
	tag: string;
};

type Props = {
	isOpen: boolean;
	isLoading: boolean;
	isMasterTarget: boolean;
	targetID: string;
	existingTags: string[];
	onClose: () => void;
	onSubmit: (values: PsiphonProxyFormValues) => Promise<void>;
};

const defaults: PsiphonProxyFormValues = {
	config: "",
	locations: "",
	port: 20888,
	tag: "psiphon",
};

export const PsiphonProxyModal: FC<Props> = ({
	isOpen,
	isLoading,
	isMasterTarget,
	targetID,
	existingTags,
	onClose,
	onSubmit,
}) => {
	const { t, i18n } = useTranslation();
	const form = useForm<PsiphonProxyFormValues>({ defaultValues: defaults });
	const borderColor = "border-gray-200! dark:border-whiteAlpha-200!";
	const [isLoadingLocations, setIsLoadingLocations] = useState(false);
	const [availableLocations, setAvailableLocations] = useState<string[]>([]);
	const [loadedConfig, setLoadedConfig] = useState("");
	const [loadError, setLoadError] = useState("");
	const locationOptions = useMemo(
		() => countrySelectOptions(i18n.language, availableLocations),
		[availableLocations, i18n.language],
	);
	const config = form.watch("config").trim();
	const locationsReady =
		availableLocations.length > 0 && loadedConfig === config;
	const locations = splitMultiValueText(form.watch("locations")).map((value) =>
		value.toLowerCase(),
	);
	const tag = form.watch("tag").trim();
	const startPort = Number(form.watch("port"));
	const preview = locations.map((location, index) => ({
		location,
		port: startPort + index,
		tag: `${tag}-${location}`,
	}));
	const duplicateTag = preview.find((item) => existingTags.includes(item.tag))?.tag;

	useEffect(() => {
		if (!isOpen) return;
		form.reset(defaults);
		setAvailableLocations([]);
		setLoadedConfig("");
		setLoadError("");
	}, [form, isOpen]);

	const loadLocations = async () => {
		if (!(await form.trigger("config"))) return;
		setIsLoadingLocations(true);
		setLoadError("");
		const configValue = form.getValues("config").trim();
		try {
			const response = await apiFetch<{
				success: boolean;
				obj?: { locations?: string[] };
				msg?: string;
			}>("/panel/xray/psiphon/locations", {
				method: "POST",
				body: { target_id: targetID, config: configValue },
			});
			if (!response?.success) {
				throw new Error(response?.msg || t("pages.xray.psiphon.locationsFailed"));
			}
			const locations = (response.obj?.locations ?? []).filter((value) =>
				/^[a-z]{2}$/i.test(value),
			);
			if (locations.length === 0) {
				throw new Error(t("pages.xray.psiphon.noLocations"));
			}
			setAvailableLocations(locations.map((value) => value.toLowerCase()));
			setLoadedConfig(configValue);
			form.setValue("locations", "", { shouldValidate: true });
		} catch (error: any) {
			setAvailableLocations([]);
			setLoadedConfig("");
			const detail =
				error?.response?._data?.detail ??
				error?.data?.detail ??
				error?.message ??
				t("pages.xray.psiphon.locationsFailed");
			setLoadError(typeof detail === "string" ? detail : JSON.stringify(detail));
		} finally {
			setIsLoadingLocations(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered closeOnEsc={!isLoading && !isLoadingLocations} closeOnOverlayClick={!isLoading && !isLoadingLocations}>
			<ModalOverlay />
			<XrayModalContent>
				<form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col min-h-0 overflow-hidden">
					<XrayModalHeader subtitle={t("pages.xray.psiphon.description")}>
						{t("pages.xray.psiphon.title")}
					</XrayModalHeader>
					<ModalCloseButton isDisabled={isLoading || isLoadingLocations} />
					<XrayModalBody className="flex-1 min-h-0 overflow-y-auto">
						<div className="flex flex-col gap-3 items-stretch">
							{isMasterTarget && (
								<Alert status="warning" className="rounded-xs text-[0.875rem]">
									<AlertIcon />
									{t("pages.xray.psiphon.nodeRequired")}
								</Alert>
							)}
							<XrayDialogSection title={t("pages.xray.psiphon.config")}>
								<FormControl isInvalid={Boolean(form.formState.errors.config)}>
									<FormLabel>{t("pages.xray.psiphon.config")}</FormLabel>
									<Textarea spellCheck={false} {...form.register("config", {
											required: t("pages.xray.psiphon.configRequired"),
											maxLength: {
												value: 1 << 20,
												message: t("pages.xray.psiphon.configInvalid"),
											},
											validate: (value) => {
												try {
													const parsed = JSON.parse(value);
													return (
														(parsed && typeof parsed === "object" && !Array.isArray(parsed)) ||
														t("pages.xray.psiphon.configInvalid")
													);
												} catch {
													return t("pages.xray.psiphon.configInvalid");
												}
											},
										})} className="font-mono min-h-[160px]" />
									<FormHelperText>
										{t("pages.xray.psiphon.configHint")}
									</FormHelperText>
									<FormErrorMessage>
										{form.formState.errors.config?.message}
									</FormErrorMessage>
									<Button size="sm" type="button" variant="outline" isLoading={isLoadingLocations} isDisabled={isMasterTarget || isLoading} onClick={loadLocations} className="mt-3">
										{t("pages.xray.psiphon.loadLocations")}
									</Button>
									{loadError && (
										<Alert status="error" className="mt-3 rounded-xs text-[0.875rem]">
											<AlertIcon />
											{loadError}
										</Alert>
									)}
								</FormControl>
							</XrayDialogSection>
							<XrayDialogSection title={t("pages.xray.psiphon.proxy")}>
								<FormControl isInvalid={Boolean(form.formState.errors.locations)}>
									<FormLabel>{t("pages.xray.psiphon.locations")}</FormLabel>
									<Controller
										name="locations"
										control={form.control}
										rules={{
										validate: (value) => {
											if (!locationsReady) {
												return t("pages.xray.psiphon.locationsRequired");
											}
											const selected = splitMultiValueText(value);
												if (selected.length === 0) {
													return t("pages.xray.psiphon.locationsRequired");
												}
											if (selected.length > 20) {
													return t("pages.xray.psiphon.locationsLimit");
											}
											if (
												selected.some(
													(item) => !availableLocations.includes(item.toLowerCase()),
												)
											) {
												return t("pages.xray.psiphon.locationsRequired");
											}
												return (
													new Set(selected.map((item) => item.toLowerCase())).size ===
														selected.length || t("pages.xray.psiphon.locationsDuplicate")
												);
											},
										}}
										render={({ field }) => (
											<MultiValueAutocomplete
												allowCustom={false}
												isDisabled={!locationsReady || isLoadingLocations}
												options={locationOptions}
												placeholder={t("pages.xray.psiphon.selectLocations")}
												value={field.value}
												onChange={field.onChange}
											/>
										)}
									/>
									<FormHelperText>
										{t("pages.xray.psiphon.locationsHint")}
									</FormHelperText>
									<FormErrorMessage>
										{form.formState.errors.locations?.message}
									</FormErrorMessage>
								</FormControl>
								<XrayFieldGrid className="mt-3">
									<FormControl isInvalid={Boolean(form.formState.errors.port)}>
										<FormLabel>{t("pages.xray.psiphon.port")}</FormLabel>
										<Input type="number" inputMode="numeric" {...form.register("port", {
												valueAsNumber: true,
												validate: (value) =>
													(value >= 1024 && value + Math.max(0, locations.length - 1) <= 65535) ||
													t("pages.xray.psiphon.portInvalid"),
											})} />
										<FormErrorMessage>
											{form.formState.errors.port?.message}
										</FormErrorMessage>
									</FormControl>
									<FormControl isInvalid={Boolean(form.formState.errors.tag || duplicateTag)}>
										<FormLabel>{t("pages.xray.psiphon.tagPrefix")}</FormLabel>
										<Input {...form.register("tag", {
												required: t("pages.xray.psiphon.tagRequired"),
												pattern: {
													value: /^[a-zA-Z0-9_.-]+$/,
													message: t("pages.xray.psiphon.tagInvalid"),
												},
											})} />
										<FormErrorMessage>
											{form.formState.errors.tag?.message ||
												(duplicateTag
													? t("pages.xray.outbound.tagExistsNamed", {
															tag: duplicateTag,
														})
													: undefined)}
										</FormErrorMessage>
									</FormControl>
								</XrayFieldGrid>
								<div className={cn("mt-4 pt-3 border-t", borderColor)}>
									<div className="flex flex-row items-center gap-2 justify-between mb-2">
										<p className="text-[0.75rem] font-semibold">
											{t("pages.xray.psiphon.preview")}
										</p>
										<Badge variant="subtle">{preview.length}</Badge>
									</div>
									<div className="flex flex-col items-stretch gap-0 max-h-[152px] overflow-y-auto">
										{preview.map((item, index) => (
											<div key={`${item.location}-${index}`} className={cn("flex flex-row items-center gap-2 justify-between min-h-[34px] border-b text-[0.75rem]", borderColor)}>
												<p className="font-medium">{item.tag}</p>
												<p className="text-panel-text-muted font-mono">
													127.0.0.1:{item.port}
												</p>
											</div>
										))}
									</div>
								</div>
							</XrayDialogSection>
						</div>
					</XrayModalBody>
					<XrayModalFooter className="justify-end">
						<Button size="md" variant="outline" onClick={onClose} isDisabled={isLoading || isLoadingLocations}>
							{t("cancel")}
						</Button>
						<Button size="md" type="submit" colorScheme="primary" isLoading={isLoading} isDisabled={
								isMasterTarget ||
								!locationsReady ||
								isLoadingLocations ||
								Boolean(duplicateTag)
							}>
							{t("pages.xray.psiphon.start")}
						</Button>
					</XrayModalFooter>
				</form>
			</XrayModalContent>
		</Modal>
	);
};
