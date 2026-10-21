import { useBreakpointValue } from "hooks/useBreakpointValue";
import { useDisclosure } from "hooks/useDisclosure";
import { useOutsideClick } from "hooks/useOutsideClick";
import { Button } from "components/shadcn/button";
import { Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverTrigger } from "components/shadcn/popover";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "components/shadcn/tabs";
import { withClass } from "components/shadcn/icon";
import { cn } from "lib/cn";
import { CalendarIcon } from "@heroicons/react/24/outline";
import DatePicker from "components/common/DatePicker";
import dayjs, { type ManipulateType } from "dayjs";
import { type FC, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const CalendarIconStyled = withClass(CalendarIcon, "w-4 h-4");

type DateType = Date | null;

export type DateRangeValue = {
	start: Date;
	end: Date;
	presetKey?: string;
	key?: string;
	unit?: "hour" | "day" | "week" | "month";
};

export type DateRangePickerProps = {
	value: DateRangeValue;
	onChange: (value: DateRangeValue) => void;
	presets?: Array<{
		key: string;
		label: string;
		amount: number;
		unit: "hour" | "day" | "week" | "month";
	}>;
	defaultPreset?: string;
	showPresets?: boolean;
};

// A visually hidden native radio drives a chip: peer-checked/peer-focus replace Chakra's _checked/_focus.
const FilterItem = ({
	name,
	value,
	onSelect,
	className,
	children,
}: {
	name: string;
	value: string;
	onSelect: (value: string) => void;
	className?: string;
	children: ReactNode;
}) => (
	<label>
		<input type="radio" name={name} value={value} onChange={() => onSelect(value)} className="peer sr-only" />
		<div className={cn("min-w-[48px]! w-full h-full text-center cursor-pointer rounded-md border px-3 py-1 text-xs md:text-sm peer-checked:border-primary-500! peer-checked:bg-primary-500 peer-checked:text-white peer-focus:[box-shadow:0_0_0_2px_var(--primary-200)]", className)}>
			{children}
		</div>
	</label>
);

export const DateRangePicker: FC<DateRangePickerProps> = ({
	value,
	onChange,
	presets = [
		{ key: "24h", label: "24H", amount: 24, unit: "hour" },
		{ key: "7d", label: "7D", amount: 7, unit: "day" },
		{ key: "30d", label: "30D", amount: 30, unit: "day" },
		{ key: "90d", label: "90D", amount: 90, unit: "day" },
	],
	defaultPreset = "30d",
	showPresets = true,
}) => {
	const { t, i18n } = useTranslation();
	const { isOpen, onOpen, onClose } = useDisclosure();
	const radioGroupName = useId();
	const customRef = useRef(null);
	useOutsideClick({ ref: customRef, handler: onClose });
	const borderColor = "border-blackAlpha-200! dark:border-whiteAlpha-200!";
	const panelBg = "bg-white dark:bg-gray-900";
	const controlBg = "bg-white dark:bg-whiteAlpha-50";
	const mutedBg = "bg-gray-50 dark:bg-whiteAlpha-100";
	const relativeGroupName = `relative-filter-${radioGroupName}`;

	const filterOptionTypes = {
		h: "hour",
		d: "day",
		w: "week",
		m: "month",
		y: "year",
	};

	const customFilterOptions = useBreakpointValue({
		base: [
			{ title: "hours", options: ["1h", "3h", "6h", "12h"] },
			{ title: "days", options: ["1d", "2d", "3d", "4d"] },
			{ title: "weeks", options: ["1w", "2w", "3w", "4w"] },
			{ title: "months", options: ["1m", "2m", "3m", "6m"] },
		],
		md: [
			{ title: "hours", options: ["1h", "2h", "3h", "6h", "8h", "12h"] },
			{ title: "days", options: ["1d", "2d", "3d", "4d", "5d", "6d"] },
			{ title: "weeks", options: ["1w", "2w", "3w", "4w"] },
			{ title: "months", options: ["1m", "2m", "3m", "6m", "8m"] },
		],
	})!;

	const [tabIndex, setTabIndex] = useState(0);
	const [startDate, setStartDate] = useState<DateType>(value.start);
	const [endDate, setEndDate] = useState<DateType>(value.end);
	const [selectedPreset, setSelectedPreset] = useState<string>(
		value.presetKey || value.key || defaultPreset,
	);

	const monthsShown = useBreakpointValue({ base: 1, md: 2 });

	useEffect(() => {
		setStartDate(value.start);
		setEndDate(value.end);
		setSelectedPreset(value.presetKey || value.key || defaultPreset);
	}, [value, defaultPreset]);

	const handlePresetChange = (presetKey: string) => {
		const preset = presets.find((p) => p.key === presetKey);
		if (!preset) return;

		const alignUnit: ManipulateType = preset.unit === "hour" ? "hour" : "day";
		const end = dayjs().utc().endOf(alignUnit).toDate();
		const span = Math.max(preset.amount - 1, 0);
		const start = dayjs()
			.utc()
			.subtract(span, preset.unit as ManipulateType)
			.startOf(alignUnit)
			.toDate();

		setSelectedPreset(presetKey);
		onChange({ start, end, presetKey, key: presetKey, unit: preset.unit });
		onClose();
	};

	const handleRelativeChange = (value: string) => {
		const num = Number(value.substring(0, value.length - 1));
		const unit =
			filterOptionTypes[
				value[value.length - 1] as keyof typeof filterOptionTypes
			];
		const alignUnit: ManipulateType = unit === "hour" ? "hour" : "day";
		const end = dayjs().utc().endOf(alignUnit).toDate();
		const span = Math.max(num - 1, 0);
		const start = dayjs()
			.utc()
			.subtract(span, unit as ManipulateType)
			.startOf(alignUnit)
			.toDate();

		onChange({
			start,
			end,
			presetKey: "custom",
			key: "custom",
			unit: unit as "hour" | "day",
		});
		onClose();
	};

	const handleAbsoluteChange = (dates: [DateType, DateType]) => {
		const [start, end] = dates;
		if (endDate && !end) {
			setStartDate(null);
			setEndDate(null);
		} else {
			setStartDate(start);
			setEndDate(end);
			if (start && end) {
				const startDate = dayjs(start);
				const endDate = dayjs(end);
				const [minDate, maxDate] = startDate.isBefore(endDate)
					? [startDate, endDate]
					: [endDate, startDate];
				const startAligned = minDate.startOf("day").toDate();
				const endAligned = maxDate.endOf("day").toDate();
				const isSingleDay = minDate.isSame(maxDate, "day");
				onChange({
					start: startAligned,
					end: endAligned,
					presetKey: "custom",
					key: "custom",
					unit: isSingleDay ? "hour" : "day",
				});
				onClose();
			}
		}
	};

	const startLabel = dayjs(value.start).format("YYYY-MM-DD");
	const endLabel = dayjs(value.end).format("YYYY-MM-DD");
	const rangeLabel =
		startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;

	return (
		<div className="flex gap-2 flex-wrap justify-start md:justify-end">
			{showPresets &&
				presets.map((preset) => (
					<Button key={preset.key} size="sm" onClick={() => handlePresetChange(preset.key)} colorScheme="primary" variant={selectedPreset === preset.key ? "solid" : "outline"} className="rounded-md min-w-[52px]!">
						{preset.label}
					</Button>
				))}
			<Popover isOpen={isOpen} onClose={onClose} placement="auto-end" closeOnBlur={false}>
				<PopoverTrigger>
					<Button size="sm" variant="outline" leftIcon={<CalendarIconStyled />} onClick={onOpen} className={cn("min-w-[200px]! md:min-w-[240px]! max-w-[100%] rounded-md overflow-hidden text-ellipsis whitespace-nowrap", controlBg, borderColor)}>
						{rangeLabel}
					</Button>
				</PopoverTrigger>
				<PopoverContent className={cn("w-fit max-w-[calc(100vw_-_2rem)] focus:outline-none", panelBg, borderColor)}>
					<PopoverArrow />
					<PopoverBody ref={customRef} className="px-0 py-0">
						<Tabs variant="unstyled" onChange={(index) => setTabIndex(index)} index={tabIndex}>
							<TabList className="px-3 pt-3 gap-2">
								<Tab className="text-xs md:text-sm rounded-md px-3 py-1.5 aria-selected:bg-primary-500 aria-selected:text-white">
									{t("userDialog.relative")}
								</Tab>
								<Tab className="text-xs md:text-sm rounded-md px-3 py-1.5 aria-selected:bg-primary-500 aria-selected:text-white">
									{t("userDialog.absolute")}
								</Tab>
							</TabList>
							<TabPanels>
								<TabPanel className="px-3 pb-3">
									<div className="flex flex-col gap-3 items-stretch">
										{customFilterOptions.map((row) => (
											<div key={row.title} className="flex flex-col items-start gap-2">
												<p className="text-xs md:text-sm font-medium min-w-[60px]! text-gray-500">
													{t(`userDialog.${row.title}`, row.title)}
												</p>
												<div role="radiogroup" style={{ gridTemplateColumns: `repeat(${row.options.length}, minmax(0, 1fr))` }} className="grid gap-2 w-full">
													{row.options.map((option: string) => (
														<FilterItem key={option} name={relativeGroupName} value={option} onSelect={handleRelativeChange} className={mutedBg}>
															{option}
														</FilterItem>
													))}
												</div>
											</div>
										))}
									</div>
								</TabPanel>
								<TabPanel className="px-3 pb-3 datepicker-panel">
									<div className="flex flex-col items-center gap-2">
										<DatePicker
											locale={i18n.language.toLocaleLowerCase()}
											selected={startDate}
											onChange={handleAbsoluteChange}
											startDate={startDate}
											endDate={endDate}
											selectsRange={true}
											maxDate={new Date()}
											monthsShown={monthsShown}
											peekNextMonth={false}
											inline
										/>
									</div>
								</TabPanel>
							</TabPanels>
						</Tabs>
					</PopoverBody>
				</PopoverContent>
			</Popover>
		</div>
	);
};
