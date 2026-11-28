import type { ApexOptions } from "apexcharts";
import { UsageFilter } from "components/UsageFilter";
import type { FilterUsageType } from "contexts/DashboardContext";
import type { FC } from "react";
import ReactApexChart from "react-apexcharts";

type UserUsageTabProps = {
	usageFilter: string;
	usage: {
		options: ApexOptions;
		series: number[];
	};
	onFilterChange: (filter: string, query: FilterUsageType) => void;
};

export const UserUsageTab: FC<UserUsageTabProps> = ({
	usageFilter,
	usage,
	onFilterChange,
}) => (
	<div className="flex flex-col items-center gap-4">
		<UsageFilter defaultValue={usageFilter} onChange={onFilterChange} />
		<div className="w-full md:w-[70%]">
			<ReactApexChart
				options={usage.options}
				series={usage.series}
				type="donut"
			/>
		</div>
	</div>
);
