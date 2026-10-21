import { Input, InputGroup, InputLeftElement, InputRightElement } from "components/shadcn/input";
import { Spinner } from "components/shadcn/feedback";
import { Tooltip } from "components/shadcn/tooltip";
import { IconButton } from "components/shadcn/button";
import { withClass } from "components/shadcn/icon";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SearchMatchOptions } from "utils/searchMatch";

const SearchIcon = withClass(MagnifyingGlassIcon, "w-4 h-4");
const ClearIcon = withClass(XMarkIcon, "w-3.5 h-3.5");

type SearchInputProps = Omit<ComponentPropsWithoutRef<"input">, "size"> & {
	size?: "xs" | "sm" | "md" | "lg";
	containerProps?: ComponentPropsWithoutRef<"div">;
	isLoading?: boolean;
	matchOptions: SearchMatchOptions;
	onClear?: () => void;
	onMatchOptionsChange: (options: SearchMatchOptions) => void;
	rightElement?: ReactNode;
};

export const SearchInput: FC<SearchInputProps> = ({
	containerProps,
	isLoading = false,
	matchOptions,
	onClear,
	onMatchOptionsChange,
	rightElement,
	size = "sm",
	value,
	...inputProps
}) => {
	const { t } = useTranslation();
	const toggle = (key: keyof SearchMatchOptions) =>
		onMatchOptionsChange({ ...matchOptions, [key]: !matchOptions[key] });

	return (
		<InputGroup size={size} {...containerProps}>
			<InputLeftElement className="pointer-events-none h-full">
				<SearchIcon className="text-panel-text-muted" />
			</InputLeftElement>
			<Input value={value} {...inputProps} className="pe-[116px]" />
			<InputRightElement className="w-auto pe-1 h-full">
				<div className="flex flex-row items-center gap-0.5">
					{isLoading && <Spinner size="xs" className="text-panel-text-muted" />}
					<Tooltip label={t("search.matchCase")} hasArrow>
						<IconButton aria-label={t("search.matchCase")} aria-pressed={matchOptions.matchCase} icon={<p className="text-[0.75rem]">Aa</p>} onClick={() => toggle("matchCase")} type="button" size="xs" variant="ghost" className={cn(matchOptions.matchCase ? "text-primary-400" : "text-panel-text-muted", matchOptions.matchCase ? "bg-panel-hover" : "bg-transparent")} />
					</Tooltip>
					<Tooltip label={t("search.matchWholeWord")} hasArrow>
						<IconButton aria-label={t("search.matchWholeWord")} aria-pressed={matchOptions.matchWholeWord} icon={
								<p className="text-[0.75rem] underline">
									ab
								</p>
							} onClick={() => toggle("matchWholeWord")} type="button" size="xs" variant="ghost" className={cn(matchOptions.matchWholeWord ? "text-primary-400" : "text-panel-text-muted", matchOptions.matchWholeWord ? "bg-panel-hover" : "bg-transparent")} />
					</Tooltip>
					{rightElement}
					{onClear && String(value ?? "").length > 0 && (
						<IconButton aria-label={t("clear")} icon={<ClearIcon />} onClick={onClear} type="button" size="xs" variant="ghost" />
					)}
				</div>
			</InputRightElement>
		</InputGroup>
	);
};
