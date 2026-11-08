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
			if (!dialog || !window.matchMedia("(max-width: 47.99em)").matches) return;
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
			dialog.style.transition = "";
			dialog.style.transform = "";
			if (offset > CLOSE_DISTANCE_PX) {
				dialog.querySelector<HTMLElement>(".chakra-modal__close-btn")?.click();
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
