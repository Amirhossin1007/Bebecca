import {
	Alert,
	AlertIcon,
	Box,
	CloseButton,
	HStack,
	Stack,
	Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useAPIRequestErrors } from "service/http";
import { requestErrorHref } from "utils/diagnostics";

export const RequestErrors = () => {
	const location = useLocation();
	const { errors, clear } = useAPIRequestErrors();
	const { t } = useTranslation();
	if (!errors.length) return null;
	return (
		<Stack spacing={2} mb={4} role="alert" aria-live="polite">
			{errors.map((item) => (
				<Box key={item.key} position="relative">
					<Alert
						as={Link}
						to={requestErrorHref(
							item.key,
							location.pathname.replace(/\/$/, "").endsWith("/xray-settings")
								? location.search
								: "",
						)}
						role="link"
						aria-label={`${t("diagnostics.requestFailed")}: ${item.message}`}
						status="error"
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
						<Box flex={1} minW={0}>
							<HStack justify="space-between" pe={8}>
								<Text fontWeight="semibold">
									{t("diagnostics.requestFailed")}
								</Text>
							</HStack>
							<Text fontSize="xs" fontFamily="mono" dir="ltr">
								{item.key}
							</Text>
							<Text fontSize="sm" whiteSpace="pre-wrap" wordBreak="break-word">
								{item.message}
							</Text>
						</Box>
					</Alert>
					<CloseButton
						position="absolute"
						insetEnd={2}
						top={2}
						size="sm"
						aria-label={t("close")}
						onClick={() => clear(item.key)}
					/>
				</Box>
			))}
		</Stack>
	);
};
