import { useCallback, useRef, useState } from "react";

export const useContainerMinWidths = (...minWidths: number[]) => {
	const [matches, setMatches] = useState(() => minWidths.map(() => false));
	const minWidthsRef = useRef(minWidths);
	minWidthsRef.current = minWidths;
	const observerRef = useRef<ResizeObserver | null>(null);
	const ref = useCallback((node: HTMLElement | null) => {
		observerRef.current?.disconnect();
		observerRef.current = null;
		if (!node) return;
		const measure = (width: number) => {
			const next = minWidthsRef.current.map((minWidth) => width >= minWidth);
			setMatches((prev) =>
				prev.length === next.length && prev.every((value, i) => value === next[i])
					? prev
					: next,
			);
		};
		measure(node.getBoundingClientRect().width);
		const observer = new ResizeObserver(([entry]) =>
			measure(entry.contentRect.width),
		);
		observer.observe(node);
		observerRef.current = observer;
	}, []);
	return [ref, matches] as const;
};
