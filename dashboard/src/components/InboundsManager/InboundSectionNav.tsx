import { type RefObject, useEffect, useState } from "react";
import { cn } from "lib/cn";

type SectionEntry = {
	id: string;
	title: string;
	element: HTMLElement;
};

const ACTIVE_OFFSET = 24;

export const InboundSectionNav = ({
	containerRef,
	resetKey,
}: {
	containerRef: RefObject<HTMLDivElement | null>;
	resetKey: unknown;
}) => {
	const [sections, setSections] = useState<SectionEntry[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		let entries: SectionEntry[] = [];
		let frame = 0;

		const updateActive = () => {
			const top = container.getBoundingClientRect().top + ACTIVE_OFFSET;
			let next = entries[0]?.id ?? null;
			for (const entry of entries) {
				if (entry.element.getBoundingClientRect().top <= top) next = entry.id;
			}
			for (const entry of entries) {
				entry.element.dataset.active = String(entry.id === next);
			}
			setActiveId(next);
		};

		const collect = () => {
			frame = 0;
			entries = Array.from(
				container.querySelectorAll<HTMLElement>("[data-form-section]"),
			)
				.filter((element) => element.getClientRects().length > 0)
				.map((element) => ({
					id: element.dataset.formSection ?? "",
					title: element.dataset.formSectionTitle ?? "",
					element,
				}));
			setSections(entries);
			updateActive();
		};

		const scheduleCollect = () => {
			if (!frame) frame = requestAnimationFrame(collect);
		};

		collect();
		container.addEventListener("scroll", updateActive, { passive: true });
		const observer = new MutationObserver(scheduleCollect);
		observer.observe(container, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			container.removeEventListener("scroll", updateActive);
			if (frame) cancelAnimationFrame(frame);
		};
	}, [containerRef, resetKey]);

	const scrollToSection = (entry: SectionEntry) => {
		const container = containerRef.current;
		if (!container) return;
		const offset =
			entry.element.getBoundingClientRect().top -
			container.getBoundingClientRect().top;
		container.scrollTo({
			top: container.scrollTop + offset - 12,
			behavior: "smooth",
		});
	};

	if (sections.length < 2) return null;

	return (
		<nav className="flex flex-wrap gap-1.5">
			{sections.map((entry) => {
				const isActive = entry.id === activeId;
				return (
					<button
						key={entry.id}
						type="button"
						aria-current={isActive ? "true" : undefined}
						onClick={() => scrollToSection(entry)}
						className={cn(
							"rounded-md border px-2.5 py-1 text-[0.8125rem] font-medium transition-colors",
							isActive
								? "border-primary/40 bg-primary/15 text-primary"
								: "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						{entry.title}
					</button>
				);
			})}
		</nav>
	);
};
