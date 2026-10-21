import { Menu, MenuButton, MenuItem, MenuList } from "components/shadcn/menu";
import { Tag, TagCloseButton, TagLabel } from "components/shadcn/badge";
import { Input } from "components/shadcn/input";
import { Portal } from "components/shadcn/portal";
import { Button } from "components/shadcn/button";
import { withClass } from "components/shadcn/icon";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";
import {
	CheckIcon,
	ChevronDownIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import {
	type ChangeEvent,
	Fragment,
	forwardRef,
	isValidElement,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_SEARCH_MATCH_OPTIONS, matchesSearch } from "utils/searchMatch";
import { AppleEmojiText } from "./AppleEmojiText";
import { SearchInput } from "./SearchInput";

const Check = withClass(CheckIcon, "w-4 h-4");
const ChevronDown = withClass(ChevronDownIcon, "w-4 h-4");
const X = withClass(XMarkIcon, "w-3.5 h-3.5");

export type PanelSelectOption =
	| string
	| {
			disabled?: boolean;
			label?: ReactNode;
			searchLabel?: string;
			title?: string;
			value: string;
	  };

type NormalizedOption = {
	disabled: boolean;
	label: ReactNode;
	searchLabel: string;
	title: string;
	value: string;
};

export type PanelSelectProps = Omit<
	ComponentPropsWithoutRef<"div">,
	"children" | "defaultValue" | "onChange" | "size" | "value"
> & {
	allowCustom?: boolean;
	children?: ReactNode;
	closeOnSelect?: boolean;
	defaultValue?: string;
	disabled?: boolean;
	emptyText?: string;
	id?: string;
	isInvalid?: boolean;
	mode?: "single" | "multiple";
	name?: string;
	onBlur?: (event: {
		target: { name?: string; value?: string };
		type?: string;
	}) => void;
	onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
	onValueChange?: (value: string | string[]) => void;
	options?: PanelSelectOption[];
	placeholder?: string;
	portalled?: boolean;
	rightElement?: ReactNode;
	searchPlaceholder?: string;
	showSearch?: boolean;
	size?: "sm" | "md";
	value?: string | number | string[];
};

export const splitPanelSelectText = (value: string) =>
	value
		.split(/\r?\n|[,;]/)
		.map((item) => item.trim())
		.filter(Boolean);

const normalizeOption = (option: PanelSelectOption): NormalizedOption => {
	if (typeof option === "string") {
		return {
			disabled: false,
			label: option,
			searchLabel: option,
			title: option,
			value: option,
		};
	}
	const label =
		option.label === undefined || option.label === null
			? option.value
			: option.label;
	const searchLabel =
		option.searchLabel ??
		option.title ??
		(typeof label === "string" ? label : option.value);
	return {
		disabled: Boolean(option.disabled),
		label,
		searchLabel,
		title: option.title ?? searchLabel,
		value: option.value,
	};
};

const optionText = (node: ReactNode): string => {
	if (node === null || node === undefined || typeof node === "boolean")
		return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(optionText).join("");
	if (isValidElement<{ children?: ReactNode }>(node)) {
		return optionText(node.props.children);
	}
	return "";
};

const renderLabel = (label: ReactNode) =>
	typeof label === "string" ? <AppleEmojiText>{label}</AppleEmojiText> : label;

const collectOptionsFromChildren = (children: ReactNode) => {
	const options: NormalizedOption[] = [];
	const collect = (node: ReactNode) => {
		if (Array.isArray(node)) {
			node.forEach(collect);
			return;
		}
		if (!isValidElement(node)) return;
		if (node.type === Fragment) {
			collect((node.props as { children?: ReactNode }).children);
			return;
		}
		if (typeof node.type !== "string" || node.type.toLowerCase() !== "option") {
			return;
		}
		const props = node.props as {
			children?: ReactNode;
			disabled?: boolean;
			value?: string | number;
		};
		const label = optionText(props.children);
		const value = props.value === undefined ? label : String(props.value);
		options.push({
			disabled: Boolean(props.disabled),
			label,
			searchLabel: label || value,
			title: label || value,
			value,
		});
	};
	collect(children);
	return options;
};

const dedupeOptions = (options: NormalizedOption[]) => {
	const seen = new Set<string>();
	const result: NormalizedOption[] = [];
	for (const option of options) {
		const key = option.value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(option);
	}
	return result;
};

const dedupeValues = (values: string[]) => {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(value);
	}
	return result;
};

const emitSelectChange = (
	onChange: PanelSelectProps["onChange"],
	name: string | undefined,
	value: string,
) => {
	onChange?.({
		target: { name, value },
		currentTarget: { name, value },
	} as unknown as ChangeEvent<HTMLSelectElement>);
};

export const PanelSelect = forwardRef<HTMLInputElement, PanelSelectProps>(
	(
		{
			allowCustom = false,
			children,
			closeOnSelect,
			defaultValue,
			disabled,
			emptyText,
			id,
			disabled: isDisabled,
			isInvalid = false,
			mode = "single",
			name,
			onBlur,
			onChange,
			onValueChange,
			options = [],
			placeholder,
			portalled = true,
			rightElement,
			searchPlaceholder,
			showSearch = true,
			size = "sm",
			value,
			className,
			...boxProps
		},
		ref,
	) => {
		const { t, i18n } = useTranslation();
		const direction = i18n.dir(i18n.language);
		const isRTL = direction === "rtl";
		const removeLabel = t("remove");
		const inputId = useId();
		const [search, setSearch] = useState("");
		const [searchMatch, setSearchMatch] = useState(
			DEFAULT_SEARCH_MATCH_OPTIONS,
		);
		const [customInput, setCustomInput] = useState("");
		const [multiOpen, setMultiOpen] = useState(false);
		const multiContainerRef = useRef<HTMLDivElement | null>(null);
		const nestedMenuScrollRef = useRef<{ left: number; top: number } | null>(
			null,
		);
		const [multiMenuRect, setMultiMenuRect] = useState<{
			left: number;
			top?: number;
			bottom?: number;
			width: number;
		} | null>(null);
		const normalizedOptions = useMemo(
			() =>
				dedupeOptions([
					...collectOptionsFromChildren(children),
					...options.map(normalizeOption),
				]).filter((option) => option.value || optionText(option.label).trim()),
			[children, options],
		);
		const selectedValues = useMemo(() => {
			if (Array.isArray(value)) return dedupeValues(value);
			if (typeof value === "number") {
				const numericValue = String(value);
				return mode === "multiple"
					? splitPanelSelectText(numericValue)
					: [numericValue];
			}
			if (typeof value === "string") {
				if (mode === "multiple") return splitPanelSelectText(value);
				return value || normalizedOptions.some((option) => option.value === "")
					? [value]
					: [];
			}
			if (defaultValue !== undefined) {
				const fallbackValue = String(defaultValue);
				return mode === "multiple"
					? splitPanelSelectText(fallbackValue)
					: [fallbackValue];
			}
			return [];
		}, [defaultValue, mode, normalizedOptions, value]);
		const selectedSet = useMemo(
			() => new Set(selectedValues.map((item) => item.toLowerCase())),
			[selectedValues],
		);
		const optionByValue = useMemo(() => {
			const map = new Map<string, NormalizedOption>();
			for (const option of normalizedOptions) {
				map.set(option.value.toLowerCase(), option);
			}
			return map;
		}, [normalizedOptions]);
		const mergedOptions = useMemo(
			() =>
				dedupeOptions([
					...normalizedOptions,
					...selectedValues.map(
						(item) =>
							optionByValue.get(item.toLowerCase()) ?? normalizeOption(item),
					),
				]),
			[normalizedOptions, optionByValue, selectedValues],
		);
		const filteredOptions = useMemo(() => {
			if (!search.trim()) return mergedOptions;
			return mergedOptions.filter((option) =>
				matchesSearch(
					`${option.searchLabel} ${option.value}`,
					search,
					searchMatch,
				),
			);
		}, [mergedOptions, search, searchMatch]);
		const customTerm = customInput.trim();
		const canCreateCustom =
			allowCustom &&
			Boolean(customTerm) &&
			!mergedOptions.some(
				(option) => option.value.toLowerCase() === customTerm.toLowerCase(),
			);
		const selectedLabels = selectedValues.map(
			(item) => optionByValue.get(item.toLowerCase())?.label ?? item,
		);
		const buttonText = selectedLabels[0] || placeholder || "";

		const borderColor = "border-blackAlpha-200! dark:border-whiteAlpha-200!";
		const focusBorderColor = "focus-within:border-primary-500! dark:focus-within:border-primary-300!";
		const focusRing = "focus-within:[box-shadow:0_0_0_1px_var(--primary-500)] dark:focus-within:[box-shadow:0_0_0_1px_var(--primary-300)]";
		const hoverBorder = "hover:border-primary-500! dark:hover:border-primary-300!";
		const controlBg = "bg-white dark:bg-whiteAlpha-50";
		const menuBg = "bg-white dark:bg-surface-dark";
		const hoverBg = "hover:bg-blackAlpha-50 dark:hover:bg-whiteAlpha-100";
		const selectedBg = "bg-primary-50 dark:bg-whiteAlpha-100";
		const tagBg = "bg-primary-50 dark:bg-whiteAlpha-100";
		const tagColor = "text-primary-700 dark:text-primary-200";
		const mutedColor = "text-gray-500 dark:text-gray-400";
		const invalidBorderColor = "border-red-500! dark:border-red-300!";
		const controlHeight = size === "md" ? "min-h-[40px]" : "min-h-[36px]";
		const disabledState = isDisabled || Boolean(disabled);
		const resolvedBorderColor = isInvalid ? invalidBorderColor : borderColor;

		useEffect(() => {
			if (!multiOpen) return;
			const updateMultiMenuRect = () => {
				const rect = multiContainerRef.current?.getBoundingClientRect();
				if (!rect) return;
				const menuHeight = 240;
				const gap = 6;
				const spaceBelow = window.innerHeight - rect.bottom;
				const opensUp = spaceBelow < menuHeight + gap && rect.top > spaceBelow;
				setMultiMenuRect({
					left: rect.left,
					width: rect.width,
					...(opensUp
						? { bottom: window.innerHeight - rect.top + gap }
						: { top: rect.bottom + gap }),
				});
			};
			updateMultiMenuRect();
			window.addEventListener("resize", updateMultiMenuRect);
			window.addEventListener("scroll", updateMultiMenuRect, true);
			return () => {
				window.removeEventListener("resize", updateMultiMenuRect);
				window.removeEventListener("scroll", updateMultiMenuRect, true);
			};
		}, [multiOpen]);

		const emitValue = (nextValue: string | string[]) => {
			onValueChange?.(nextValue);
			emitSelectChange(
				onChange,
				name,
				Array.isArray(nextValue)
					? dedupeValues(nextValue).join(", ")
					: nextValue,
			);
		};
		const emitBlur = () => {
			onBlur?.({
				target: { name, value: selectedValues[0] ?? "" },
				type: "blur",
			});
		};

		const updateMultipleValues = (nextValues: string[]) => {
			emitValue(dedupeValues(nextValues));
		};

		const toggleValue = (option: NormalizedOption) => {
			if (option.disabled) return;
			if (mode === "single") {
				emitValue(option.value);
				emitBlur();
				return;
			}
			if (selectedSet.has(option.value.toLowerCase())) {
				updateMultipleValues(
					selectedValues.filter(
						(item) => item.toLowerCase() !== option.value.toLowerCase(),
					),
				);
			} else {
				updateMultipleValues([...selectedValues, option.value]);
			}
			setCustomInput("");
			setSearch("");
		};

		const removeValue = (option: string) => {
			updateMultipleValues(
				selectedValues.filter(
					(item) => item.toLowerCase() !== option.toLowerCase(),
				),
			);
		};

		const commitCustomInput = (rawValue = customInput) => {
			if (!allowCustom) return;
			const tokens = splitPanelSelectText(rawValue);
			if (!tokens.length) {
				setCustomInput("");
				return;
			}
			if (mode === "single") {
				emitValue(tokens[0]);
			} else {
				updateMultipleValues([...selectedValues, ...tokens]);
			}
			setCustomInput("");
			setSearch("");
			setMultiOpen(true);
		};

		const handleCustomInputChange = (nextValue: string) => {
			if (/[,;\n]/.test(nextValue)) {
				commitCustomInput(nextValue);
				return;
			}
			setCustomInput(nextValue);
			setSearch(nextValue);
			setMultiOpen(true);
		};

		const handleCustomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				event.preventDefault();
				const suggestedOption = filteredOptions.find(
					(option) =>
						!option.disabled && !selectedSet.has(option.value.toLowerCase()),
				);
				if (customInput.trim() && suggestedOption) {
					toggleValue(suggestedOption);
				} else {
					commitCustomInput();
				}
				return;
			}
			if (event.key === "Backspace" && !customInput && selectedValues.length) {
				event.preventDefault();
				removeValue(selectedValues[selectedValues.length - 1]);
			}
		};

		const renderOptionRow = (
			key: string,
			content: ReactNode,
			onSelect: () => void,
			opts: {
				disabled?: boolean;
				selected?: boolean;
			} = {},
		) => {
			const selected = Boolean(opts.selected);
			const rowClass = cn("rounded-md text-sm min-h-[30px] px-2 py-1", selected ? selectedBg : "bg-transparent", opts.disabled ? "opacity-55" : "opacity-100", selected ? "hover:bg-primary-50 dark:hover:bg-whiteAlpha-100" : hoverBg);

			if (mode === "single") {
				return (
					<MenuItem key={key} className={rowClass} disabled={opts.disabled} onClick={() => {
							if (!opts.disabled) onSelect();
						}}>
						{content}
					</MenuItem>
				);
			}

			return (
				<button key={key} type="button" disabled={opts.disabled} onClick={(event: MouseEvent<HTMLElement>) => {
						event.preventDefault();
						event.stopPropagation();
						if (!opts.disabled) onSelect();
					}} className={cn(rowClass, "w-full block text-start", opts.disabled ? "cursor-not-allowed" : "cursor-pointer")}>
					{content}
				</button>
			);
		};

		const optionList = (
			<>
				{canCreateCustom &&
					renderOptionRow(
						`custom-${customTerm}`,
						<span className="truncate">
							<AppleEmojiText>{`${t("add")} "${customTerm}"`}</AppleEmojiText>
						</span>,
						() => commitCustomInput(customTerm),
					)}
				{filteredOptions.length === 0 && !canCreateCustom ? (
					<div className="px-2 py-2">
						<p className={cn("text-[0.875rem]", mutedColor)}>
							{emptyText ?? t("hostsDialog.noAutocompleteOptions")}
						</p>
					</div>
				) : (
					filteredOptions.map((option) => {
						const selected = selectedSet.has(option.value.toLowerCase());
						return renderOptionRow(
							option.value || option.searchLabel,
							<>
								<div className="flex flex-row items-center w-full justify-between gap-2">
									<div className="flex flex-row items-center min-w-0! gap-2">
										<p title={option.title} className="truncate">
											{renderLabel(option.label)}
										</p>
									</div>
									{selected && mode === "single" && (
										<div className="text-primary-500 shrink-0">
											<Check />
										</div>
									)}
									{selected && mode === "multiple" && (
										<button type="button" aria-label={`${removeLabel} ${option.title}`} onClick={(event: MouseEvent<HTMLButtonElement>) => {
												event.preventDefault();
												event.stopPropagation();
												removeValue(option.value);
											}} className="rounded-full text-red-500 p-0.5 hover:bg-red-50 dark:hover:bg-whiteAlpha-100">
											<X />
										</button>
									)}
								</div>
							</>,
							() => toggleValue(option),
							{ disabled: option.disabled, selected },
						);
					})
				)}
			</>
		);

		if (mode === "multiple") {
			return (
				// biome-ignore lint/a11y/noStaticElementInteractions: closes the menu when focus leaves the control; the inputs keep focus
				<div ref={multiContainerRef} onBlur={(event) => {
						if (
							!event.currentTarget.contains(event.relatedTarget as Node | null)
						) {
							commitCustomInput();
							setMultiOpen(false);
							emitBlur();
						}
					}} {...boxProps} className={cn("relative", className)}>
					<input
						ref={ref}
						type="hidden"
						id={id}
						name={name}
						value={selectedValues.join(", ")}
						readOnly
					/>
					{/* biome-ignore lint/a11y/noStaticElementInteractions: stops mousedown so the field keeps focus while the menu is used */}
					<div onMouseDown={(event) => {
							if (disabledState) return;
							const target = event.target as HTMLElement | null;
							if (target?.closest("button")) return;
							event.preventDefault();
							const input = event.currentTarget.querySelector("input");
							input?.focus();
							setMultiOpen(true);
						}} className={cn(resolvedBorderColor, controlBg, focusBorderColor, focusRing, "border rounded-md px-1.5 py-1 [transition:border-color_0.15s_ease,_box-shadow_0.15s_ease,_background_0.15s_ease]", controlHeight, isRTL ? (rightElement ? "pl-10" : "pl-2") : "", isRTL ? "" : (rightElement ? "pr-10" : "pr-2"), disabledState ? "cursor-not-allowed" : "cursor-text", disabledState ? "opacity-60" : "opacity-100")}>
						<div className="flex flex-wrap gap-1.5 items-center">
							{selectedValues.map((item) => (
								<div key={item}>
									<Tag size="sm" className={cn("min-h-[22px] rounded-full", tagBg, tagColor)}>
										<TagLabel className="max-w-[150px] truncate text-[0.75rem]">
											{renderLabel(
												optionByValue.get(item.toLowerCase())?.label ?? item,
											)}
										</TagLabel>
										<TagCloseButton aria-label={`${removeLabel} ${item}`} onMouseDown={(event) => event.preventDefault()} onClick={() => removeValue(item)} />
									</Tag>
								</div>
							))}
							<div className="flex-1 min-w-[140px]!">
								<Input variant="unstyled" size="sm" value={customInput} placeholder={
										selectedValues.length
											? t("hostsDialog.addAnotherValue")
											: placeholder
									} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-lpignore="true" data-1p-ignore="true" data-form-type="other" onFocus={() => setMultiOpen(true)} onChange={(event) =>
										handleCustomInputChange(event.target.value)
									} onKeyDown={handleCustomKeyDown} disabled={disabledState} className="h-[24px] text-[0.875rem] bg-transparent! border-0! rounded-[0px]! [outline:0]! shadow-none! min-h-[24px]! px-0! py-0! focus:shadow-none! focus-visible:shadow-none!" />
							</div>
						</div>
						{rightElement && (
							<div className={cn("absolute top-[7px] z-[1]", isRTL ? "left-[8px]" : "", isRTL ? "" : "right-[8px]")}>
								{rightElement}
							</div>
						)}
					</div>
					{multiOpen && !disabledState && multiMenuRect && (
						<Portal>
							{/* biome-ignore lint/a11y/noStaticElementInteractions: menu surface: stops mousedown so the field keeps focus; the options carry the interaction */}
							<div dir={direction} style={{ left: `${multiMenuRect.left}px`, top: multiMenuRect.top === undefined ? undefined : `${multiMenuRect.top}px`, bottom: multiMenuRect.bottom === undefined ? undefined : `${multiMenuRect.bottom}px`, width: `${multiMenuRect.width}px` }} onMouseDown={(event) => event.preventDefault()} className={cn("[scrollbar-width:none] [ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", cn("fixed z-[16060] border rounded-md shadow-xl max-h-[240px] overflow-y-auto p-1", menuBg))}>
								{optionList}
							</div>
						</Portal>
					)}
				</div>
			);
		}

		const singleMenuList = (
			<MenuList dir={direction} className={cn(borderColor, "[scrollbar-width:none] [ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", cn("min-w-[100%]! max-w-[min(420px,_calc(100vw_-_24px))] max-h-[260px] overflow-y-auto p-1 rounded-md shadow-xl z-[16050]", menuBg))}>
				{showSearch && (
					<SearchInput id={`${inputId}-search`} name={`${inputId}-search-${mode}`} size="sm" containerProps={{ className: "mb-1" }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder ?? t("search")} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} role="combobox" aria-autocomplete="list" data-lpignore="true" data-1p-ignore="true" data-form-type="other" inputMode="text" list={`${inputId}-empty-list`} autoFocus matchOptions={searchMatch} onMatchOptionsChange={setSearchMatch} className="h-[30px] text-[0.875rem] bg-transparent" />
				)}
				<datalist id={`${inputId}-empty-list`} />
				{optionList}
			</MenuList>
		);

		return (
			<div {...boxProps} className={cn("relative", className)}>
				<input
					ref={ref}
					type="hidden"
					id={id}
					name={name}
					value={selectedValues[0] ?? ""}
					readOnly
				/>
				<Menu autoSelect={false} closeOnSelect={closeOnSelect ?? true} open={disabledState ? false : undefined} isLazy matchWidth placement={isRTL ? "bottom-end" : "bottom-start"} strategy="fixed" onOpen={() => {
						if (!portalled) {
							nestedMenuScrollRef.current = {
								left: window.scrollX,
								top: window.scrollY,
							};
						}
					}} onClose={() => {
						setSearch("");
						emitBlur();
						const scroll = nestedMenuScrollRef.current;
						nestedMenuScrollRef.current = null;
						if (scroll) {
							requestAnimationFrame(() =>
								window.scrollTo(scroll.left, scroll.top),
							);
						}
					}}>
					<MenuButton as={Button} size={size} disabled={disabledState} variant="outline" className={cn(controlBg, resolvedBorderColor, focusBorderColor, focusRing, hoverBorder, "w-full rounded-md justify-between text-start", rightElement ? "pr-16" : "", controlHeight, selectedValues.length ? "font-medium" : "font-normal")}>
						<span className={cn("truncate", selectedValues.length ? "" : (mutedColor))}>
							{renderLabel(buttonText)}
						</span>
					{<ChevronDown />}</MenuButton>
					{portalled ? <Portal>{singleMenuList}</Portal> : singleMenuList}
				</Menu>
				{rightElement && (
					<div className={cn("absolute top-[50%] [transform:translateY(-50%)] z-[1]", isRTL ? "left-[8px]" : "", isRTL ? "" : "right-[36px]")}>
						{rightElement}
					</div>
				)}
			</div>
		);
	},
);
