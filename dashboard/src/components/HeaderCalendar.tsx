import {
	Badge,
	Box,
	Button,
	chakra,
	Flex,
	HStack,
	IconButton,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverTrigger,
	SimpleGrid,
	Stack,
	Text,
} from "@chakra-ui/react";
import {
	CalendarDaysIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline";
import { useSeasonal } from "contexts/SeasonalContext";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const CalendarIcon = chakra(CalendarDaysIcon, { baseStyle: { w: 4, h: 4 } });
const Sparkles = chakra(SparklesIcon, { baseStyle: { w: 3.5, h: 3.5 } });
const ChevronLeft = chakra(ChevronLeftIcon, { baseStyle: { w: 4, h: 4 } });
const ChevronRight = chakra(ChevronRightIcon, { baseStyle: { w: 4, h: 4 } });

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
	const start = new Date(2023, 0, 1);
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
			const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
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
		<Popover placement="bottom-start" gutter={8}>
			<PopoverTrigger>
				<Button
					size="sm"
					variant="outline"
					h="34px"
					px={3}
					borderRadius="12px"
					borderColor="panel.border"
					bg="panel.surface"
					color="panel.text"
					boxShadow="sm"
					display={{ base: "none", md: "inline-flex" }}
					alignItems="center"
					gap={2}
					_hover={{
						bg: "panel.elevated",
						borderColor: "panel.borderStrong",
					}}
					transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
				>
					<CalendarIcon color="panel.textSecondary" />
					<Text noOfLines={1} maxW="320px" fontWeight="600" fontSize="12px">
						{formattedDate}
					</Text>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				w="fit-content"
				minW="290px"
				p={3.5}
				borderRadius="20px"
				borderWidth="1px"
				borderColor="panel.border"
				bg="panel.surface"
				backdropFilter="blur(24px)"
				boxShadow="0 20px 48px rgba(0, 0, 0, 0.35)"
				_focus={{ outline: "none" }}
			>
				<PopoverBody p={0}>
					<Stack spacing={3}>
						<Flex
							justify="space-between"
							align="center"
							dir={isRTL ? "rtl" : "ltr"}
							px={1}
						>
							<IconButton
								size="xs"
								variant="ghost"
								borderRadius="full"
								aria-label={t("dateTimePicker.previousMonth")}
								icon={prevIcon}
								onClick={() => {
									const next = new Date(displayDate);
									next.setMonth(displayDate.getMonth() - 1);
									setDisplayDate(next);
								}}
								_hover={{ bg: "panel.elevated" }}
							/>
							<HStack spacing={2} align="center">
								<Text fontWeight="700" fontSize="13px" color="panel.text">
									{monthLabel}
								</Text>
								{isChristmas && (
									<Badge
										colorScheme="red"
										display="inline-flex"
										alignItems="center"
										gap={1}
										borderRadius="full"
										px={2}
										py={0.5}
										fontSize="10px"
									>
										<Sparkles />
										{t("season.christmas")}
									</Badge>
								)}
							</HStack>
							<IconButton
								size="xs"
								variant="ghost"
								borderRadius="full"
								aria-label={t("dateTimePicker.nextMonth")}
								icon={nextIcon}
								onClick={() => {
									const next = new Date(displayDate);
									next.setMonth(displayDate.getMonth() + 1);
									setDisplayDate(next);
								}}
								_hover={{ bg: "panel.elevated" }}
							/>
						</Flex>

						<SimpleGrid columns={7} spacing={1} px={1}>
							{weekdayLabels.map((label) => (
								<Text
									key={label}
									textAlign="center"
									fontSize="11px"
									color="panel.textMuted"
									fontWeight="600"
									py={0.5}
								>
									{label}
								</Text>
							))}
						</SimpleGrid>

						<SimpleGrid columns={7} spacing={1} px={1}>
							{emptySlotKeys.map((key) => (
								<Box key={key} w="34px" h="34px" />
							))}
							{days.map((day) => {
								const isHoliday = weekendDays.includes(day.weekday);
								return (
									<Flex
										key={day.date.toISOString()}
										w="34px"
										h="34px"
										align="center"
										justify="center"
										borderRadius="10px"
										bg={day.isToday ? "panel.elevated" : "transparent"}
										borderWidth={day.isToday ? "1.5px" : "0px"}
										borderColor={day.isToday ? "panel.borderStrong" : "transparent"}
										color={
											isHoliday
												? "red.400"
												: "panel.text"
										}
										fontWeight={day.isToday ? "700" : isHoliday ? "600" : "500"}
										fontSize="12px"
										transition="all 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
										cursor="default"
										_hover={
											day.isToday
												? undefined
												: {
														bg: "panel.elevated",
														color: isHoliday ? "red.400" : "panel.text",
													}
										}
									>
										<Text>{day.label}</Text>
									</Flex>
								);
							})}
						</SimpleGrid>

						{isChristmas && christmasRange && (
							<Text fontSize="10px" color="panel.textMuted" textAlign="center" pt={1}>
								{t("season.window")} ({christmasRange})
							</Text>
						)}
					</Stack>
				</PopoverBody>
			</PopoverContent>
		</Popover>
	);
};
