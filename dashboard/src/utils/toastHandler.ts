import type { CreateToastFnReturn } from "@chakra-ui/react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

type ErrorRecord = Record<string, unknown>;

const asRecord = (value: unknown): ErrorRecord | undefined =>
	value && typeof value === "object" ? (value as ErrorRecord) : undefined;

const firstErrorText = (...values: unknown[]): string | undefined => {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
		const record = asRecord(value);
		if (!record) continue;
		for (const key of [
			"message",
			"error",
			"detail",
			"title",
			"statusMessage",
			"statusText",
		]) {
			const text = record[key];
			if (typeof text === "string" && text.trim()) {
				return text.trim();
			}
		}
	}
	return undefined;
};

const getErrorMessage = (error: unknown): string | undefined => {
	const errorRecord = asRecord(error);
	const response = asRecord(errorRecord?.response);
	const body = response?._data ?? response?.data;
	return firstErrorText(error, body, response);
};

export const generateErrorMessage = (
	e: unknown,
	toast: CreateToastFnReturn,
	form?: UseFormReturn<FieldValues | any>,
) => {
	const errorRecord = asRecord(e);
	const response = asRecord(errorRecord?.response);
	const detail = asRecord(response?._data ?? response?.data)?.detail;
	if (detail && typeof detail === "object" && form) {
		const validationDetail = detail as Record<string, string>;
		if (Object.keys(validationDetail).length > 0) {
			Object.keys(validationDetail).forEach((errorKey) => {
				form.setError(errorKey, {
					message: validationDetail[errorKey],
				});
			});
			return;
		}
	}
	const validationMessage =
		detail && typeof detail === "object"
			? Object.entries(detail as Record<string, unknown>)
					.map(([key, value]) =>
						typeof value === "string" ? `${key}: ${value}` : "",
					)
					.filter(Boolean)
					.join(", ")
			: undefined;
	const message = validationMessage || getErrorMessage(e);
	const status = response?.status;
	return toast({
		title:
			message ??
			(typeof status === "number"
				? `Request failed (HTTP ${status})`
				: "Request failed"),
		status: "error",
		isClosable: true,
		position: "top",
		duration: 3000,
	});
};

export const generateSuccessMessage = (
	message: string,
	toast: CreateToastFnReturn,
) => {
	return toast({
		title: message,
		status: "success",
		isClosable: true,
		position: "top",
		duration: 3000,
	});
};
