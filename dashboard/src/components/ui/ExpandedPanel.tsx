import { cn } from "lib/cn";
import type { ReactNode } from "react";

export const ExpandedDetails = ({ children }: { children: ReactNode }) => (
	<div data-density="compact" className="rb-resource-details">
		{children}
	</div>
);

export const ExpandedHeading = ({
	title,
	first,
}: {
	title: ReactNode;
	first?: boolean;
}) => (
	<p className={cn("[grid-column:1_/_-1] text-[0.75rem] font-semibold text-panel-text-secondary pb-1", first ? "pt-0" : "pt-3")}>
		{title}
	</p>
);

export const ExpandedMeta = ({
	label,
	value,
}: {
	label: ReactNode;
	value: ReactNode;
}) => (
	<div className="min-w-0! rb-resource-meta">
		<span className="text-panel-text-muted">
			{label}
		</span>
		<div className="text-panel-text rb-resource-meta-value">
			{value}
		</div>
	</div>
);
