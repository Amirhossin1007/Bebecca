import { Button } from "components/shadcn/button";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";
import type { FC, PropsWithChildren, ReactNode } from "react";
import { useTranslation } from "react-i18next";

type BulkActionBarProps = PropsWithChildren<
	ComponentPropsWithoutRef<"div"> & {
		selectedCount: number;
		onClear?: () => void;
		selectedLabel?: ReactNode;
	}
>;

export const BulkActionBar: FC<BulkActionBarProps> = ({
	selectedCount,
	onClear,
	selectedLabel,
	children,
	...props
}) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const isVisible = selectedCount > 0;

	return (
		<div data-visible={isVisible ? "true" : undefined} aria-hidden={!isVisible} {...props} className={cn(isRTL ? "end-[12px] md:end-[calc(var(--rb-sidebar-offset,_0px)_+_16px)] start-4" : "start-[12px] md:start-[calc(var(--rb-sidebar-offset,_0px)_+_16px)] end-4", "fixed bottom-[84px] md:bottom-[16px] z-[1200] bg-panel-surface border border-panel-border-strong! shadow-[0_-12px_30px_rgba(0,_0,_0,_0.28)] rounded-[6px] px-4 md:px-6 py-4 [transition:opacity_140ms_ease,_transform_140ms_ease,_border-color_140ms_ease,_background-color_140ms_ease]", isVisible ? "opacity-100" : "opacity-0", isVisible ? "[transform:translateY(0)]" : "[transform:translateY(10px)]", isVisible ? "pointer-events-auto" : "pointer-events-none", "rb-bulk-action-bar")}>
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div className="flex flex-row items-center gap-4">
					<p className="font-extrabold tracking-[0] uppercase">
						{selectedLabel ??
								t("usersTable.selectedCount", {
									count: selectedCount,
								})}
					</p>
					{onClear && (
						<Button size="xs" variant="link" onClick={onClear} className="text-panel-text-muted">
							{t("clear")}
						</Button>
					)}
				</div>
				<div className="flex flex-row items-center gap-2 md:gap-4 flex-wrap justify-end">
					{children}
				</div>
			</div>
		</div>
	);
};
