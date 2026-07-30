import { Box, Flex, Tag, TagLabel, TagLeftIcon, Text, VStack } from "@chakra-ui/react";
import { BoltIcon, ClockIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { Statistics } from "../components/Statistics";

export const DashboardPage = () => {
	const { t } = useTranslation();

	return (
		<VStack spacing={{ base: 4, md: 6 }} align="stretch">
			<Box pt={2} pb={{ base: 2, md: 4 }} px={{ base: 1, md: 2 }}>
				<Flex direction={{ base: "column", xl: "row" }} justify="space-between" align={{ base: "flex-start", xl: "center" }} gap={4}>
					<Box minW={0} w="full">
						<Text as="h1" fontSize={{ base: "2xl", md: "3xl" }} fontWeight="extrabold" color="panel.text" letterSpacing="tight" isTruncated>
							{t("dashboard")}
						</Text>
						<Text fontSize={{ base: "xs", md: "sm" }} color="panel.textSecondary" mt={1} fontWeight="medium" isTruncated>
							{t("dashboard.subtitle")}
						</Text>
					</Box>
					<Flex
						direction={{ base: "column", sm: "row" }}
						gap={2}
						w={{ base: "full", xl: "auto" }}
						wrap="nowrap"
						minW={0}
					>
						<Tag size={{ base: "sm", md: "md" }} variant="subtle" colorScheme="green" borderRadius="full" px={{ base: 2, md: 4 }} py={2} flex="1" justifyContent="center" minW={0}>
							<TagLeftIcon boxSize={{ base: "12px", md: "14px" }} as={BoltIcon} m={0} me={1.5} />
							<TagLabel fontWeight="bold" fontSize="clamp(10px, 2.5vw, 14px)" isTruncated>{t("systemOverview")}: {t("live")}</TagLabel>
						</Tag>
						<Tag size={{ base: "sm", md: "md" }} variant="subtle" colorScheme="green" borderRadius="full" px={{ base: 2, md: 4 }} py={2} flex="1" justifyContent="center" minW={0}>
							<TagLeftIcon boxSize={{ base: "12px", md: "14px" }} as={UserGroupIcon} m={0} me={1.5} />
							<TagLabel fontWeight="bold" fontSize="clamp(10px, 2.5vw, 14px)" isTruncated>{t("usersOverview")}: {t("live")}</TagLabel>
						</Tag>
						<Tag size={{ base: "sm", md: "md" }} variant="subtle" colorScheme="blue" borderRadius="full" px={{ base: 2, md: 4 }} py={2} flex="1" justifyContent="center" minW={0}>
							<TagLeftIcon boxSize={{ base: "12px", md: "14px" }} as={ClockIcon} m={0} me={1.5} />
							<TagLabel fontWeight="bold" fontSize="clamp(10px, 2.5vw, 14px)" isTruncated>{t("dashboard.updateInterval")}: {t("dashboard.every3Seconds")}</TagLabel>
						</Tag>
					</Flex>
				</Flex>
			</Box>
			<Statistics />
		</VStack>
	);
};
