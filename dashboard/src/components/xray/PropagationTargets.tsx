import { Spinner } from "components/shadcn/feedback";
import { Checkbox } from "components/shadcn/selection";
import { Tooltip } from "components/shadcn/tooltip";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	type PropagationSection,
	type PropagationTarget,
	previewXrayPropagation,
	propagationKey,
} from "service/xrayPropagation";

export interface PropagationTargetsProps {
	source: string;
	section: PropagationSection;
	before: unknown | null;
	after: unknown | null;
	selectedIds: string[];
	onChange: (ids: string[]) => void;
}

const statusMessageKeys = {
	missing: "pages.xray.propagate.missing",
	different: "pages.xray.propagate.different",
	conflict: "pages.xray.propagate.conflict",
} as const;

export const PropagationTargets: FC<PropagationTargetsProps> = ({
	source,
	section,
	before,
	after,
	selectedIds,
	onChange,
}) => {
	const { t } = useTranslation();
	const [targets, setTargets] = useState<PropagationTarget[] | null>(null);
	const requestKey = propagationKey({ source, section, before, after });

	useEffect(() => {
		const request = JSON.parse(requestKey);
		let active = true;
		setTargets(null);
		previewXrayPropagation(request)
			.then((result) => {
				if (active) setTargets(result);
			})
			.catch(() => {
				if (active) setTargets([]);
			});
		return () => {
			active = false;
		};
	}, [requestKey]);

	const enabledIds = useMemo(
		() =>
			(targets ?? [])
				.filter((target) => target.status === "ok")
				.map((target) => target.id),
		[targets],
	);

	useEffect(() => {
		if (!targets) return;
		const valid = selectedIds.filter((id) => enabledIds.includes(id));
		if (valid.length !== selectedIds.length) onChange(valid);
	}, [targets, enabledIds, selectedIds, onChange]);

	if (targets === null) {
		return <Spinner size="sm" />;
	}
	if (!targets.length) {
		return (
			<p className="text-[0.875rem] text-panel-text-muted">
				{t("pages.xray.propagate.noCustomNodes")}
			</p>
		);
	}

	const allSelected =
		enabledIds.length > 0 && enabledIds.every((id) => selectedIds.includes(id));
	const someSelected = selectedIds.length > 0 && !allSelected;

	const toggle = (id: string, checked: boolean) =>
		onChange(
			checked
				? [...selectedIds, id]
				: selectedIds.filter((selectedId) => selectedId !== id),
		);

	return (
		<div className="flex flex-col gap-3">
			<p className="text-[0.875rem] text-panel-text-muted">
				{t("pages.xray.propagate.hint")}
			</p>
			<Checkbox disabled={!enabledIds.length} checked={allSelected} isIndeterminate={someSelected} onChange={() => onChange(allSelected ? [] : enabledIds)}>
				{t("pages.xray.propagate.selectAll")}
			</Checkbox>
			<div className="flex flex-col gap-2">
				{targets.map((target) => {
					const disabled = target.status !== "ok";
					return (
						<div key={target.id} className="flex flex-row items-center gap-2 justify-between">
							<Checkbox disabled={disabled} checked={selectedIds.includes(target.id)} onChange={(event) => toggle(target.id, event.target.checked)}>
								{target.name || target.id}
							</Checkbox>
							{disabled && (
								<Tooltip label={t(
										statusMessageKeys[
											target.status as keyof typeof statusMessageKeys
										],
									)}>
									<span className="text-panel-text-muted cursor-help">
										<QuestionMarkCircleIcon className="w-[16px] h-[16px]" />
									</span>
								</Tooltip>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};
