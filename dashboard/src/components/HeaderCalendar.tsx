import { Button } from "components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { Badge } from "components/ui/badge";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { withClass } from "lib/withClass";
import { CalendarDays, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, Sparkles as SparklesIcon } from "lucide-react";

import { cn } from "lib/cn";
import { useSeasonal } from "contexts/SeasonalContext";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const CalendarIcon = withClass(CalendarDays, "w-4 h-4");
const Sparkles = withClass(SparklesIcon, "w-4 h-4");
const ChevronLeft = withClass(ChevronLeftIcon, "w-4 h-4");
const ChevronRight = withClass(ChevronRightIcon, "w-4 h-4");

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
			isToday: cursor.toDateString() === baseDate.toDateString(),
			weekday: cursor.getDay(),
		});

		cursor = new Date(cursor);
		cursor.setDate(cursor.getDate() + 1);
	}

	return { monthLabel, days };
};

const buildWeekdayLabels = (locale: string) => {
	const start = new Date(2023, 0, 1); // Sunday
	return Array.from({ length: 7 }).map((_, index) =>
		new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
			new Date(start.getTime() + index * 24 * 60 * 60 * 1000),
		),
	);
};

export const HeaderCalendar: FC = () => {
	const { t, i18n } = useTranslation();
	const [today, setToday] = useState(() => new Date());
	const [displayDate, setDisplayDate] = useState(() => new Date());
	const { isChristmas, window: seasonWindow } = useSeasonal();
	const isPersian = i18n.language?.startsWith("fa");
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const displayLocale = isPersian
		? "fa-IR-u-ca-persian"
		: `${i18n.language || "en"}-u-ca-gregory`;
	const numberLocale = isPersian ? "fa-IR" : i18n.language || "en";
	const badgeBg = "bg-blackAlpha-50 dark:bg-whiteAlpha-100";
	const highlight = "border-primary-600! dark:border-primary-200!";
	const border = "border-blackAlpha-200! dark:border-whiteAlpha-200!";

	useEffect(() => {
		const timer = setInterval(() => setToday(new Date()), 60 * 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		setDisplayDate(new Date());
	}, []);

	const formattedDate = useMemo(
		() => {
			const formatter = new Intl.DateTimeFormat(displayLocale, {
				weekday: "long",
				day: "numeric",
				month: "long",
				year: "numeric",
			});
			if (isPersian) {
				const parts = formatter.formatToParts(today);
				const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
				return `${getPart("weekday")}، ${getPart("day")} ${getPart("month")} ${getPart("year")}`;
			}
			return formatter.format(today);
		},
		[displayLocale, today, isPersian],
	);

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
	const prevIcon = isRTL ? <ChevronRight /> : <ChevronLeft />;
	const nextIcon = isRTL ? <ChevronLeft /> : <ChevronRight />;

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
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" className="hidden md:inline-flex px-3">{<CalendarIcon />}
					<p className="truncate max-w-[320px] font-semibold text-[0.875rem]">
						{formattedDate}
					</p>
				</Button>
			</PopoverTrigger>
			<PopoverContent className={cn("w-fit min-w-[260px]! shadow-lg", border)}>
				
				<div className="p-3">
					<div className="flex flex-col gap-3">
						<div dir={isRTL ? "rtl" : "ltr"} className="flex flex-row gap-2 justify-between items-center">
							<div className="flex flex-row items-center gap-2">
								<Button aria-label={t("dateTimePicker.previousMonth")} onClick={() => {
										const next = new Date(displayDate);
										next.setMonth(displayDate.getMonth() - 1);
										setDisplayDate(next);
									}} variant="ghost" size="xs" className="size-7 p-0">{prevIcon}</Button>
								<p className="font-semibold">{monthLabel}</p>
								{isChristmas && (
									<Badge className={cn("bg-destructive/10 text-destructive", "inline-flex items-center gap-1")}>
										<Sparkles />
										{t("season.christmas")}
									</Badge>
								)}
								<Button aria-label={t("dateTimePicker.nextMonth")} onClick={() => {
										const next = new Date(displayDate);
										next.setMonth(displayDate.getMonth() + 1);
										setDisplayDate(next);
									}} variant="ghost" size="xs" className="size-7 p-0">{nextIcon}</Button>
							</div>
						</div>
						<div className="grid grid-cols-7 gap-1">
							{weekdayLabels.map((label) => (
								<p key={label} className="text-center text-[0.75rem] text-gray-500 dark:text-gray-400 font-semibold">
									{label}
								</p>
							))}
							{emptySlotKeys.map((key) => (
								<div key={key} />
							))}
							{days.map((day) => {
								const isHoliday = weekendDays.includes(day.weekday);
								return (
									<div key={day.date.toISOString()} className={cn("text-center px-2 py-2 rounded-md", day.isToday ? "border" : "border-0", day.isToday ? (highlight) : "border-transparent!", day.isToday ? (badgeBg) : "bg-transparent", day.isToday || isHoliday ? "font-semibold" : "font-normal", isHoliday ? "text-red-500" : "")}>
										<p>{day.label}</p>
									</div>
								);
							})}
						</div>
						{isChristmas && christmasRange && (
							<p className="text-[0.75rem] text-gray-500 text-center">
								{t("season.window")} ({christmasRange})
							</p>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
};
