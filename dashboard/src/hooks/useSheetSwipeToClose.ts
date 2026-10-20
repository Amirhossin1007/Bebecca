import { useEffect } from "react";

const GRAB_ZONE_PX = 72;
const CLOSE_DISTANCE_PX = 120;

export const useSheetSwipeToClose = () => {
	useEffect(() => {
		let sheet: HTMLElement | null = null;
		let startY = 0;
		let offset = 0;
		let activePointerId: number | null = null;

		const startTracking = (dialog: HTMLElement, clientY: number, pointerId?: number) => {
			sheet = dialog;
			startY = clientY;
			offset = 0;
			activePointerId = pointerId ?? null;
			sheet.style.animation = "none";
			sheet.style.transition = "none";
			sheet.style.touchAction = "none";
		};

		const updateTracking = (clientY: number) => {
			if (!sheet) return;
			const delta = clientY - startY;
			offset = Math.max(0, delta);
			sheet.style.setProperty("transform", `translateY(${offset}px)`, "important");
		};

		const endTracking = () => {
			if (!sheet) return;
			const dialog = sheet;
			sheet = null;
			activePointerId = null;
			const dialogHeight = dialog.offsetHeight || 300;
			const threshold = Math.min(
				CLOSE_DISTANCE_PX,
				Math.max(50, dialogHeight * 0.22),
			);

			if (offset > threshold) {
				dialog.style.transition =
					"transform 0.24s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-out";
				dialog.style.setProperty("transform", "translateY(100%)", "important");
				dialog.style.opacity = "0";
				window.setTimeout(() => {
					const closeBtn = dialog.querySelector<HTMLElement>(
						".chakra-modal__close-btn, button[aria-label='Close']",
					);
					if (closeBtn) {
						closeBtn.click();
					} else {
						window.dispatchEvent(
							new KeyboardEvent("keydown", { key: "Escape" }),
						);
					}
				}, 60);
				window.setTimeout(() => {
					dialog.style.transition = "";
					dialog.style.transform = "";
					dialog.style.opacity = "";
					dialog.style.animation = "";
					dialog.style.touchAction = "";
				}, 350);
			} else {
				dialog.style.transition =
					"transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
				dialog.style.setProperty("transform", "translateY(0px)", "important");
				window.setTimeout(() => {
					dialog.style.transition = "";
					dialog.style.transform = "";
					dialog.style.animation = "";
					dialog.style.touchAction = "";
				}, 220);
			}
		};

		const onPointerDown = (event: PointerEvent) => {
			if (event.pointerType === "mouse" && event.button !== 0) return;
			const target = event.target as HTMLElement | null;
			const dialog = target?.closest<HTMLElement>(".chakra-modal__content");
			if (
				!dialog ||
				!window.matchMedia("(max-width: 47.99em)").matches ||
				dialog.getAttribute("data-modal-centered") === "true" ||
				dialog.classList.contains("rb-confirm-dialog-content")
			)
				return;
			const rect = dialog.getBoundingClientRect();
			const relativeY = event.clientY - rect.top;
			if (relativeY < 0 || relativeY > GRAB_ZONE_PX) return;
			startTracking(dialog, event.clientY, event.pointerId);
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!sheet) return;
			if (activePointerId !== null && event.pointerId !== activePointerId) return;
			if (event.cancelable) event.preventDefault();
			updateTracking(event.clientY);
		};

		const onPointerUp = (event: PointerEvent) => {
			if (!sheet) return;
			if (activePointerId !== null && event.pointerId !== activePointerId) return;
			endTracking();
		};

		const onTouchStart = (event: TouchEvent) => {
			if (sheet) return;
			const target = event.target as HTMLElement | null;
			const dialog = target?.closest<HTMLElement>(".chakra-modal__content");
			if (
				!dialog ||
				!window.matchMedia("(max-width: 47.99em)").matches ||
				dialog.getAttribute("data-modal-centered") === "true" ||
				dialog.classList.contains("rb-confirm-dialog-content")
			)
				return;
			const touch = event.touches[0];
			if (!touch) return;
			const rect = dialog.getBoundingClientRect();
			const relativeY = touch.clientY - rect.top;
			if (relativeY < 0 || relativeY > GRAB_ZONE_PX) return;
			startTracking(dialog, touch.clientY);
		};

		const onTouchMove = (event: TouchEvent) => {
			if (!sheet) return;
			const touch = event.touches[0];
			if (!touch) return;
			if (event.cancelable) event.preventDefault();
			updateTracking(touch.clientY);
		};

		const onTouchEnd = () => {
			if (!sheet) return;
			endTracking();
		};

		window.addEventListener("pointerdown", onPointerDown, { passive: true });
		window.addEventListener("pointermove", onPointerMove, { passive: false });
		window.addEventListener("pointerup", onPointerUp, { passive: true });
		window.addEventListener("pointercancel", onPointerUp, { passive: true });

		window.addEventListener("touchstart", onTouchStart, { passive: true });
		window.addEventListener("touchmove", onTouchMove, { passive: false });
		window.addEventListener("touchend", onTouchEnd, { passive: true });
		window.addEventListener("touchcancel", onTouchEnd, { passive: true });

		return () => {
			window.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);

			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("touchcancel", onTouchEnd);
		};
	}, []);
};
