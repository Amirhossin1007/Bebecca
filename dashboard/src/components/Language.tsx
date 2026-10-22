import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "components/ui/dropdown-menu";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { withClass } from "lib/withClass";
import { Check, Languages } from "lucide-react";

import { cn } from "lib/cn";
import { Button } from "components/ui/button";
import type { FC, MutableRefObject, ReactNode } from "react";
import ReactCountryFlag from "react-country-flag";
import { useTranslation } from "react-i18next";
import ImperialIranFlag from "../assets/imperial-iran-flag.svg?react";

type HeaderProps = {
	actions?: ReactNode;
	portalContainer?: MutableRefObject<HTMLElement | null>;
	triggerVariant?: "outline" | "ghost";
};

const LangIcon = withClass(Languages, "w-4 h-4");

const CheckIconChakra = withClass(Check, "w-4 h-4");

export const Language: FC<HeaderProps> = ({
	portalContainer,
	triggerVariant = "outline",
}) => {
	const { i18n } = useTranslation();
	const menuBg = "bg-surface-light dark:bg-surface-dark";
	const borderColor = "border-blackAlpha-200! dark:border-whiteAlpha-200!";
	const textColor = "text-gray-800 dark:text-gray-100";

	const changeLanguage = (lang: string) => {
		i18n.changeLanguage(lang);
	};

	const items = [
		{ code: "en", label: "English", flag: "US" },
		{ code: "fa", label: "پارسی", flag: "IR" },
		{ code: "zh-cn", label: "中文", flag: "CN" },
		{ code: "ru", label: "Русский", flag: "RU" },
	];

	const menuList = (
		<DropdownMenuContent className={cn("min-w-[calc(100vw_-_24px)]! sm:min-w-[200px]! max-w-[calc(100vw_-_16px)] z-[9999]", menuBg, borderColor, textColor)}>
			{items.map(({ code, label, flag }) => (
				<DropdownMenuItem key={code} onSelect={() => changeLanguage(code)} className="text-[0.875rem] bg-transparent">
					<div className="flex flex-row items-center gap-2 justify-between w-full">
						<div className="flex flex-row items-center gap-2">
							{code === "fa" ? (
								<ImperialIranFlag style={{ width: "16px", height: "12px" }} />
							) : (
								<ReactCountryFlag
									countryCode={flag}
									svg
									style={{ width: "16px", height: "12px" }}
								/>
							)}
							<p>{label}</p>
						</div>
						{i18n.language === code && <CheckIconChakra />}
					</div>
				</DropdownMenuItem>
			))}
		</DropdownMenuContent>
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" size="sm" variant={triggerVariant} className="relative">
					<LangIcon />
				</Button>
			</DropdownMenuTrigger>
			{portalContainer ? (
				<>{menuList}</>
			) : (
				<>{menuList}</>
			)}
		</DropdownMenu>
	);
};
