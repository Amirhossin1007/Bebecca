import { useBreakpointValue } from "hooks/useBreakpointValue";
import { Popover, PopoverArrow, PopoverBody, PopoverCloseButton, PopoverContent, PopoverHeader, PopoverTrigger } from "components/shadcn/popover";
import { Button, IconButton } from "components/shadcn/button";
import { Tag } from "components/shadcn/badge";
import { useClipboard } from "hooks/useClipboard";
import { Tooltip } from "components/shadcn/tooltip";
import { withClass } from "components/shadcn/icon";
import {
	ClipboardIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import type React from "react";

const InfoIcon = withClass(InformationCircleIcon, "w-4 h-4");
const CopyIcon = withClass(ClipboardIcon, "w-4 h-4");

interface CompactPopoverProps {
	triggerLabel?: React.ReactNode;
	title?: React.ReactNode;
	children: React.ReactNode;
}

export const CompactPopover: React.FC<CompactPopoverProps> = ({
	triggerLabel,
	title,
	children,
}) => {
	const isMobile = useBreakpointValue({ base: true, md: false });
	return (
		<Popover placement={isMobile ? "bottom" : "right"} isLazy>
			<PopoverTrigger>
				<Button size="xs" variant="outline">
					{triggerLabel ?? <InfoIcon />}
				</Button>
			</PopoverTrigger>
			<PopoverContent>
				<PopoverArrow />
				<PopoverCloseButton />
				{title && <PopoverHeader className="font-semibold">{title}</PopoverHeader>}
				<PopoverBody>{children}</PopoverBody>
			</PopoverContent>
		</Popover>
	);
};

export const CompactChips: React.FC<{ chips: string[]; color?: string }> = ({
	chips,
	color = "blue",
}) => {
	const first = chips[0];
	const rest = chips.slice(1);
	return (
		<div className="flex flex-row gap-2 items-center">
			{first ? (
				<Tag size="sm" colorScheme={color}>
					{first}
				</Tag>
			) : (
				<p className="text-gray-400">-</p>
			)}
			{rest.length > 0 && (
				<CompactPopover
					triggerLabel={<Tag size="sm">+{rest.length}</Tag>}
					title={"Details"}
				>
					<div className="flex flex-col gap-2 items-stretch">
						{chips.map((c) => (
							<div key={c} className="flex flex-row items-center gap-2 justify-between">
								<p>{c}</p>
							</div>
						))}
					</div>
				</CompactPopover>
			)}
		</div>
	);
};

export const CompactTextWithCopy: React.FC<{
	text?: string;
	label?: string;
}> = ({ text, label }) => {
	const display =
		text && text.length > 40 ? `${text.slice(0, 36)}...` : text || "-";
	const { hasCopied, onCopy } = useClipboard(text ?? "");
	return (
		<div className="flex flex-row gap-2 items-center">
			<CompactPopover triggerLabel={display} title={label}>
				<div className="flex flex-row items-start gap-2">
					<Tooltip label={hasCopied ? "Copied" : "Copy"} hasArrow>
						<IconButton variant="solid" aria-label={hasCopied ? "Copied" : "Copy"} size="sm" icon={<CopyIcon />} onClick={onCopy} />
					</Tooltip>
					<p className="break-all pt-1.5">{text}</p>
				</div>
			</CompactPopover>
		</div>
	);
};

export default CompactPopover;
