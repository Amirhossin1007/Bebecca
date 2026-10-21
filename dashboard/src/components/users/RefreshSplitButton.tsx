import { ButtonGroup } from "components/shadcn/button";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ReloadIcon } from "components/Filters";
import { Button } from "components/shadcn/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "components/shadcn/dropdown-menu";
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
 * the right half opens the interval menu. The chevron carries a dot while an
 * interval is active, so the state stays visible now that the text label is gone.
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
		<ButtonGroup isAttached variant="outline" size="sm">
			{/* First screen control from the shadcn kit: no Chakra styling here. */}
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				onClick={onRefresh}
				disabled={isLoading}
				aria-label={labels.refresh}
				title={labels.refresh}
				className="relative rounded-e-none border-e-0"
				style={{ height: 32, width: 32 }}
			>
				<span className={cn("inline-flex", isLoading && "rb-refresh-spin")}>
					<ReloadIcon />
				</span>
			</Button>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						aria-label={`${labels.autoRefresh}: ${intervalLabel}`}
						title={`${labels.autoRefresh}: ${intervalLabel}`}
						className="relative rounded-s-none px-1.5"
						style={{ height: 32, width: 30 }}
					>
						<ChevronDownIcon className="w-[14px]" />
						{active ? (
							<span
								aria-hidden="true"
								className="absolute end-1 top-1 size-1.5 rounded-full bg-panel-accent ring-2 ring-panel-surface"
							/>
						) : null}
					</Button>
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
		</ButtonGroup>
	);
};
