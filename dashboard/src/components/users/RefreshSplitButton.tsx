import { buttonVariants } from "components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "components/ui/dropdown-menu";
import { cn } from "lib/cn";
import { ChevronDown, LoaderCircle, RefreshCw } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

type RefreshSplitButtonProps = {
	onRefresh: () => void;
	loading?: boolean;
	interval: number;
	onIntervalChange: (interval: number) => void;
	className?: string;
};

export const AUTO_REFRESH_INTERVALS = [3_000, 5_000, 10_000, 30_000] as const;

export const RefreshSplitButton: FC<RefreshSplitButtonProps> = ({
	onRefresh,
	loading: isLoading,
	interval,
	onIntervalChange,
	className,
}) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir() === "rtl";
	const active = interval > 0;
	const intervalLabel = active
		? t("usersTable.autoRefreshEvery", { seconds: interval / 1000 })
		: t("usersTable.autoRefreshOff");

	return (
		<div
			className={cn(
				"inline-flex h-9 items-stretch overflow-hidden rounded-xl border border-panel-border bg-panel-surface shadow-xs",
				className,
			)}
		>
			<button
				type="button"
				onClick={onRefresh}
				disabled={isLoading}
				aria-label={t("refresh")}
				title={t("refresh")}
				className={cn(
					buttonVariants({ variant: "ghost", size: "icon" }),
					"size-9 rounded-none text-panel-text-secondary transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text active:scale-[0.98] touch-manipulation",
				)}
			>
				{isLoading ? (
					<LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
				) : (
					<RefreshCw className="size-3.5" />
				)}
			</button>
			<span aria-hidden="true" className="my-2 w-px bg-panel-border" />

			<DropdownMenu dir={isRTL ? "rtl" : "ltr"}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={`${t("usersTable.autoRefresh")}: ${intervalLabel}`}
						title={`${t("usersTable.autoRefresh")}: ${intervalLabel}`}
						className={cn(
							buttonVariants({ variant: "ghost", size: "icon" }),
							"relative size-9 rounded-none text-panel-text-secondary transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text active:scale-[0.98] touch-manipulation",
						)}
					>
						<ChevronDown className="size-3.5" />
						{active && (
							<span
								aria-hidden="true"
								className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-panel-accent ring-2 ring-panel-surface"
							/>
						)}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					collisionPadding={12}
					onCloseAutoFocus={(e) => e.preventDefault()}
					className="min-w-52 max-w-[calc(100vw-24px)] rounded-xl border-panel-border bg-panel-elevated"
				>
					<DropdownMenuLabel className="text-[12px] font-semibold text-panel-text-secondary">
						{t("usersTable.autoRefresh")}
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="bg-panel-border" />
					<DropdownMenuItem
						onSelect={() => onIntervalChange(0)}
						className={cn(
							"text-[13px]",
							!active && "font-semibold text-panel-accent",
						)}
					>
						{t("usersTable.autoRefreshOff")}
					</DropdownMenuItem>
					{AUTO_REFRESH_INTERVALS.map((value) => (
						<DropdownMenuItem
							key={value}
							onSelect={() => onIntervalChange(value)}
							className={cn(
								"text-[13px]",
								interval === value && "font-semibold text-panel-accent",
							)}
						>
							{t("usersTable.autoRefreshEvery", { seconds: value / 1000 })}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
