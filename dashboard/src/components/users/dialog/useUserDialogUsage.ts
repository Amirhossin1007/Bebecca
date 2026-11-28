import { createUsageConfig } from "components/UsageFilter";
import { type FilterUsageType, useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { useColorMode } from "lib/color-mode";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { User, UserListItem } from "types/User";
import type { TabValue } from "./userDialog.types";

type UseUserDialogUsageOptions = {
	editingUser: User | null;
	isEditing: boolean;
	canViewTraffic: boolean;
	editingUserInitialTab: number | null;
};

export const useUserDialogUsage = ({
	editingUser,
	isEditing,
	canViewTraffic,
	editingUserInitialTab,
}: UseUserDialogUsageOptions) => {
	const { t } = useTranslation();
	const { colorMode } = useColorMode();
	const fetchUserUsage = useDashboard((state) => state.fetchUserUsage);

	const [tab, setTab] = useState<TabValue>("details");
	const [usageFilter, setUsageFilter] = useState("1m");
	const [usageFetched, setUsageFetched] = useState(false);
	const usageTitle = t("userDialog.total");
	const [usage, setUsage] = useState(() =>
		createUsageConfig(colorMode, usageTitle),
	);
	const usageFetchSequence = useRef(0);

	const fetchUsageWithFilter = useCallback(
		(query: FilterUsageType) => {
			if (!editingUser) return;
			const requestId = ++usageFetchSequence.current;
			fetchUserUsage(editingUser as unknown as UserListItem, query)
				.then((data) => {
					if (requestId !== usageFetchSequence.current) return;
					const usages = (
						data as unknown as {
							usages: Record<string, { used_traffic: number; node_name: string }>;
						}
					).usages;
					const series: number[] = [];
					const labels: string[] = [];
					for (const key in usages) {
						const usedTraffic = Number(usages[key]?.used_traffic ?? 0);
						if (!usedTraffic || usedTraffic <= 0) {
							continue;
						}
						series.push(usedTraffic);
						labels.push(usages[key].node_name);
					}
					setUsage(createUsageConfig(colorMode, usageTitle, series, labels));
				})
				.catch((fetchError) => {
					if (requestId === usageFetchSequence.current) {
						console.error("Failed to fetch user usage:", fetchError);
					}
				});
		},
		[editingUser, colorMode, usageTitle, fetchUserUsage],
	);

	useEffect(() => {
		if (!isEditing || !canViewTraffic || editingUserInitialTab !== 1 || usageFetched) {
			return;
		}
		setUsageFetched(true);
		setTab("usage");
		fetchUsageWithFilter({
			start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
		});
	}, [
		isEditing,
		canViewTraffic,
		editingUserInitialTab,
		usageFetched,
		fetchUsageWithFilter,
	]);

	const handleTabChange = (value: string) => {
		const next = value as TabValue;
		setTab(next);
		if (next === "usage" && isEditing && !usageFetched) {
			setUsageFetched(true);
			fetchUsageWithFilter({
				start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
			});
		}
	};

	return {
		tab,
		usageFilter,
		setUsageFilter,
		usage,
		fetchUsageWithFilter,
		handleTabChange,
	};
};
