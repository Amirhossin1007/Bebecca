import { useColorModeValue } from "lib/color-mode";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";
import type { FC, ReactNode } from "react";

export type ChartBoxProps = Omit<ComponentPropsWithoutRef<"div">, "title"> & {
	title?: ReactNode;
	children: ReactNode;
	headerActions?: ReactNode;
};

export const ChartBox: FC<ChartBoxProps> = ({
	title,
	children,
	headerActions,
	...props
}) => {
	const borderColor = useColorModeValue("border-panel-border! border-b-panel-border!", "border-panel-border! border-b-panel-border!");
	const bg = useColorModeValue("bg-panel-surface", "bg-panel-surface");
	const headerBg = useColorModeValue("bg-transparent", "bg-transparent");

	return (
		<div {...props} className={cn(borderColor, cn("hover:md:shadow-sm hover:md:border-panel-border-strong!", cn("border rounded-xl overflow-hidden [transition:box-shadow_0.2s_ease,_border-color_0.2s_ease]", bg)))}>
			{(title || headerActions) && (
				<div className={cn(borderColor, cn("flex px-4 md:px-5 py-4 border-b justify-between items-stretch md:items-center gap-3 flex-wrap", headerBg))}>
					{title && (
						<p className="font-bold text-[1rem] md:text-[1.125rem] text-panel-text flex-1 min-w-full! md:min-w-[220px]!">
							{title}
						</p>
					)}
					{headerActions && <div className="max-w-full">{headerActions}</div>}
				</div>
			)}
			<div className="p-4 md:p-5">{children}</div>
		</div>
	);
};
