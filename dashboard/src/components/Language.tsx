import { useColorModeValue } from "lib/color-mode";
import { Menu, MenuButton, MenuItem, MenuList } from "components/shadcn/menu";
import { IconButton } from "components/shadcn/button";
import { Portal } from "components/shadcn/portal";
import { withClass } from "components/shadcn/icon";
import { cn } from "lib/cn";
import { CheckIcon, LanguageIcon } from "@heroicons/react/24/outline";
import type { FC, MutableRefObject, ReactNode } from "react";
import ReactCountryFlag from "react-country-flag";
import { useTranslation } from "react-i18next";
import { ReactComponent as ImperialIranFlag } from "../assets/imperial-iran-flag.svg";

type HeaderProps = {
	actions?: ReactNode;
	portalContainer?: MutableRefObject<HTMLElement | null>;
	triggerVariant?: "outline" | "ghost";
};

const LangIcon = withClass(LanguageIcon, "w-4 h-4");

const CheckIconChakra = withClass(CheckIcon, "w-4 h-4");

export const Language: FC<HeaderProps> = ({
	portalContainer,
	triggerVariant = "outline",
}) => {
	const { i18n } = useTranslation();
	const menuBg = useColorModeValue("bg-surface-light", "bg-surface-dark");
	const borderColor = useColorModeValue("border-blackAlpha-200!", "border-whiteAlpha-200!");
	const textColor = useColorModeValue("text-gray-800", "text-gray-100");

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
		<MenuList className={cn("min-w-[calc(100vw_-_24px)]! sm:min-w-[200px]! max-w-[calc(100vw_-_16px)] z-[9999]", menuBg, borderColor, textColor)}>
			{items.map(({ code, label, flag }) => (
				<MenuItem key={code} onClick={() => changeLanguage(code)} className="text-[0.875rem] bg-transparent">
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
				</MenuItem>
			))}
		</MenuList>
	);

	return (
		<Menu placement="bottom-end" strategy="fixed" isLazy autoSelect={false} gutter={6}>
			<MenuButton as={IconButton} size="sm" variant={triggerVariant} icon={<LangIcon />} type="button" className="relative" />
			{portalContainer ? (
				<Portal containerRef={portalContainer}>{menuList}</Portal>
			) : (
				<Portal>{menuList}</Portal>
			)}
		</Menu>
	);
};
