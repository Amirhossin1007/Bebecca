import { Badge } from "components/ui/badge";
import { Button } from "components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { useSeasonal } from "contexts/SeasonalContext";
import { cn } from "lib/cn";
import {
	CalendarDays,
	ChevronLeft as ChevronLeftIcon,
	ChevronRight as ChevronRightIcon,
	Sparkles as SparklesIcon,
} from "lucide-react";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const createStableKey = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2);
};

type CalendarDay = {
	date: Date;
	label: string;
	isToday: boolean;
	weekday: number;
};

const buildMonthDays = (
	baseDate: Date,
	displayLocale: string,
	numberLocale: string,
	usePersianCalendar: boolean,
) => {
	const numericLocale = usePersianCalendar
		? "en-u-ca-persian"
		: "en-u-ca-gregory";
	const monthFormatter = new Intl.DateTimeFormat(numericLocale, {
		month: "numeric",
	});
	const dayFormatter = new Intl.DateTimeFormat(numericLocale, {
		day: "numeric",
	});
	const monthId = monthFormatter.format(baseDate);
	const monthLabel = new Intl.DateTimeFormat(displayLocale, {
		month: "long",
		year: "numeric",
	}).format(baseDate);
	const currentDayNumber = Number(dayFormatter.format(baseDate));
	const firstDay = new Date(baseDate);
	firstDay.setDate(firstDay.getDate() - (currentDayNumber - 1));
	const numberFormatter = new Intl.NumberFormat(numberLocale);

	const days: CalendarDay[] = [];
	let cursor = firstDay;
	while (monthFormatter.format(cursor) === monthId) {
		const label = numberFormatter.format(Number(dayFormatter.format(cursor)));
		days.push({
			date: new Date(cursor),
			label,
			isToday: cursor.toDateString() === new Date().toDateString(),
			weekday: cursor.getDay(),
		});

		cursor = new Date(cursor);
		cursor.setDate(cursor.getDate() + 1);
	}

	return { monthLabel, days };
};

const buildWeekdayLabels = (locale: string) => {
	const start = new Date(2023, 0, 1);
	return Array.from({ length: 7 }).map((_, index) =>
		new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
			new Date(start.getTime() + index * 24 * 60 * 60 * 1000),
		),
	);
};

export interface HeaderCalendarProps {
	isCompact?: boolean;
	inMenu?: boolean;
	isOpen?: boolean;
	isPressing?: boolean;
	onToggle?: () => void;
	onClose?: () => void;
}

export const HeaderCalendar: FC<HeaderCalendarProps> = ({
	isCompact = false,
	inMenu = false,
	isOpen: controlledIsOpen,
	isPressing = false,
	onToggle: controlledOnToggle,
	onClose: controlledOnClose,
}) => {
	const { t, i18n } = useTranslation();
	const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
	const isOpen = controlledIsOpen ?? uncontrolledIsOpen;

	const onOpenChange = (open: boolean) => {
		if (controlledOnToggle) {
			controlledOnToggle();
		} else {
			setUncontrolledIsOpen(open);
		}
		if (!open && controlledOnClose) {
			controlledOnClose();
		}
	};

	const [today, setToday] = useState(() => new Date());
	const [displayDate, setDisplayDate] = useState(() => new Date());
	const { isChristmas, window: seasonWindow } = useSeasonal();
	const isPersian = i18n.language?.startsWith("fa");
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const displayLocale = isPersian
		? "fa-IR-u-ca-persian"
		: `${i18n.language || "en"}-u-ca-gregory`;
	const numberLocale = isPersian ? "fa-IR" : i18n.language || "en";

	useEffect(() => {
		const timer = setInterval(() => setToday(new Date()), 60 * 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		setDisplayDate(new Date());
	}, []);

	const formattedDate = useMemo(() => {
		const formatter = new Intl.DateTimeFormat(displayLocale, {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		});
		if (isPersian) {
			const parts = formatter.formatToParts(today);
			const getPart = (type: string) =>
				parts.find((p) => p.type === type)?.value || "";
			return `${getPart("weekday")}، ${getPart("day")} ${getPart("month")} ${getPart("year")}`;
		}
		return formatter.format(today);
	}, [displayLocale, today, isPersian]);

	const { monthLabel, days } = useMemo(
		() =>
			buildMonthDays(
				displayDate,
				displayLocale,
				numberLocale,
				Boolean(isPersian),
			),
		[displayDate, displayLocale, isPersian, numberLocale],
	);

	const weekdayLabels = useMemo(
		() => buildWeekdayLabels(displayLocale),
		[displayLocale],
	);

	const emptySlots = days.length ? days[0].weekday : 0;
	const emptySlotKeys = useMemo(
		() => Array.from({ length: emptySlots }, () => createStableKey()),
		[emptySlots],
	);

	const weekendDays = isPersian ? [5] : [0];
	const prevIcon = isRTL ? (
		<ChevronRightIcon className="size-4" />
	) : (
		<ChevronLeftIcon className="size-4" />
	);
	const nextIcon = isRTL ? (
		<ChevronLeftIcon className="size-4" />
	) : (
		<ChevronRightIcon className="size-4" />
	);

	const christmasRange = useMemo(() => {
		if (!seasonWindow) return null;
		const locale = i18n.language || "en";
		const formatter = new Intl.DateTimeFormat(locale, {
			month: "short",
			day: "numeric",
		});
		return `${formatter.format(seasonWindow.start)} - ${formatter.format(seasonWindow.end)}`;
	}, [i18n.language, seasonWindow]);

	return (
		<Popover open={isOpen} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				{inMenu ? (
					<Button
						variant="ghost"
						className={cn(
							"w-full h-10 justify-start gap-3 px-3 rounded-[12px] text-panel-text text-[13px] font-medium transition-all duration-120",
							isPressing || isOpen ? "bg-panel-elevated scale-[0.96]" : "bg-transparent",
							"md:hover:bg-panel-elevated active:bg-panel-elevated active:scale-[0.96]",
						)}
					>
						<CalendarDays className="size-4 shrink-0" />
						<span className="truncate">{formattedDate}</span>
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						className={cn(
							"hidden md:inline-flex rounded-[12px] border border-panel-border! bg-panel-surface text-panel-text shadow-xs md:hover:bg-panel-elevated md:hover:border-panel-border-strong! transition-colors h-[34px]",
							isCompact ? "w-[34px] p-0 justify-center" : "px-3 max-w-[320px] gap-2",
						)}
					>
						<CalendarDays className="size-4 shrink-0" />
						{!isCompact && (
							<span className="truncate font-semibold text-xs">
								{formattedDate}
							</span>
						)}
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent
				align={isRTL ? "start" : "end"}
				className="w-fit min-w-[280px]! p-3 rounded-[14px] border border-panel-border! bg-panel-surface text-panel-text shadow-xl z-50"
			>
				<div className="flex flex-col gap-3">
					<div
						dir={isRTL ? "rtl" : "ltr"}
						className="flex flex-row gap-2 justify-between items-center"
					>
						<div className="flex flex-row items-center gap-2">
							<Button
								type="button"
								aria-label={t("dateTimePicker.previousMonth")}
								onClick={() => {
									const next = new Date(displayDate);
									next.setMonth(displayDate.getMonth() - 1);
									setDisplayDate(next);
								}}
								variant="ghost"
								size="icon"
								className="size-7 p-0 rounded-md"
							>
								{prevIcon}
							</Button>
							<span className="font-semibold text-sm">{monthLabel}</span>
							{isChristmas && (
								<Badge className="bg-destructive/10 text-destructive inline-flex items-center gap-1 text-[10px]">
									<SparklesIcon className="size-3" />
									{t("season.christmas")}
								</Badge>
							)}
							<Button
								type="button"
								aria-label={t("dateTimePicker.nextMonth")}
								onClick={() => {
									const next = new Date(displayDate);
									next.setMonth(displayDate.getMonth() + 1);
									setDisplayDate(next);
								}}
								variant="ghost"
								size="icon"
								className="size-7 p-0 rounded-md"
							>
								{nextIcon}
							</Button>
						</div>
					</div>
					<div className="grid grid-cols-7 gap-1">
						{weekdayLabels.map((label) => (
							<span
								key={label}
								className="text-center text-xs text-panel-text-muted font-semibold"
							>
								{label}
							</span>
						))}
						{emptySlotKeys.map((key) => (
							<div key={key} />
						))}
						{days.map((day) => {
							const isHoliday = weekendDays.includes(day.weekday);
							return (
								<div
									key={day.date.toISOString()}
									className={cn(
										"text-center px-1.5 py-1.5 rounded-md text-xs",
										day.isToday
											? "border border-panel-accent! bg-panel-elevated font-semibold text-panel-accent"
											: "border-transparent bg-transparent",
										isHoliday ? "text-red-400" : "text-panel-text",
									)}
								>
									<span>{day.label}</span>
								</div>
							);
						})}
					</div>
					{isChristmas && christmasRange && (
						<span className="text-xs text-panel-text-muted text-center">
							{t("season.window")} ({christmasRange})
						</span>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
};
