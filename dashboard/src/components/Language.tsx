import { Button } from "components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "components/ui/dropdown-menu";
import { cn } from "lib/cn";
import { Check, Languages } from "lucide-react";
import type { FC, MutableRefObject, ReactNode } from "react";
import ReactCountryFlag from "react-country-flag";
import { useTranslation } from "react-i18next";
import ImperialIranFlag from "../assets/imperial-iran-flag.svg?react";

type LanguageProps = {
	actions?: ReactNode;
	portalContainer?: MutableRefObject<HTMLElement | null>;
	triggerVariant?: "outline" | "ghost";
};

const LANGUAGE_OPTIONS = [
	{ code: "en", label: "English", flag: "US" },
	{ code: "fa", label: "پارسی", flag: "IR" },
	{ code: "zh-cn", label: "中文", flag: "CN" },
	{ code: "ru", label: "Русский", flag: "RU" },
] as const;

export const Language: FC<LanguageProps> = ({
	triggerVariant = "outline",
}) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	return (
		<DropdownMenu dir={isRTL ? "rtl" : "ltr"}>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					size="sm"
					variant={triggerVariant}
					aria-label={t("header.language")}
					className="relative h-[34px] min-w-[34px] rounded-[12px] border-panel-border! bg-panel-surface px-2.5 text-panel-text transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] md:hover:border-panel-border-strong! md:hover:bg-panel-elevated"
				>
					<Languages className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={isRTL ? "start" : "end"}
				sideOffset={8}
				className="z-[9999] min-w-[180px]! rounded-[14px] border border-panel-border! bg-panel-surface p-1.5 text-panel-text shadow-[0_12px_32px_rgba(0,0,0,0.24)] select-none"
			>
				{LANGUAGE_OPTIONS.map(({ code, label, flag }) => {
					const isActive = i18n.language === code;
					return (
						<DropdownMenuItem
							key={code}
							onSelect={() => i18n.changeLanguage(code)}
							className={cn(
								"flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] focus:bg-panel-elevated md:hover:bg-panel-elevated",
								isActive
									? "bg-panel-elevated/60 font-semibold text-panel-text"
									: "font-medium text-panel-text-secondary",
							)}
						>
							<span className="flex items-center gap-2.5">
								{code === "fa" ? (
									<ImperialIranFlag
										style={{ width: "16px", height: "12px", borderRadius: "2px" }}
									/>
								) : (
									<ReactCountryFlag
										countryCode={flag}
										svg
										style={{ width: "16px", height: "12px", borderRadius: "2px" }}
									/>
								)}
								<span>{label}</span>
							</span>
							{isActive ? (
								<Check className="size-4 text-panel-accent" />
							) : null}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
