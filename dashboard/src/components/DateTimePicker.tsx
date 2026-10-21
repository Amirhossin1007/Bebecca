import { useColorModeValue } from "lib/color-mode";
import { useDisclosure } from "hooks/useDisclosure";
import { useBreakpointValue } from "hooks/useBreakpointValue";
import { Button, IconButton } from "components/shadcn/button";
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay } from "components/shadcn/dialog";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "components/shadcn/popover";
import { Input } from "components/shadcn/input";
import { Portal } from "components/shadcn/portal";
import { cn } from "lib/cn";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NumericInput } from "./common/NumericInput";

interface DateTimePickerProps {
	value?: Date | null;
	onChange: (date: Date | null) => void;
	placeholder?: string;
	disabled?: boolean;
	minDate?: Date;
	quickSelects?: Array<{
		label: string;
		onClick: () => void;
	}>;
}

export const DateTimePicker: FC<DateTimePickerProps> = ({
	value,
	onChange,
	placeholder,
	disabled = false,
	minDate,
	quickSelects = [],
}) => {
	const { t } = useTranslation();
	const inputPlaceholder = placeholder ?? t("dateTimePicker.selectDate");
	const { isOpen, onOpen, onClose } = useDisclosure();
	const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
	const [displayMonth, setDisplayMonth] = useState(() =>
		value ? dayjs(value) : dayjs(),
	);
	const [selectedTime, setSelectedTime] = useState({
		hour: value ? dayjs(value).hour() : 12,
		minute: value ? dayjs(value).minute() : 0,
	});
	const popoverBg = useColorModeValue("bg-white", "bg-gray-900");
	const popoverText = useColorModeValue("text-gray-900", "text-white");
	const popoverBorderColor = useColorModeValue("border-gray-200!", "border-gray-700!");
	const quickSelectBg = useColorModeValue("bg-gray-50", "bg-gray-800");
	const quickSelectBorderColor = useColorModeValue("border-gray-100!", "border-gray-700!");
	const quickSelectHoverBg = useColorModeValue("hover:bg-gray-100", "hover:bg-gray-700");
	const dayNameColor = useColorModeValue("text-gray-500", "text-gray-400");
	const disabledDayColor = useColorModeValue("text-gray-400", "text-gray-500");
	const dayHoverBg = useColorModeValue("hover:bg-gray-100", "hover:bg-gray-700");
	const timeDividerColor = useColorModeValue("border-gray-200!", "border-gray-700!");
	const timeLabelColor = useColorModeValue("text-gray-600", "text-gray-400");
	const todayBorderColor = useColorModeValue("border-primary-500!", "border-primary-400!");

	useEffect(() => {
		if (value) {
			setDisplayMonth(dayjs(value));
			setSelectedTime({
				hour: dayjs(value).hour(),
				minute: dayjs(value).minute(),
			});
		}
	}, [value]);

	// Reset calendar to today when popover closes
	const handleClose = () => {
		if (!value) {
			setDisplayMonth(dayjs());
			setSelectedTime({
				hour: 12,
				minute: 0,
			});
		}
		onClose();
	};

	const daysInMonth = displayMonth.daysInMonth();
	const firstDayOfMonth = displayMonth.startOf("month").day();
	const today = dayjs();
	const selectedDay = value ? dayjs(value) : null;

	const handleDateSelect = (day: number) => {
		const newDate = displayMonth
			.date(day)
			.hour(selectedTime.hour)
			.minute(selectedTime.minute)
			.second(0)
			.millisecond(0);

		if (minDate && newDate.isBefore(dayjs(minDate), "day")) {
			return;
		}

		onChange(newDate.toDate());
	};

	const handleTimeChange = (hour: number, minute: number) => {
		setSelectedTime({ hour, minute });
		if (value) {
			const newDate = dayjs(value).hour(hour).minute(minute);
			onChange(newDate.toDate());
		}
	};

	const handleClear = () => {
		onChange(null);
		setDisplayMonth(dayjs());
		setSelectedTime({
			hour: 12,
			minute: 0,
		});
		onClose();
	};

	const prevMonth = () => setDisplayMonth(displayMonth.subtract(1, "month"));
	const nextMonth = () => setDisplayMonth(displayMonth.add(1, "month"));

	const handleQuickSelect = (days: number) => {
		const baseDate = value ? dayjs(value) : dayjs();
		const newDate = baseDate.add(days, "day");
		onChange(newDate.toDate());
		// Don't close the popover so user can click multiple times
	};

	const builtInQuickSelects = [
		{ label: t("dateTimePicker.addDay"), onClick: () => handleQuickSelect(1) },
		{ label: t("dateTimePicker.addMonth"), onClick: () => handleQuickSelect(30) },
		{ label: t("dateTimePicker.addThreeMonths"), onClick: () => handleQuickSelect(90) },
		{ label: t("dateTimePicker.addSixMonths"), onClick: () => handleQuickSelect(180) },
		{ label: t("dateTimePicker.addYear"), onClick: () => handleQuickSelect(365) },
		{ label: t("dateTimePicker.addThreeYears"), onClick: () => handleQuickSelect(1095) },
	];

	const effectiveQuickSelects =
		quickSelects.length > 0 ? quickSelects : builtInQuickSelects;

	const renderDays = () => {
		const days = [];
		const minDay = minDate ? dayjs(minDate) : null;

		// Empty cells for days before month starts
		for (let i = 0; i < firstDayOfMonth; i++) {
			days.push(<div key={`empty-${i}`} />);
		}

		// Days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			const currentDate = displayMonth.date(day);
			const isToday = currentDate.isSame(today, "day");
			const isSelected = selectedDay?.isSame(currentDate, "day");
			const isPast = minDay && currentDate.isBefore(minDay, "day");

			days.push(
				<div key={day}>
					<Button size="xs" variant="ghost" onClick={() => !isPast && handleDateSelect(day)} isDisabled={!!isPast} className={cn("w-full h-[34px] md:h-[28px] min-w-[34px]! md:min-w-[28px]! text-[0.75rem]", isToday ? "font-bold" : "font-normal", isSelected ? "bg-primary-500" : "bg-transparent", isSelected ? "text-white" : (isPast ? (disabledDayColor) : "text-inherit"), isToday ? "border" : "border" + " " + "border-none", todayBorderColor, isPast ? "hover:bg-transparent" : (isSelected ? "hover:bg-primary-600" : (dayHoverBg)), isPast ? "cursor-not-allowed" : "cursor-pointer")}>
						{day}
					</Button>
				</div>,
			);
		}

		return days;
	};

	const displayValue = value ? dayjs(value).format("YYYY/MM/DD HH:mm") : "";
	const mobileTrigger = (
		<Button type="button" variant="outline" size="sm" isDisabled={disabled} onClick={onOpen} className="w-full h-[32px] justify-start font-normal px-3 bg-transparent dark:bg-transparent">
			<span className={cn("truncate", displayValue ? "text-inherit" : "text-gray-500")}>
				{displayValue || inputPlaceholder}
			</span>
		</Button>
	);

	const pickerContent = (
		<div className="flex-col md:flex-row flex">
			{/* Quick Select Sidebar */}
			<div className={cn("flex gap-1 items-stretch px-2 py-2 min-w-0! md:min-w-[100px]! max-w-[100%] md:max-w-[110px] border-r-0 md:border-r border-b md:border-b-0 shrink-0 flex-row md:flex-col flex-wrap md:flex-nowrap", quickSelectBg, quickSelectBorderColor)}>
				{effectiveQuickSelects.map((option) => (
					<Button key={option.label} variant="ghost" size="sm" onClick={option.onClick} className={cn("justify-center md:justify-start text-[0.75rem] whitespace-nowrap flex-[1_1_calc(33.333%_-_4px)] md:flex-[0_0_auto] min-w-[82px]! md:min-w-[auto]!", quickSelectHoverBg)}>
						{option.label}
					</Button>
				))}
			</div>

			{/* Calendar */}
			<div className="flex-1 p-2 md:p-2 min-w-0!">
				{/* Month Navigation */}
				<div className="flex justify-between items-center mb-2">
					<div className="flex flex-row items-center gap-1">
						<IconButton aria-label={t("dateTimePicker.previousMonth")} size="xs" variant="ghost" icon={<ChevronLeftIcon className="w-14 h-14" />} onClick={prevMonth} className={cn(quickSelectHoverBg)} />
						<IconButton aria-label={t("dateTimePicker.nextMonth")} size="xs" variant="ghost" icon={<ChevronRightIcon className="w-14 h-14" />} onClick={nextMonth} className={cn(quickSelectHoverBg)} />
					</div>
					<p className="text-[0.75rem] font-semibold">
						{displayMonth.format("MMMM YYYY")}
					</p>
				</div>

				{/* Day Names */}
				<div className="grid grid-cols-[repeat(7,_1fr)] gap-0.5 mb-1">
					{Array.from({ length: 7 }, (_, index) =>
						displayMonth.startOf("week").add(index, "day").format("dd"),
					).map((day) => (
						<div key={day}>
							<p className={cn("text-[0.625rem] text-center font-semibold", dayNameColor)}>
								{day}
							</p>
						</div>
					))}
				</div>

				{/* Days Grid */}
				<div className="grid grid-cols-[repeat(7,_1fr)] gap-0.5 mb-2">
					{renderDays()}
				</div>

				{/* Time Picker */}
				<div className={cn("flex flex-row items-center gap-2 justify-center pt-2 border-t", timeDividerColor)}>
					<p className={cn("text-[0.625rem]", timeLabelColor)}>
						{t("dateTimePicker.time")}
					</p>
					<NumericInput size="xs" min={0} max={23} value={selectedTime.hour} onChange={(value) => {
							const h = Math.max(0, Math.min(23, parseInt(value, 10) || 0));
							handleTimeChange(h, selectedTime.minute);
						}} fieldProps={{ className: "text-center text-[0.75rem]" }} className="w-[45px]" />
					<p className="text-[0.75rem]">:</p>
					<NumericInput size="xs" min={0} max={59} value={selectedTime.minute} onChange={(value) => {
							const m = Math.max(0, Math.min(59, parseInt(value, 10) || 0));
							handleTimeChange(selectedTime.hour, m);
						}} fieldProps={{ className: "text-center text-[0.75rem]" }} className="w-[45px]" />
				</div>

				{/* Actions */}
				<div className="flex flex-row items-center gap-2 justify-end mt-2">
					<Button size="xs" variant="ghost" onClick={handleClear}>
						{t("clear")}
					</Button>
					<Button size="xs" colorScheme="primary" onClick={handleClose}>
						{t("dateTimePicker.done")}
					</Button>
				</div>
			</div>
		</div>
	);

	if (isMobile) {
		return (
			<>
				{mobileTrigger}
				<Modal isOpen={isOpen} onClose={handleClose}>
					<ModalOverlay />
					<ModalContent className={cn(popoverBg, popoverText)}>
						<ModalHeader className="text-[0.875rem] py-3 pe-12">
							{inputPlaceholder}
						</ModalHeader>
						<ModalCloseButton />
						<ModalBody className="p-0 overflow-y-auto">
							{pickerContent}
						</ModalBody>
					</ModalContent>
				</Modal>
			</>
		);
	}

	return (
		<Popover isOpen={isOpen} onOpen={onOpen} onClose={handleClose} placement={isMobile ? "bottom" : "bottom-start"} isLazy strategy="fixed" modifiers={[
				{ name: "preventOverflow", options: { padding: 8 } },
				{
					name: "flip",
					options: {
						fallbackPlacements: ["top", "bottom-start", "top-start"],
					},
				},
			]}>
			<PopoverTrigger>
				<Input value={displayValue} placeholder={inputPlaceholder} size="sm" isReadOnly isDisabled={disabled} onClick={onOpen} className="cursor-pointer bg-transparent dark:bg-transparent" />
			</PopoverTrigger>
			<Portal appendToParentPortal={false}>
				<PopoverContent className={cn("w-[calc(100vw_-_16px)] sm:w-[min(420px,_calc(100vw_-_16px))] md:w-auto max-w-[calc(100vw_-_16px)] max-h-[min(82svh,_640px)] md:max-h-[calc(100vh_-_24px)] overflow-hidden z-[17020] focus:shadow-none", popoverBg, popoverBorderColor, popoverText, "date-time-picker-popover")}>
					<PopoverBody className="p-0 max-h-[inherit] overflow-y-auto">
						{pickerContent}
					</PopoverBody>
				</PopoverContent>
			</Portal>
		</Popover>
	);
};
