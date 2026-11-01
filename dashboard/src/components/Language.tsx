import { Button } from "components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "components/ui/dropdown-menu";
import { Check, Languages } from "lucide-react";
import type { FC, MutableRefObject, ReactNode } from "react";
import ReactCountryFlag from "react-country-flag";
import { useTranslation } from "react-i18next";
import ImperialIranFlag from "../assets/imperial-iran-flag.svg?react";

type HeaderProps = {
	actions?: ReactNode;
	portalContainer?: MutableRefObject<HTMLElement | null>;
	triggerVariant?: "outline" | "ghost";
};

export const Language: FC<HeaderProps> = ({
	triggerVariant = "outline",
}) => {
	const { i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	const changeLanguage = (lang: string) => {
		i18n.changeLanguage(lang);
	};

	const items = [
		{ code: "en", label: "English", flag: "US" },
		{ code: "fa", label: "پارسی", flag: "IR" },
		{ code: "zh-cn", label: "中文", flag: "CN" },
		{ code: "ru", label: "Русский", flag: "RU" },
	];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					size="sm"
					variant={triggerVariant}
					className="relative h-[34px] w-[34px] p-0 rounded-full md:rounded-[12px] border border-panel-border! bg-panel-surface text-panel-text hover:bg-panel-elevated! cursor-pointer shrink-0"
				>
					<Languages className="w-4 h-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={isRTL ? "start" : "end"}
				className="min-w-[calc(100vw-24px)]! sm:min-w-[200px]! max-w-[calc(100vw-16px)] z-50 rounded-[14px] bg-panel-surface border border-panel-border! text-panel-text p-1 shadow-lg"
			>
				{items.map(({ code, label, flag }) => (
					<DropdownMenuItem
						key={code}
						onSelect={() => changeLanguage(code)}
						className="text-sm rounded-[10px] cursor-pointer hover:bg-panel-elevated! focus:bg-panel-elevated! text-panel-text px-3 py-2"
					>
						<div className="flex flex-row items-center justify-between w-full">
							<div className="flex flex-row items-center gap-2.5">
								{code === "fa" ? (
									<ImperialIranFlag style={{ width: "16px", height: "12px" }} />
								) : (
									<ReactCountryFlag
										countryCode={flag}
										svg
										style={{ width: "16px", height: "12px" }}
									/>
								)}
								<span>{label}</span>
							</div>
							{i18n.language === code && <Check className="w-4 h-4 text-panel-accent" />}
						</div>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
