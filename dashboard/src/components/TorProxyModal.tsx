import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { FormControl, FormErrorMessage, FormHelperText, FormLabel } from "components/shadcn/field";
import { Input } from "components/shadcn/input";
import { Button, ButtonGroup } from "components/shadcn/button";
import { Badge } from "components/shadcn/badge";
import { Switch } from "components/shadcn/selection";
import { cn } from "lib/cn";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/outline";
import { type FC, useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { countrySelectOptions } from "../utils/countries";
import { MultiValueAutocomplete } from "./common/MultiValueAutocomplete";
import {
	XrayDialogSection,
	XrayFieldGrid,
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
	XrayModalHeader,
} from "./xray/XrayDialog";

export type TorProxyFormValues = {
	locations: string;
	startPort: number;
	portStep: number;
	direction: "up" | "down";
	tagPrefix: string;
	strict: boolean;
};

type TorProxyModalProps = {
	isOpen: boolean;
	isLoading: boolean;
	isMasterTarget: boolean;
	existingTags: string[];
	onClose: () => void;
	onSubmit: (values: TorProxyFormValues) => Promise<void>;
};

const defaults: TorProxyFormValues = {
	locations: "de",
	startPort: 9050,
	portStep: 1,
	direction: "up",
	tagPrefix: "tor",
	strict: true,
};

const parseLocations = (value: string) =>
	value
		.split(/[\s,;]+/)
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);

export const TorProxyModal: FC<TorProxyModalProps> = ({
	isOpen,
	isLoading,
	isMasterTarget,
	existingTags,
	onClose,
	onSubmit,
}) => {
	const { t, i18n } = useTranslation();
	const borderColor = "border-gray-200! dark:border-whiteAlpha-200!";
	const form = useForm<TorProxyFormValues>({ defaultValues: defaults });
	const locationsValue = useWatch({ control: form.control, name: "locations" });
	const startPort = useWatch({ control: form.control, name: "startPort" });
	const portStep = useWatch({ control: form.control, name: "portStep" });
	const direction = useWatch({ control: form.control, name: "direction" });
	const tagPrefix = useWatch({ control: form.control, name: "tagPrefix" });
	const preview = useMemo(() => {
		const locations = parseLocations(locationsValue || "").slice(0, 20);
		const basePort = Number(startPort);
		const step = Number(portStep);
		return locations.map((country, index) => ({
			country,
			port:
				direction === "down"
					? basePort - index * step
					: basePort + index * step,
			tag: `${(tagPrefix || "tor").trim()}-${country}`,
		}));
	}, [direction, locationsValue, portStep, startPort, tagPrefix]);
	const duplicateTag = preview.find((item) => existingTags.includes(item.tag))?.tag;
	const locationOptions = useMemo(
		() => countrySelectOptions(i18n.language),
		[i18n.language],
	);

	useEffect(() => {
		if (isOpen) form.reset(defaults);
	}, [form, isOpen]);

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered closeOnEsc={!isLoading} closeOnOverlayClick={!isLoading}>
			<ModalOverlay />
			<XrayModalContent>
				<form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col min-h-0 overflow-hidden">
					<XrayModalHeader
						subtitle={
							isMasterTarget
								? t("pages.xray.tor.descriptionAll")
								: t("pages.xray.tor.description")
						}
					>
						{t("pages.xray.tor.title")}
					</XrayModalHeader>
					<ModalCloseButton isDisabled={isLoading} />
					<XrayModalBody className="flex-1 min-h-0 overflow-y-auto">
						<div className="flex flex-col gap-3 items-stretch">
							<XrayDialogSection>
								<FormControl isInvalid={Boolean(form.formState.errors.locations)}>
									<FormLabel>
										{t("pages.xray.tor.locations")}
									</FormLabel>
									<Controller
										name="locations"
										control={form.control}
										rules={{
											validate: (value) => {
												const locations = parseLocations(value);
												if (locations.length === 0) {
													return t("pages.xray.tor.locationsRequired");
												}
												if (locations.length > 20) {
													return t("pages.xray.tor.locationsLimit");
												}
												if (locations.some((item) => !/^[a-z]{2}$/i.test(item))) {
													return t("pages.xray.tor.countryInvalid");
												}
												if (new Set(locations).size !== locations.length) {
													return t("pages.xray.tor.locationsDuplicate");
												}
												return true;
											},
										}}
										render={({ field }) => (
											<MultiValueAutocomplete
												allowCustom={false}
												options={locationOptions}
												placeholder={t("pages.xray.tor.locationsPlaceholder")}
												value={field.value}
												onChange={field.onChange}
											/>
										)}
									/>
									<FormHelperText>
										{t("pages.xray.tor.locationsHint")}
									</FormHelperText>
									<FormErrorMessage>
										{form.formState.errors.locations?.message}
									</FormErrorMessage>
								</FormControl>

								<XrayFieldGrid className="mt-3">
									<FormControl isInvalid={Boolean(form.formState.errors.startPort)}>
										<FormLabel>
											{t("pages.xray.tor.startPort")}
										</FormLabel>
										<Input type="number" inputMode="numeric" {...form.register("startPort", {
												valueAsNumber: true,
												required: t("pages.xray.tor.portRequired"),
												validate: (value) => {
													const count = Math.max(
														1,
														parseLocations(form.getValues("locations")).length,
													);
													const step = Number(form.getValues("portStep")) || 1;
													const end =
														form.getValues("direction") === "down"
															? value - (count - 1) * step
															: value + (count - 1) * step;
													return (
														(value >= 1024 && value <= 65535 && end >= 1024 && end <= 65535) ||
														t("pages.xray.tor.generatedPortInvalid")
													);
												},
											})} />
										<FormErrorMessage>
											{form.formState.errors.startPort?.message}
										</FormErrorMessage>
									</FormControl>
									<FormControl>
										<FormLabel>
											{t("pages.xray.tor.direction")}
										</FormLabel>
										<Controller
											name="direction"
											control={form.control}
											render={({ field }) => (
												<ButtonGroup isAttached size="sm" className="w-full">
													<Button size="md" type="button" leftIcon={<ArrowUpIcon className="w-14" />} variant={field.value === "up" ? "solid" : "outline"} colorScheme={field.value === "up" ? "primary" : "gray"} aria-pressed={field.value === "up"} onClick={() => field.onChange("up")} className="flex-1">
														{t("pages.xray.tor.directionUp")}
													</Button>
													<Button size="md" type="button" leftIcon={<ArrowDownIcon className="w-14" />} variant={field.value === "down" ? "solid" : "outline"} colorScheme={field.value === "down" ? "primary" : "gray"} aria-pressed={field.value === "down"} onClick={() => field.onChange("down")} className="flex-1">
														{t("pages.xray.tor.directionDown")}
													</Button>
												</ButtonGroup>
											)}
										/>
									</FormControl>
								</XrayFieldGrid>

								<XrayFieldGrid className="mt-3">
									<FormControl isInvalid={Boolean(form.formState.errors.portStep)}>
										<FormLabel>{t("pages.xray.tor.portStep")}</FormLabel>
										<Input type="number" inputMode="numeric" {...form.register("portStep", {
												valueAsNumber: true,
												min: {
													value: 1,
													message: t("pages.xray.tor.portStepInvalid"),
												},
												max: {
													value: 1000,
													message: t("pages.xray.tor.portStepInvalid"),
												},
											})} />
										<FormErrorMessage>
											{form.formState.errors.portStep?.message}
										</FormErrorMessage>
									</FormControl>
									<FormControl isInvalid={Boolean(
											form.formState.errors.tagPrefix || duplicateTag,
										)}>
										<FormLabel>{t("pages.xray.tor.tagPrefix")}</FormLabel>
										<Input placeholder="tor" {...form.register("tagPrefix", {
												required: t("pages.xray.tor.tagRequired"),
												validate: (value) =>
													Boolean(value.trim()) ||
													t("pages.xray.tor.tagRequired"),
											})} />
										<FormHelperText>
											{t("pages.xray.tor.tagPrefixHint")}
										</FormHelperText>
										<FormErrorMessage>
											{form.formState.errors.tagPrefix?.message ||
												(duplicateTag
													? t("pages.xray.outbound.tagExistsNamed", { tag: duplicateTag })
													: undefined)}
										</FormErrorMessage>
									</FormControl>
								</XrayFieldGrid>

								<div className={cn("mt-4 pt-3 border-t", borderColor)}>
									<div className="flex flex-row items-center gap-2 justify-between mb-2">
										<p className="text-[0.75rem] font-semibold">
											{t("pages.xray.tor.preview")}
										</p>
										<Badge variant="subtle">{preview.length}</Badge>
									</div>
									<div className="flex flex-col items-stretch gap-0 max-h-[152px] overflow-y-auto">
										{preview.map((item) => (
											<div key={item.country} className={cn("flex flex-row items-center gap-2 justify-between min-h-[34px] border-b text-[0.75rem]", borderColor)}>
												<p className="font-medium">{item.tag}</p>
												<p className="text-panel-text-muted font-mono">
													127.0.0.1:{item.port}
												</p>
											</div>
										))}
									</div>
								</div>
							</XrayDialogSection>
							<FormControl className="rb-dialog-switch-row">
								<FormLabel>
									{t("pages.xray.tor.strict")}
								</FormLabel>
								<Controller
									name="strict"
									control={form.control}
									render={({ field }) => (
										<Switch isChecked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
									)}
								/>
							</FormControl>
						</div>
					</XrayModalBody>
					<XrayModalFooter className="justify-end">
						<Button size="md" variant="outline" onClick={onClose} isDisabled={isLoading}>
							{t("cancel")}
						</Button>
						<Button size="md" type="submit" colorScheme="primary" isLoading={isLoading} isDisabled={Boolean(duplicateTag)}>
							{t("pages.xray.tor.start")}
						</Button>
					</XrayModalFooter>
				</form>
			</XrayModalContent>
		</Modal>
	);
};
