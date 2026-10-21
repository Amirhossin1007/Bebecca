import {
	type ElementType,
	createContext,
	useContext,
	useId,
	type ComponentPropsWithoutRef,
} from "react";
import { cn } from "lib/cn";

type FieldContextValue = {
	id: string;
	isInvalid?: boolean;
	required?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/** The surrounding FormControl, if any. Inputs use it for id, required and invalid state. */
export function useFormControl(): FieldContextValue | null {
	return useContext(FieldContext);
}

/** Chakra's FormControl. It hands its id and state to the label and the input inside. */
export function FormControl({
	as: Tag = "div",
	id,
	isInvalid,
	required: isRequired,
	disabled: isDisabled,
	readOnly: isReadOnly,
	className,
	children,
	...props
}: ComponentPropsWithoutRef<"div"> & {
	as?: ElementType;
	id?: string;
	isInvalid?: boolean;
	required?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
}) {
	const generated = useId();
	const fieldId = id ?? `field-${generated.replace(/:/g, "")}`;
	return (
		<FieldContext.Provider
			value={{ id: fieldId, isInvalid, required: isRequired, disabled: isDisabled, readOnly: isReadOnly }}
		>
			<Tag role="group" className={cn("relative w-full", className)} {...props}>
				{children}
			</Tag>
		</FieldContext.Provider>
	);
}

/** Chakra's FormLabel: fontSize sm, medium weight, a small gap below, and a red asterisk when required. */
export function FormLabel({
	as: Tag = "label",
	htmlFor,
	className,
	children,
	...props
}: ComponentPropsWithoutRef<"label"> & { as?: ElementType }) {
	const field = useFormControl();
	return (
		<Tag
			htmlFor={htmlFor ?? field?.id}
			className={cn(
				"mb-1 block text-sm font-medium dark:text-panel-text-secondary",
				field?.required &&
					"after:ms-1 after:text-red-500 after:content-['*']",
				className,
			)}
			{...props}
		>
			{children}
		</Tag>
	);
}

/** Chakra's FormHelperText: small and muted, under the field. */
export function FormHelperText({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return <div className={cn("mt-1 text-xs text-panel-text-muted", className)} {...props} />;
}

/** Chakra's FormErrorMessage: only rendered while the field is invalid. */
export function FormErrorMessage({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	const field = useFormControl();
	if (!field?.isInvalid) return null;
	return (
		<div
			role="alert"
			className={cn("mt-1 flex items-center gap-1 text-sm text-red-500", className)}
			{...props}
		/>
	);
}
