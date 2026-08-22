import {
	Alert,
	AlertIcon,
	Badge,
	Box,
	Button,
	Divider,
	FormControl,
	FormHelperText,
	FormLabel,
	Heading,
	HStack,
	Input,
	Link,
	SimpleGrid,
	Spinner,
	Stack,
	Switch,
	Text,
	useColorModeValue,
	useToast,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowTopRightOnSquareIcon,
	ArrowUpTrayIcon,
	CodeBracketIcon,
	FolderOpenIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { ExternalAppFilesModal } from "components/ExternalAppFilesModal";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link as RouterLink } from "react-router-dom";
import {
	deletePHPApp,
	getPHPApps,
	getSubscriptionSettings,
	installMirzaBot,
	installPHPArchive,
	setPHPAppEnabled,
	type PHPAppRecord,
} from "service/settings";

type TemplateID = "archive" | "mirzabot";

const errorDetail = (error: unknown) => {
	const candidate = error as {
		data?: { detail?: string };
		response?: { _data?: { detail?: string } };
		message?: string;
	};
	return (
		candidate?.data?.detail ||
		candidate?.response?._data?.detail ||
		candidate?.message ||
		String(error)
	);
};

export const PHPAppsPage = () => {
	const { t } = useTranslation();
	const toast = useToast();
	const queryClient = useQueryClient();
	const panelBg = useColorModeValue("panel.elevated", "panel.elevated");
	const borderColor = useColorModeValue("panel.border", "panel.border");
	const mutedColor = useColorModeValue(
		"panel.textSecondary",
		"panel.textSecondary",
	);
	const [template, setTemplate] = useState<TemplateID>("mirzabot");
	const [domain, setDomain] = useState("");
	const [name, setName] = useState("");
	const [archive, setArchive] = useState<File | null>(null);
	const [botToken, setBotToken] = useState("");
	const [adminID, setAdminID] = useState("");
	const [managedApp, setManagedApp] = useState<PHPAppRecord | null>(null);
	const [managerView, setManagerView] = useState<"file" | "php-config">("file");

	const appsQuery = useQuery("php-apps", getPHPApps, {
		refetchOnWindowFocus: false,
	});
	const certificatesQuery = useQuery(
		"subscription-settings",
		getSubscriptionSettings,
		{ refetchOnWindowFocus: false },
	);
	const apps = appsQuery.data?.apps ?? [];
	const usedDomains = useMemo(
		() => new Set(apps.map((app) => app.domain)),
		[apps],
	);
	const certificateOptions = useMemo(() => {
		const seen = new Set<string>();
		return (certificatesQuery.data?.certificates ?? [])
			.filter(
				(certificate) =>
					certificate.serve_tls &&
					(certificate.status === "active" ||
						certificate.status === "expiring"),
			)
			.flatMap((certificate) => [certificate.domain, ...certificate.alt_names])
			.filter((name) => {
				const key = name.toLowerCase();
				if (
					key === window.location.hostname.toLowerCase() ||
					seen.has(key) ||
					usedDomains.has(key)
				)
					return false;
				seen.add(key);
				return true;
			})
			.map((name) => ({ value: name, label: name, searchLabel: name }));
	}, [certificatesQuery.data?.certificates, usedDomains]);
	const selectedTemplate = appsQuery.data?.templates.find(
		(item) => item.id === template,
	);

	const installMutation = useMutation(
		async () => {
			if (!domain) throw new Error(t("phpApps.errors.domainRequired"));
			if (template === "archive") {
				if (!archive) throw new Error(t("phpApps.errors.archiveRequired"));
				return installPHPArchive({ domain, name, archive });
			}
			if (!botToken.trim() || !adminID.trim()) {
				throw new Error(t("phpApps.errors.mirzaFieldsRequired"));
			}
			return installMirzaBot({
				domain,
				bot_token: botToken.trim(),
				admin_id: adminID.trim(),
			});
		},
		{
			onSuccess: async () => {
				toast({
					title: t("phpApps.installSuccess"),
					status: "success",
					isClosable: true,
				});
				setDomain("");
				setName("");
				setArchive(null);
				setBotToken("");
				setAdminID("");
				await queryClient.invalidateQueries("php-apps");
			},
			onError: (error) => {
				toast({
					title: t("phpApps.installFailed"),
					description: errorDetail(error),
					status: "error",
					isClosable: true,
				});
			},
		},
	);

	const toggleMutation = useMutation(setPHPAppEnabled, {
		onSuccess: () => queryClient.invalidateQueries("php-apps"),
		onError: (error) => {
			toast({
				title: t("phpApps.actionFailed"),
				description: errorDetail(error),
				status: "error",
				isClosable: true,
			});
		},
	});

	const deleteMutation = useMutation(deletePHPApp, {
		onSuccess: () => {
			toast({ title: t("phpApps.deleteSuccess"), status: "success" });
			queryClient.invalidateQueries("php-apps");
		},
		onError: (error) => {
			toast({
				title: t("phpApps.actionFailed"),
				description: errorDetail(error),
				status: "error",
				isClosable: true,
			});
		},
	});

	const confirmDelete = (app: PHPAppRecord) => {
		if (!window.confirm(t("phpApps.deleteConfirm", { domain: app.domain })))
			return;
		deleteMutation.mutate(app.domain);
	};
	const openManager = (app: PHPAppRecord, view: "file" | "php-config") => {
		setManagerView(view);
		setManagedApp(app);
	};

	if (appsQuery.isLoading) {
		return (
			<VStack minH="50vh" justify="center">
				<Spinner />
			</VStack>
		);
	}

	return (
		<Stack spacing={5}>
			<ExternalAppFilesModal
				app={managedApp}
				initialView={managerView}
				onClose={() => setManagedApp(null)}
			/>
			<Box>
				<Heading size="lg">{t("phpApps.title")}</Heading>
				<Text color={mutedColor} mt={2}>
					{t("phpApps.description")}
				</Text>
			</Box>

			<Alert status="info" borderRadius="md">
				<AlertIcon />
				<Text fontSize="sm">{t("phpApps.resourceHint")}</Text>
			</Alert>

			<Box
				bg={panelBg}
				borderWidth="1px"
				borderColor={borderColor}
				borderRadius="md"
				p={{ base: 4, md: 5 }}
			>
				<Heading size="md" mb={4}>
					{t("phpApps.newApp")}
				</Heading>
				{!appsQuery.data?.supported ? (
					<Alert status="warning" mb={4} borderRadius="md">
						<AlertIcon />
						{appsQuery.data?.detail || t("phpApps.unsupported")}
					</Alert>
				) : null}
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
					<FormControl>
						<FormLabel>{t("phpApps.template")}</FormLabel>
						<Select
							value={template}
							onValueChange={(value) => setTemplate(value as TemplateID)}
							options={[
								{ value: "mirzabot", label: t("phpApps.mirzaTemplate") },
								{ value: "archive", label: t("phpApps.archiveTemplate") },
							]}
						/>
					</FormControl>
					<FormControl isRequired>
						<FormLabel>{t("phpApps.domainCertificate")}</FormLabel>
						<Select
							value={domain}
							onValueChange={(value) => setDomain(String(value))}
							options={certificateOptions}
							placeholder={t("phpApps.selectDomain")}
							showSearch
							emptyText={t("phpApps.noCertificates")}
						/>
						<FormHelperText>
							{t("phpApps.certificateHint")}{" "}
							<Link
								as={RouterLink}
								to="/settings#subscriptions"
								color="blue.300"
							>
								{t("phpApps.openSSLManager")}
							</Link>
						</FormHelperText>
					</FormControl>
				</SimpleGrid>

				{template === "mirzabot" ? (
					<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4}>
						<FormControl isRequired>
							<FormLabel>{t("phpApps.botToken")}</FormLabel>
							<Input
								type="password"
								value={botToken}
								onChange={(event) => setBotToken(event.target.value)}
								autoComplete="off"
							/>
						</FormControl>
						<FormControl isRequired>
							<FormLabel>{t("phpApps.telegramAdminID")}</FormLabel>
							<Input
								value={adminID}
								onChange={(event) => setAdminID(event.target.value)}
								inputMode="numeric"
							/>
						</FormControl>
					</SimpleGrid>
				) : (
					<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4}>
						<FormControl>
							<FormLabel>{t("phpApps.name")}</FormLabel>
							<Input
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</FormControl>
						<FormControl isRequired>
							<FormLabel>{t("phpApps.zipArchive")}</FormLabel>
							<Input
								type="file"
								accept=".zip,application/zip"
								pt={1}
								onChange={(event) =>
									setArchive(event.target.files?.[0] ?? null)
								}
							/>
							<FormHelperText>{t("phpApps.archiveHint")}</FormHelperText>
						</FormControl>
					</SimpleGrid>
				)}

				<Button
					mt={5}
					colorScheme="blue"
					leftIcon={<ArrowUpTrayIcon width={18} />}
					isLoading={installMutation.isLoading}
					isDisabled={
						!appsQuery.data?.supported ||
						selectedTemplate?.supported === false ||
						!domain
					}
					onClick={() => installMutation.mutate()}
				>
					{t("phpApps.install")}
				</Button>
				{selectedTemplate?.detail ? (
					<Text color="orange.300" fontSize="sm" mt={2}>
						{selectedTemplate.detail}
					</Text>
				) : null}
				{template === "mirzabot" && selectedTemplate?.source_url ? (
					<Link
						href={selectedTemplate.source_url}
						isExternal
						display="inline-flex"
						alignItems="center"
						gap={1}
						mt={2}
						fontSize="sm"
						color="blue.300"
					>
						{t("phpApps.latestRelease")}
						<ArrowTopRightOnSquareIcon width={14} />
					</Link>
				) : null}
			</Box>

			<Box
				bg={panelBg}
				borderWidth="1px"
				borderColor={borderColor}
				borderRadius="md"
				p={{ base: 4, md: 5 }}
			>
				<Heading size="md" mb={4}>
					{t("phpApps.installedApps")}
				</Heading>
				{apps.length === 0 ? (
					<Text color={mutedColor}>{t("phpApps.empty")}</Text>
				) : (
					<Stack spacing={3} divider={<Divider />}>
						{apps.map((app) => (
							<Box key={app.domain} py={2}>
								<Stack
									direction={{ base: "column", lg: "row" }}
									justify="space-between"
									align={{ base: "stretch", lg: "center" }}
									spacing={3}
								>
									<Box>
										<HStack spacing={2} flexWrap="wrap">
											<Text fontWeight="semibold">{app.name}</Text>
											<Badge colorScheme={app.enabled ? "green" : "gray"}>
												{app.enabled
													? t("phpApps.enabled")
													: t("phpApps.disabled")}
											</Badge>
											<Badge>
												{app.template === "mirzabot"
													? "MirzaBot"
													: app.runtime.toUpperCase()}
											</Badge>
										</HStack>
										<Text color={mutedColor} fontSize="sm" mt={1}>
											{app.domain}
											{app.bot_username ? ` · @${app.bot_username}` : ""}
											{app.php_version ? ` · PHP ${app.php_version}` : ""}
											{app.version ? ` · ${app.version}` : ""}
										</Text>
									</Box>
									<HStack spacing={3} flexWrap="wrap">
										<Button
											size="sm"
											variant="outline"
											leftIcon={<FolderOpenIcon width={16} />}
											onClick={() => openManager(app, "file")}
										>
											{t("phpApps.files.button")}
										</Button>
										{app.runtime === "php" ? (
											<Button
												size="sm"
												variant="outline"
												leftIcon={<CodeBracketIcon width={16} />}
												onClick={() => openManager(app, "php-config")}
											>
												{t("phpApps.files.phpConfig")}
											</Button>
										) : null}
										<Link href={app.public_url} isExternal>
											<Button
												size="sm"
												variant="outline"
												rightIcon={<ArrowTopRightOnSquareIcon width={16} />}
											>
												{t("phpApps.open")}
											</Button>
										</Link>
										<Switch
											isChecked={app.enabled}
											isDisabled={toggleMutation.isLoading}
											onChange={(event) =>
												toggleMutation.mutate({
													domain: app.domain,
													enabled: event.target.checked,
												})
											}
										/>
										<Button
											size="sm"
											variant="ghost"
											colorScheme="red"
											leftIcon={<TrashIcon width={16} />}
											isLoading={deleteMutation.isLoading}
											onClick={() => confirmDelete(app)}
										>
											{t("phpApps.delete")}
										</Button>
									</HStack>
								</Stack>
							</Box>
						))}
					</Stack>
				)}
			</Box>
		</Stack>
	);
};

export default PHPAppsPage;
