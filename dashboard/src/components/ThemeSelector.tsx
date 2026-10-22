import { Button } from "components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "components/ui/dropdown-menu";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Check, Moon, Sun, SwatchBook } from "lucide-react";
import { useColorMode } from "lib/color-mode";
import {
	type CSSProperties,
	type FC,
	type MutableRefObject,
	type MouseEvent as ReactMouseEvent,
	useEffect,
	useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useDisclosure } from "hooks/useDisclosure";
import { useMediaQuery } from "hooks/useMediaQuery";
import { cn } from "lib/cn";
import { updateThemeColor } from "utils/themeColor";

const THEME_OPTIONS: Array<{
	key: ThemeMode;
	label: string;
	icon: typeof Moon;
}> = [
	{ key: "dark", label: "Dark", icon: Moon },
	{ key: "light", label: "Light", icon: Sun },
];

/** Every theme-menu surface gets the same width, padding and radius. */
const PANEL_CLASS =
	"min-w-[min(320px,calc(100vw_-_24px))]! max-w-[calc(100vw_-_16px)] p-3 rounded-md shadow-sm sm:min-w-[320px]!";

const THEME_KEY = "rb-theme";
const CHAKRA_THEME_KEY = "chakra-ui-color-mode";
const ACCENT_KEY = "rb-accent";
const CUSTOM_THEMES_KEY = "rb-custom-themes";

type ThemeMode = "dark" | "light";

type AccentOption = {
	key: string;
	label: string;
	color: string;
	hover: string;
};

type ThemeSelectorProps = {
	minimal?: boolean;
	portalContainer?: MutableRefObject<HTMLElement | null>;
	trigger?: "icon" | "menu" | "menuItem";
	triggerLabel?: string;
	onModalOpen?: () => void;
	onModalClose?: () => void;
};

const ACCENT_OPTIONS: AccentOption[] = [
	{
		key: "crimson",
		label: "Red / Crimson",
		color: "#e0003c",
		hover: "#f01446",
	},
	{ key: "blue", label: "Blue", color: "#2563eb", hover: "#3b82f6" },
	{ key: "green", label: "Green", color: "#16a34a", hover: "#22c55e" },
	{ key: "purple", label: "Purple", color: "#7c3aed", hover: "#8b5cf6" },
	{ key: "orange", label: "Orange", color: "#ea580c", hover: "#f97316" },
];

const clamp = (value: number, min = 0, max = 1) =>
	Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string) => {
	const normalized = hex.replace("#", "");
	const bigint = parseInt(normalized, 16);
	if (normalized.length === 3) {
		const r = (bigint >> 8) & 0xf;
		const g = (bigint >> 4) & 0xf;
		const b = bigint & 0xf;
		return {
			r: (r << 4) | r,
			g: (g << 4) | g,
			b: (b << 4) | b,
		};
	}
	return {
		r: (bigint >> 16) & 255,
		g: (bigint >> 8) & 255,
		b: bigint & 255,
	};
};

const rgbToHex = (r: number, g: number, b: number) => {
	const toHex = (value: number) => value.toString(16).padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsl = (r: number, g: number, b: number) => {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			default:
				h = (r - g) / d + 4;
		}
		h /= 6;
	}
	return { h, s, l };
};

const hslToRgb = (h: number, s: number, l: number) => {
	let r: number;
	let g: number;
	let b: number;

	if (s === 0) {
		r = g = b = l;
	} else {
		const hue2rgb = (p: number, q: number, t: number) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}

	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255),
	};
};

const generatePalette = (baseHex: string) => {
	try {
		const { r, g, b } = hexToRgb(baseHex);
		const { h, s, l } = rgbToHsl(r, g, b);
		const stops: [string, number][] = [
			["50", 0.42],
			["100", 0.32],
			["200", 0.22],
			["300", 0.12],
			["400", 0.06],
			["500", 0],
			["600", -0.06],
			["700", -0.13],
			["800", -0.22],
			["900", -0.32],
		];

		return stops.reduce<Record<string, string>>((acc, [suffix, shift]) => {
			const { r: rr, g: gg, b: bb } = hslToRgb(h, s, clamp(l + shift));
			acc[`--primary-${suffix}`] = rgbToHex(rr, gg, bb);
			return acc;
		}, {});
	} catch {
		return {};
	}
};

const normalizeTheme = (value?: string | null): ThemeMode =>
	value === "light" ? "light" : "dark";

const normalizeAccent = (value?: string | null) =>
	ACCENT_OPTIONS.some((option) => option.key === value) ? value! : "crimson";

const getStoredAccent = () => {
	try {
		return normalizeAccent(localStorage.getItem(ACCENT_KEY));
	} catch {
		return "crimson";
	}
};

const applyAccent = (accentKey: string) => {
	const accent =
		ACCENT_OPTIONS.find((option) => option.key === accentKey) ??
		ACCENT_OPTIONS[0];
	const root = document.documentElement;
	root.style.setProperty("--rb-panel-accent", accent.color);
	root.style.setProperty("--rb-panel-accent-hover", accent.hover);
	Object.entries(generatePalette(accent.color)).forEach(([key, value]) => {
		root.style.setProperty(key, value);
	});
};

const applyThemeMode = (theme: ThemeMode) => {
	try {
		localStorage.setItem(THEME_KEY, theme);
		localStorage.setItem(CHAKRA_THEME_KEY, theme);
		localStorage.removeItem(CUSTOM_THEMES_KEY);
	} catch {}

	const targets = [document.documentElement, document.body].filter(
		Boolean,
	) as HTMLElement[];
	targets.forEach((target) => {
		target.classList.remove(
			"rb-theme-light",
			"rb-theme-dark",
			"chakra-ui-light",
			"chakra-ui-dark",
		);
		target.classList.add(`rb-theme-${theme}`, `chakra-ui-${theme}`);
		target.dataset.theme = theme;
		target.style.colorScheme = theme;
	});
	updateThemeColor(theme);
};

type ThemePanelProps = {
	minimal: boolean;
	activeTheme: ThemeMode;
	activeAccent: string;
	onSelectTheme: (theme: ThemeMode) => void;
	onSelectAccent: (accent: string) => void;
};

/** The picker body. The icon, menu and nested-menu triggers all render it. */
const ThemePanel: FC<ThemePanelProps> = ({
	minimal,
	activeTheme,
	activeAccent,
	onSelectTheme,
	onSelectAccent,
}) => {
	const { t } = useTranslation();

	return (
		<TooltipProvider delayDuration={300}>
			<div className="flex select-none flex-col gap-3 text-panel-text">
				<div>
					<p className="mb-2 text-xs font-bold uppercase text-panel-text-secondary">
						{t("header.theme")}
					</p>
					<div className="grid grid-cols-2 gap-2">
						{THEME_OPTIONS.map((theme) => {
							const selected = activeTheme === theme.key;
							const Icon = theme.icon;
							return (
								<Button key={theme.key} onClick={() => onSelectTheme(theme.key)} variant="outline" className={cn(
										"relative h-[72px] rounded-[6px] px-3 text-panel-text hover:border-panel-accent! hover:bg-panel-elevated",
										selected
											? "border-2 border-panel-accent! bg-panel-elevated"
											: "border border-panel-border! bg-transparent",
									)}>
									<span className="flex w-full flex-col items-center justify-center gap-2">
										<Icon className="size-4" />
										<span className="text-center font-bold leading-none">
											{t(`theme.${theme.key}`, theme.label)}
										</span>
									</span>
									{selected ? (
										<span className="absolute right-2 top-2 text-panel-accent">
											<Check className="size-4" />
										</span>
									) : null}
								</Button>
							);
						})}
					</div>
				</div>

				{!minimal ? (
					<hr className="my-2 border-0 border-b border-panel-border! opacity-60" />
				) : null}

				<div>
					<p className="mb-2 text-xs font-bold uppercase text-panel-text-secondary">
						{t("theme.accent")}
					</p>
					<div className="grid grid-cols-5 gap-2">
						{ACCENT_OPTIONS.map((accent) => {
							const selected = activeAccent === accent.key;
							const label = t(`theme.accent.${accent.key}`, accent.label);
							return (
								<Tooltip key={accent.key}>
<TooltipTrigger asChild>
									
										<button
											type="button"
											aria-label={label}
											onClick={() => onSelectAccent(accent.key)}
											style={
												{
													"--swatch": accent.color,
													"--swatch-hover": accent.hover,
												} as CSSProperties
											}
											className={cn(
												"inline-flex h-[34px] min-w-[34px]! items-center justify-center rounded-[6px] bg-[var(--swatch)] text-white outline-none transition-colors hover:border-panel-text! hover:bg-[var(--swatch-hover)] focus-visible:shadow-[0_0_0_2px_var(--rb-panel-accent)]",
												selected
													? "border-2 border-panel-text!"
													: "border border-panel-border!",
											)}
										>
											{selected ? <Check className="size-4" /> : null}
										</button>
									
								</TooltipTrigger>
<TooltipContent>{label}</TooltipContent>
</Tooltip>
							);
						})}
					</div>
				</div>
			</div>
		</TooltipProvider>
	);
};

export const ThemeSelector: FC<ThemeSelectorProps> = ({
	minimal = false,
	portalContainer,
	trigger = "icon",
	triggerLabel,
	onModalClose,
}) => {
	const { t } = useTranslation();
	const { colorMode, setColorMode } = useColorMode();
	const themeMenu = useDisclosure();
	// Chakra auto-placed the nested picker to the side on desktop and below the row on mobile.
	const isWide = useMediaQuery("(min-width: 48em)");
	const activeTheme = normalizeTheme(colorMode);
	const [activeAccent, setActiveAccent] = useState(getStoredAccent);

	useEffect(() => {
		onModalClose?.();
	}, [onModalClose]);

	useEffect(() => {
		applyThemeMode(activeTheme);
	}, [activeTheme]);

	useEffect(() => {
		applyAccent(activeAccent);
		try {
			localStorage.setItem(ACCENT_KEY, activeAccent);
		} catch {}
	}, [activeAccent]);

	const selectTheme = (theme: ThemeMode) => {
		if (theme !== activeTheme) setColorMode(theme);
	};

	const selectAccent = (accent: string) => {
		setActiveAccent(accent);
	};

	const panel = (
		<ThemePanel
			minimal={minimal}
			activeTheme={activeTheme}
			activeAccent={activeAccent}
			onSelectTheme={selectTheme}
			onSelectAccent={selectAccent}
		/>
	);

	if (trigger === "menuItem") {
		return (
			<Popover open={themeMenu.isOpen} onOpenChange={(open) =>
					open ? themeMenu.onOpen() : themeMenu.onClose()
				}>
				<PopoverTrigger asChild>
					<Button onClick={(event: ReactMouseEvent) => event.stopPropagation()} variant="ghost" className="h-10 w-full justify-start gap-3 rounded-md bg-transparent px-3 font-medium text-panel-text hover:bg-panel-elevated focus-visible:bg-panel-elevated active:bg-panel-elevated">
						<SwatchBook className="size-4 shrink-0" />
						<span className="truncate">
							{triggerLabel || t("header.theme")}
						</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent side={isWide ? "left" : "bottom"} className={cn("items-start", PANEL_CLASS)}>
					{panel}
				</PopoverContent>
			</Popover>
		);
	}

	const triggerButton =
		trigger === "icon" ? (
			<Button aria-label={t("header.theme")} variant="outline" size="icon" className="relative">
				<SwatchBook />
			</Button>
		) : (
			<Button variant="ghost" className="w-full justify-between">
				{triggerLabel || t("header.theme")}
				<SwatchBook />
			</Button>
		);

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
			<DropdownMenuContent className={cn("items-start", PANEL_CLASS)}>
				{panel}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default ThemeSelector;
