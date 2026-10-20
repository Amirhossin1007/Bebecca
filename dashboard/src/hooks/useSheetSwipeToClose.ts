import { useEffect } from "react";

const GRAB_ZONE_PX = 88;
const CLOSE_DISTANCE_PX = 110;

const dismissSheet = (dialog: HTMLElement) => {
	const closeBtn = dialog.querySelector<HTMLElement>(
		".chakra-modal__close-btn, button[aria-label='Close'], button[aria-label='close']",
	);
	if (closeBtn) {
		closeBtn.click();
		return;
	}

	const container = dialog.closest(".chakra-modal__content-container");
	const overlay =
		container?.parentElement?.querySelector<HTMLElement>(
			".chakra-modal__overlay",
		) ||
		container?.querySelector<HTMLElement>(".chakra-modal__overlay") ||
		document.querySelector<HTMLElement>(".chakra-modal__overlay");

	if (overlay) {
		overlay.click();
		return;
	}

	const escEvent = new KeyboardEvent("keydown", {
		key: "Escape",
		code: "Escape",
		keyCode: 27,
		which: 27,
		bubbles: true,
		cancelable: true,
		view: window,
	});
	dialog.dispatchEvent(escEvent);
	document.dispatchEvent(escEvent);
	window.dispatchEvent(escEvent);
};

export const useSheetSwipeToClose = () => {
	useEffect(() => {
		let sheet: HTMLElement | null = null;
		let activePointerId: number | null = null;
		let capturedTarget: HTMLElement | null = null;
		let startX = 0;
		let startY = 0;
		let isDragging = false;
		let offset = 0;

		const endTracking = () => {
			if (!sheet) return;
			const dialog = sheet;
			sheet = null;
			activePointerId = null;
			isDragging = false;

			const dialogHeight = dialog.offsetHeight || 300;
			const threshold = Math.min(
				CLOSE_DISTANCE_PX,
				Math.max(50, dialogHeight * 0.22),
			);

			if (offset > threshold) {
				dialog.style.transition =
					"transform 0.22s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.18s ease-out";
				dialog.style.setProperty("transform", "translateY(100%)", "important");
				dialog.style.opacity = "0";

				window.setTimeout(() => {
					dismissSheet(dialog);
				}, 60);

				window.setTimeout(() => {
					dialog.style.removeProperty("transition");
					dialog.style.removeProperty("transform");
					dialog.style.removeProperty("opacity");
					dialog.style.removeProperty("animation");
					dialog.style.removeProperty("touch-action");
				}, 320);
			} else {
				dialog.style.transition =
					"transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
				dialog.style.setProperty("transform", "translateY(0px)", "important");

				window.setTimeout(() => {
					dialog.style.removeProperty("transition");
					dialog.style.removeProperty("transform");
					dialog.style.removeProperty("opacity");
					dialog.style.removeProperty("animation");
					dialog.style.removeProperty("touch-action");
				}, 220);
			}
		};

		const onPointerDown = (event: PointerEvent) => {
			if (event.pointerType === "mouse" && event.button !== 0) return;
			const target = event.target as HTMLElement | null;
			if (!target) return;

			if (
				target.closest(
					"button, a, input, select, textarea, [role='button'], [data-no-sheet-drag='true']",
				)
			) {
				return;
			}

			const dialog = target.closest<HTMLElement>(".chakra-modal__content");
			if (
				!dialog ||
				!window.matchMedia("(max-width: 768.98px)").matches ||
				dialog.getAttribute("data-modal-centered") === "true" ||
				dialog.classList.contains("rb-confirm-dialog-content") ||
				dialog.classList.contains("chakra-slide")
			) {
				return;
			}

			const rect = dialog.getBoundingClientRect();
			const relativeY = event.clientY - rect.top;

			const isHeaderOrHandle = Boolean(
				target.closest(".chakra-modal__header, [data-sheet-handle='true']") ||
					target === dialog,
			);

			const body = dialog.querySelector<HTMLElement>(".chakra-modal__body");
			const isInsideBody = Boolean(target.closest(".chakra-modal__body"));
			if (isInsideBody && body && body.scrollTop > 0) return;

			if (!isHeaderOrHandle && (relativeY < -24 || relativeY > GRAB_ZONE_PX)) {
				return;
			}

			sheet = dialog;
			activePointerId = event.pointerId;
			capturedTarget = target;
			startX = event.clientX;
			startY = event.clientY;
			offset = 0;
			isDragging = false;

			try {
				target.setPointerCapture?.(event.pointerId);
			} catch {}
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!sheet || activePointerId === null) return;
			if (event.pointerId !== activePointerId) return;

			const deltaY = event.clientY - startY;
			const deltaX = event.clientX - startX;

			if (!isDragging) {
				if (deltaY > 6 && Math.abs(deltaY) > Math.abs(deltaX)) {
					isDragging = true;
					sheet.style.animation = "none";
					sheet.style.transition = "none";
				} else if (Math.abs(deltaX) > 10 || deltaY < -10) {
					sheet = null;
					activePointerId = null;
					return;
				}
			}

			if (isDragging) {
				if (event.cancelable) event.preventDefault();
				offset = Math.max(0, deltaY);
				sheet.style.setProperty("transform", `translateY(${offset}px)`, "important");
			}
		};

		const onPointerUp = (event: PointerEvent) => {
			if (!sheet || activePointerId === null) return;
			if (event.pointerId !== activePointerId) return;

			if (capturedTarget) {
				try {
					capturedTarget.releasePointerCapture?.(activePointerId);
				} catch {}
				capturedTarget = null;
			}

			if (!isDragging) {
				sheet = null;
				activePointerId = null;
				return;
			}

			endTracking();
		};

		const onPointerCancel = (event: PointerEvent) => {
			if (!sheet || activePointerId === null) return;
			if (event.pointerId !== activePointerId) return;

			if (capturedTarget) {
				try {
					capturedTarget.releasePointerCapture?.(activePointerId);
				} catch {}
				capturedTarget = null;
			}

			if (isDragging) {
				endTracking();
			} else {
				sheet = null;
				activePointerId = null;
			}
		};

		window.addEventListener("pointerdown", onPointerDown, { passive: true });
		window.addEventListener("pointermove", onPointerMove, { passive: false });
		window.addEventListener("pointerup", onPointerUp, { passive: true });
		window.addEventListener("pointercancel", onPointerCancel, { passive: true });

		return () => {
			window.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
		};
	}, []);
};
