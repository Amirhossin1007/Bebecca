import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
	convertDaysToSecondsFromNow,
	createId,
	deriveDaysFromSeconds,
	parseDecimalInput,
} from "./userDialog.helpers";
import type { AutoRenewRule, FormType, RuleDraft } from "./userDialog.types";

type UseUserDialogAutoRenewOptions = {
	initialValues: FormType;
	form: UseFormReturn<FormType>;
	setAutoRenewOpen: (open: boolean) => void;
	setError: (error: string | null) => void;
	scrollBodyToEnd: () => void;
};

export const useUserDialogAutoRenew = ({
	initialValues,
	form,
	setAutoRenewOpen,
	setError,
	scrollBodyToEnd,
}: UseUserDialogAutoRenewOptions) => {
	const { t } = useTranslation();
	const [autoRenewRules, setAutoRenewRules] = useState<AutoRenewRule[]>(() =>
		initialValues.next_plan_enabled
			? [
					{
						id: createId(),
						dataLimit: initialValues.next_plan_data_limit,
						expire: initialValues.next_plan_expire,
						addRemaining: initialValues.next_plan_add_remaining_traffic,
						fireOnEither: initialValues.next_plan_fire_on_either,
					},
				]
			: [],
	);
	const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);

	useEffect(() => {
		const firstRule = autoRenewRules[0];
		form.setValue("next_plan_enabled", Boolean(firstRule), {
			shouldDirty: false,
		});
		form.setValue("next_plan_data_limit", firstRule?.dataLimit ?? null, {
			shouldDirty: false,
		});
		form.setValue("next_plan_expire", firstRule?.expire ?? null, {
			shouldDirty: false,
		});
		form.setValue(
			"next_plan_add_remaining_traffic",
			firstRule?.addRemaining ?? false,
			{ shouldDirty: false },
		);
		form.setValue(
			"next_plan_fire_on_either",
			firstRule?.fireOnEither ?? true,
			{ shouldDirty: false },
		);
	}, [autoRenewRules, form]);

	const syncFromFormValues = (next: FormType) => {
		setAutoRenewRules(
			next.next_plan_enabled
				? [
						{
							id: createId(),
							dataLimit: next.next_plan_data_limit,
							expire: next.next_plan_expire,
							addRemaining: next.next_plan_add_remaining_traffic,
							fireOnEither: next.next_plan_fire_on_either,
						},
					]
				: [],
		);
		setRuleDraft(null);
	};

	const startRuleDraft = (index: number | null) => {
		const rule = index === null ? null : (autoRenewRules[index] ?? null);
		setAutoRenewOpen(true);
		scrollBodyToEnd();
		setRuleDraft({
			index,
			data: rule?.dataLimit != null ? String(rule.dataLimit) : "",
			days: rule ? String(deriveDaysFromSeconds(rule.expire) ?? "") : "",
			addRemaining: rule?.addRemaining ?? false,
			fireOnEither: rule?.fireOnEither ?? true,
		});
	};

	const saveRuleDraft = () => {
		if (!ruleDraft) return;
		setError(null);
		const parsedLimit =
			ruleDraft.data.trim() === ""
				? null
				: parseDecimalInput(ruleDraft.data.trim());
		if (
			parsedLimit !== null &&
			(!Number.isFinite(parsedLimit) ||
				Number.isNaN(parsedLimit) ||
				parsedLimit < 0)
		) {
			setError(t("userDialog.autoRenewInvalidLimit"));
			return;
		}
		const parsedDays =
			ruleDraft.days.trim() === ""
				? null
				: Number.parseFloat(ruleDraft.days.trim());
		if (
			parsedDays !== null &&
			(!Number.isFinite(parsedDays) ||
				Number.isNaN(parsedDays) ||
				parsedDays < 0)
		) {
			setError(t("userDialog.autoRenewInvalidDays"));
			return;
		}
		const rule: AutoRenewRule = {
			id:
				(ruleDraft.index !== null
					? autoRenewRules[ruleDraft.index]?.id
					: null) ?? createId(),
			dataLimit: parsedLimit,
			expire:
				parsedDays !== null
					? convertDaysToSecondsFromNow(Math.round(parsedDays))
					: null,
			addRemaining: ruleDraft.addRemaining,
			fireOnEither: ruleDraft.fireOnEither,
		};
		setAutoRenewRules((previous) => {
			const next = [...previous];
			if (ruleDraft.index !== null) next[ruleDraft.index] = rule;
			else next.push(rule);
			return next;
		});
		setRuleDraft(null);
	};

	const deleteRule = (index: number) => {
		setAutoRenewRules((previous) => previous.filter((_, i) => i !== index));
		if (ruleDraft?.index === index) setRuleDraft(null);
	};

	return {
		autoRenewRules,
		ruleDraft,
		setRuleDraft,
		startRuleDraft,
		saveRuleDraft,
		deleteRule,
		syncFromFormValues,
	};
};
