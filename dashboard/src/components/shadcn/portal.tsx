import { createPortal } from "react-dom";
import type { ReactNode, RefObject } from "react";

/** Chakra's Portal: renders its children into `containerRef`, or into the body. */
export function Portal({
	children,
	containerRef,
}: {
	children?: ReactNode;
	containerRef?: RefObject<HTMLElement | null>;
	appendToParentPortal?: boolean;
}) {
	// Chakra portals rendered nothing until mounted; server rendering has no document to portal into
  if (typeof document === "undefined") return null;
  return createPortal(children, containerRef?.current ?? document.body);
}
