import { useEffect } from "react";

const GRAB_ZONE_PX = 56;
const CLOSE_DISTANCE_PX = 120;

export const useSheetSwipeToClose = () => {
	useEffect(() => {
		let sheet: HTMLElement | null = null;
		let startY = 0;
		let offset = 0;

		const onTouchStart = (event: TouchEvent) => {
			const dialog = (event.target as HTMLElement | null)?.closest<HTMLElement>(
				".chakra-modal__content",
			);
			if (
				!dialog ||
				!window.matchMedia("(max-width: 47.99em)").matches ||
				dialog.getAttribute("data-modal-centered") === "true" ||
				dialog.classList.contains("rb-confirm-dialog-content")
			)
				return;
			const touchY = event.touches[0].clientY;
			if (touchY - dialog.getBoundingClientRect().top > GRAB_ZONE_PX) return;
			sheet = dialog;
			startY = touchY;
			offset = 0;
			dialog.style.transition = "none";
		};

		const onTouchMove = (event: TouchEvent) => {
			if (!sheet) return;
			offset = Math.max(0, event.touches[0].clientY - startY);
			sheet.style.transform = `translateY(${offset}px)`;
		};

		const onTouchEnd = () => {
			if (!sheet) return;
			const dialog = sheet;
			sheet = null;
			const dialogHeight = dialog.offsetHeight || 300;
			const threshold = Math.min(CLOSE_DISTANCE_PX, Math.max(60, dialogHeight * 0.25));
			if (offset > threshold) {
				dialog.style.transition =
					"transform 0.24s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-out";
				dialog.style.transform = "translateY(100vh)";
				dialog.style.opacity = "0";
				window.setTimeout(() => {
					const closeBtn = dialog.querySelector<HTMLElement>(
						".chakra-modal__close-btn",
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
				}, 400);
			} else {
				dialog.style.transition =
					"transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
				dialog.style.transform = "translateY(0px)";
				window.setTimeout(() => {
					dialog.style.transition = "";
					dialog.style.transform = "";
				}, 220);
			}
		};

		document.addEventListener("touchstart", onTouchStart, { passive: true });
		document.addEventListener("touchmove", onTouchMove, { passive: true });
		document.addEventListener("touchend", onTouchEnd);
		return () => {
			document.removeEventListener("touchstart", onTouchStart);
			document.removeEventListener("touchmove", onTouchMove);
			document.removeEventListener("touchend", onTouchEnd);
		};
	}, []);
};
