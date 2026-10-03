import {
	Alert,
	AlertIcon,
	Box,
	HStack,
	Stack,
	Tag,
	Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import { fetch, getAPIErrorMessage } from "service/http";
import { diagnosticHref, type Diagnostic } from "utils/diagnostics";

export const useSystemDiagnostics = (enabled: boolean) =>
	useQuery<Diagnostic[]>(
		["system-diagnostics"],
		() => fetch("/system/diagnostics"),
		{ enabled, refetchInterval: 15000, staleTime: 10000, retry: false },
	);

export const SystemDiagnostics = ({
	issues,
	error,
}: {
	issues: Diagnostic[];
	error?: unknown;
}) => {
	const { t } = useTranslation();
	if (!issues.length && !error) return null;
	return (
		<Stack spacing={3} role="alert" aria-live="polite">
			<Text fontWeight="bold" color="red.400">
				{t("diagnostics.title")} ({issues.length})
			</Text>
			{Boolean(error) && (
				<Alert status="error" borderRadius="xl">
					<AlertIcon />
					{getAPIErrorMessage(error)}
				</Alert>
			)}
			{issues.map((issue, index) => (
				<Alert
					as={Link}
					to={diagnosticHref(issue)}
					role="link"
					aria-label={`${issue.resource}: ${issue.message}`}
					key={`${issue.target_id}-${issue.resource_type}-${index}`}
					status={
						issue.severity === "warning" ||
						issue.resource_type === "runtime_warning"
							? "warning"
							: "error"
					}
					borderRadius="xl"
					alignItems="flex-start"
					textDecoration="none"
					_hover={{ textDecoration: "none", boxShadow: "md" }}
					_focusVisible={{
						outline: "2px solid",
						outlineColor: "blue.400",
						outlineOffset: "2px",
					}}
				>
					<AlertIcon mt={1} />
					<Box minW={0} flex={1}>
						<HStack flexWrap="wrap" spacing={2} mb={2}>
							<Tag
								colorScheme={
									issue.severity === "warning" ||
									issue.resource_type === "runtime_warning"
										? "orange"
										: "red"
								}
								size="sm"
							>
								{t(
									`diagnostics.source.${issue.resource_type}`,
									issue.resource_type,
								)}
							</Tag>
							<Text fontWeight="semibold">{issue.resource}</Text>
							<Text fontSize="xs" dir="ltr">
								{issue.target_id}
							</Text>
							<Text fontSize="xs" textDecoration="underline">
								{t("diagnostics.openSection")}
							</Text>
						</HStack>
						<Text
							fontSize="sm"
							fontFamily="mono"
							whiteSpace="pre-wrap"
							wordBreak="break-word"
							dir="auto"
						>
							{issue.message}
						</Text>
					</Box>
				</Alert>
			))}
		</Stack>
	);
};
