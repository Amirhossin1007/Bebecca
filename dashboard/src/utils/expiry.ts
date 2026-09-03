import dayjs from "dayjs";

export const addQuickExpiry = (
	value: Date | null,
	amount: number,
	unit: "month" | "year",
) => (value ? dayjs(value) : dayjs()).add(amount, unit).endOf("day").toDate();
