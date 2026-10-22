import { ChevronDown, RefreshCw } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "components/shadcn/dropdown-menu";
import { buttonVariants } from "components/ui/button";
import { cn } from "lib/cn";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

type RefreshSplitButtonProps = {
	onRefresh: () => void;
	loading?: boolean;
	/** Current auto-refresh interval in ms; `0` means off. */
	interval: number;
	onIntervalChange: (interval: number) => void;
	intervals: readonly number[];
	labels: {
		refresh: string;
		autoRefresh: string;
		off: string;
		every: (seconds: number) => string;
	};
};

const spinKeyframes = `
@keyframes rb-refresh-spin { to { transform: rotate(360deg); } }
.rb-refresh-spin { animation: rb-refresh-spin 0.9s linear infinite; }
@media (prefers-reduced-motion: reduce) { .rb-refresh-spin { animation: none; } }
`;

let keyframesInjected = false;
const ensureKeyframes = () => {
	if (keyframesInjected || typeof document === "undefined") return;
	keyframesInjected = true;
	const style = document.createElement("style");
	style.textContent = spinKeyframes;
	document.head.appendChild(style);
};

/**
 * One split control for refresh + auto-refresh: the left half refreshes now,
 * the right half opens the interval menu. Both halves are stock 36px ghost buttons
 * in one pill, so the group lines up with the other header controls. The chevron
 * carries a dot while an interval is active.
 */
export const RefreshSplitButton: FC<RefreshSplitButtonProps> = ({
	onRefresh,
	loading: isLoading,
	interval,
	onIntervalChange,
	intervals,
	labels,
}) => {
	const { i18n } = useTranslation();
	ensureKeyframes();

	const active = interval > 0;
	const intervalLabel = active ? labels.every(interval / 1000) : labels.off;

	return (
		<div className="inline-flex h-9 items-stretch overflow-hidden rounded-full bg-panel-elevated shadow-xs ring-1 ring-inset ring-panel-border">
			<button
				type="button"
				onClick={onRefresh}
				disabled={isLoading}
				aria-label={labels.refresh}
				title={labels.refresh}
				className={cn(
					buttonVariants({ variant: "ghost", size: "icon" }),
					"rounded-none text-panel-text-secondary hover:bg-whiteAlpha-100 hover:text-panel-text",
				)}
			>
				<span className={cn("inline-flex", isLoading && "rb-refresh-spin")}>
					<RefreshCw className="size-4" />
				</span>
			</button>
			<span aria-hidden="true" className="my-2 w-px bg-panel-border" />

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={`${labels.autoRefresh}: ${intervalLabel}`}
						title={`${labels.autoRefresh}: ${intervalLabel}`}
						className={cn(
							buttonVariants({ variant: "ghost", size: "icon" }),
							"relative rounded-none text-panel-text-secondary hover:bg-whiteAlpha-100 hover:text-panel-text",
						)}
					>
						<ChevronDown className="size-4" />
						{active ? (
							<span
								aria-hidden="true"
								className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-panel-accent ring-2 ring-panel-elevated"
							/>
						) : null}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className={cn(i18n.dir() === "rtl" ? "items-start" : "items-end", "min-w-52")}>
					<DropdownMenuLabel>{labels.autoRefresh}</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => onIntervalChange(0)} className={cn(!active && "font-semibold")}>
						{labels.off}
					</DropdownMenuItem>
					{intervals.map((value) => (
						<DropdownMenuItem
							key={value}
							onSelect={() => onIntervalChange(value)}
							className={cn(interval === value && "font-semibold text-panel-text")}
						>
							{labels.every(value / 1000)}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
