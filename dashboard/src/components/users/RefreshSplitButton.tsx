import {
	ButtonGroup,
	IconButton,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Portal,
	Text,
	Tooltip,
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ReloadIcon } from "components/Filters";
import { Button } from "components/shadcn/button";
import { cn } from "lib/cn";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

type RefreshSplitButtonProps = {
	onRefresh: () => void;
	isLoading?: boolean;
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
	isLoading = false,
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

			<Menu placement={i18n.dir() === "rtl" ? "bottom-start" : "bottom-end"} isLazy>
				<Tooltip
					label={`${labels.autoRefresh}: ${intervalLabel}`}
					placement="top"
					hasArrow
					openDelay={300}
				>
					<MenuButton
						as={IconButton}
						aria-label={`${labels.autoRefresh}: ${intervalLabel}`}
						icon={
							<span style={{ position: "relative", display: "inline-flex" }}>
								<ChevronDownIcon width={14} />
								{active ? (
									<span
										aria-hidden="true"
										style={{
											position: "absolute",
											insetInlineEnd: 0,
											top: 0,
											width: 6,
											height: 6,
											borderRadius: "999px",
											background: "var(--rb-panel-accent)",
											boxShadow: "0 0 0 2px var(--rb-panel-surface)",
										}}
									/>
								) : null}
							</span>
						}
						isDisabled={isLoading}
						borderStartRadius={0}
						borderEndRadius="full"
						px={1.5}
						h="32px"
						minW="30px"
					/>
				</Tooltip>
				<Portal>
					<MenuList zIndex={1800} minW="200px" bg="panel.surface" borderColor="panel.border">
						<Text
							px={3}
							pt={2}
							pb={1}
							fontSize="xs"
							color="panel.textMuted"
							textTransform="uppercase"
							letterSpacing="0.08em"
						>
							{labels.autoRefresh}
						</Text>
						<MenuItem
							onClick={() => onIntervalChange(0)}
							fontWeight={!active ? "semibold" : "normal"}
						>
							{labels.off}
						</MenuItem>
						{intervals.map((value) => (
							<MenuItem
								key={value}
								onClick={() => onIntervalChange(value)}
								fontWeight={interval === value ? "semibold" : "normal"}
							>
								{labels.every(value / 1000)}
							</MenuItem>
						))}
					</MenuList>
				</Portal>
			</Menu>
		</ButtonGroup>
	);
};
