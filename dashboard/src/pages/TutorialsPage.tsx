import { Box, Center, Text, useColorModeValue } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHref, useSearchParams } from "react-router-dom";
import { getTutorialsUrl } from "utils/tutorials";

export const TutorialsPage = () => {
	const { t, i18n } = useTranslation();
	const dashboardRoot = useHref("/");
	const [searchParams] = useSearchParams();
	const [isLoaded, setIsLoaded] = useState(false);
	const borderColor = useColorModeValue("panel.border", "panel.border");
	const frameBg = useColorModeValue("panel.surface", "panel.surface");
	const frameSrc = getTutorialsUrl(
		dashboardRoot,
		i18n.language,
		searchParams.get("doc") || "",
	);
	return (
		<Box
			borderWidth="1px"
			borderColor={borderColor}
			borderRadius="md"
			overflow="hidden"
			position="relative"
			h={{ base: "calc(100dvh - 172px)", md: "calc(100dvh - 96px)" }}
			minH={{ base: "420px", md: "560px" }}
			bg={frameBg}
		>
			{!isLoaded ? (
				<Center position="absolute" inset={0} bg={frameBg}>
					<Text color="panel.textMuted">{t("loading")}...</Text>
				</Center>
			) : null}
			<Box
				as="iframe"
				title={t("tutorials.menu")}
				src={frameSrc}
				w="100%"
				h="100%"
				border="0"
				bg={frameBg}
				opacity={isLoaded ? 1 : 0}
				onLoad={() => setIsLoaded(true)}
			/>
		</Box>
	);
};
