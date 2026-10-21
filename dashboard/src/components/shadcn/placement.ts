export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

/**
 * Parses Chakra placement strings such as "bottom-end", "top" or "left-start".
 * Chakra's `start`/`end` are logical, so they flip under RTL. Radix's are
 * physical, which is why the flip happens here.
 */
export function parsePlacement(
	placement?: string,
	rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl",
): { side: Side; align: Align } {
	if (!placement) return { side: "bottom", align: "center" };
	const [first, second] = placement.split("-");
	const side: Side =
		first === "top" || first === "left" || first === "right" ? first : "bottom";
	const align: Align =
		second === "start" ? (rtl ? "end" : "start") : second === "end" ? (rtl ? "start" : "end") : "center";
	return { side, align };
}
