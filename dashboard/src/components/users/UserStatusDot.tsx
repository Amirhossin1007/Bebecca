import { Box, HStack, Text } from "@chakra-ui/react";
import { ONLINE_ACTIVE_WINDOW_SECONDS } from "constants/online";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { parseServerTimeToUnix } from "utils/dateFormatter";

type UserOnlineBadgeProps = {
	lastOnline?: string | null;
};

const isOnline = (lastOnline?: string | null): boolean => {
	const unixTime = parseServerTimeToUnix(lastOnline ?? null);
	if (!lastOnline || unixTime === null) return false;
	const secondsAgo = Math.floor(Date.now() / 1000) - unixTime;
	return secondsAgo <= ONLINE_ACTIVE_WINDOW_SECONDS;
};

export const UserOnlineBadge: FC<UserOnlineBadgeProps> = ({ lastOnline }) => {
	const { t } = useTranslation();
	const online = isOnline(lastOnline);

	return (
		<HStack
			as="span"
			className="rb-user-online-tag"
			data-online={online ? "true" : "false"}
			spacing={1}
		>
			<Box as="span" className="rb-user-status-dot" aria-hidden="true" />
			<Text as="span">{t(online ? "usersTable.online" : "usersTable.offline")}</Text>
		</HStack>
	);
};
