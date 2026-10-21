import { XMarkIcon } from "@heroicons/react/24/outline";
import React, {
	type ChangeEvent,
	type ComponentPropsWithoutRef,
	type FocusEvent,
	type MouseEvent,
	type PropsWithChildren,
	type ReactNode,
} from "react";
import { cn } from "lib/cn";
import {
	Input as FieldInput,
	InputGroup,
	InputLeftAddon,
	InputRightAddon,
	InputRightElement,
	NumberDecrementStepper,
	NumberIncrementStepper,
	NumberInput,
	NumberInputField,
	NumberInputStepper,
} from "components/shadcn/input";
import { FormControl, FormErrorMessage, FormLabel } from "components/shadcn/field";
import { withClass } from "components/shadcn/icon";

const ClearIcon = withClass(XMarkIcon, "w-4 h-4");

type FieldSize = "xs" | "sm" | "md" | "lg";

export type InputProps = PropsWithChildren<
	{
		value?: string;
		className?: string;
		endAdornment?: ReactNode;
		startAdornment?: ReactNode;
		type?: string;
		placeholder?: string;
		onChange?: (
			e:
				| ChangeEvent<HTMLInputElement>
				| { target: { value: string; valueAsNumber?: number; name?: string } },
		) => void;
		onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
		onClick?: (e: MouseEvent<HTMLInputElement>) => void;
		name?: string;
		error?: string;
		disabled?: boolean;
		step?: number;
		label?: string;
		clearable?: boolean;
		precision?: number;
		size?: FieldSize;
		isDisabled?: boolean;
		isReadOnly?: boolean;
		isRequired?: boolean;
	} & Omit<ComponentPropsWithoutRef<"input">, "size">
>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	(
		{
			disabled: disabledProp,
			isDisabled,
			isReadOnly,
			isRequired,
			step,
			label,
			className,
			startAdornment,
			endAdornment,
			type = "text",
			placeholder,
			onChange,
			onBlur,
			name,
			value,
			onClick,
			error,
			clearable = false,
			precision = 5,
			size = "md",
			...props
		},
		ref,
	) => {
		const disabled = disabledProp ?? isDisabled;
		const clear = () => {
			if (onChange)
				onChange({
					target: {
						value: "",
						name,
					},
				});
		};
		const isNumber = type === "number";
		const fieldClassName = cn(
			"focus-visible:outline-none focus-visible:border-t-transparent! focus-visible:border-r-transparent! focus-visible:border-b-transparent! disabled:cursor-not-allowed",
			isNumber && "pe-8",
			startAdornment ? "rounded-s-none" : "rounded-md",
			endAdornment ? "rounded-e-none" : "rounded-md",
			className,
		);
		const field = isNumber ? (
			<NumberInput
				size={size}
				value={value}
				defaultValue={props.defaultValue as string | number | undefined}
				min={typeof props.min === "number" ? props.min : props.min !== undefined ? Number(props.min) : 0}
				max={typeof props.max === "number" ? props.max : undefined}
				step={step}
				precision={precision}
				isDisabled={disabled}
				className="flex-grow"
				onChange={(valueAsString: string, valueAsNumber: number) => {
					if (!onChange) return;
					onChange({ target: { value: valueAsString, valueAsNumber, name } });
				}}
			>
				<NumberInputField
					ref={ref}
					name={name}
					placeholder={placeholder}
					onBlur={onBlur}
					onClick={onClick}
					className={fieldClassName}
				/>
				<NumberInputStepper className="opacity-0 pointer-events-none [transition:opacity_0.15s_ease] [[role=group]:hover_&]:opacity-100 [[role=group]:hover_&]:pointer-events-auto [[role=group]:focus-within_&]:opacity-100 [[role=group]:focus-within_&]:pointer-events-auto">
					<NumberIncrementStepper />
					<NumberDecrementStepper />
				</NumberInputStepper>
			</NumberInput>
		) : (
			<FieldInput
				ref={ref}
				name={name}
				step={step}
				type={type}
				placeholder={placeholder}
				onChange={onChange}
				onBlur={onBlur}
				value={value}
				onClick={onClick}
				disabled={disabled}
				readOnly={isReadOnly}
				required={isRequired}
				size={size}
				className={fieldClassName}
				{...props}
			/>
		);
		return (
			<FormControl isInvalid={!!error}>
				{label && <FormLabel>{label}</FormLabel>}
				<InputGroup
					size={size}
					className={cn(
						"w-full rounded-md focus-within:[outline:2px_solid] focus-within:outline-primary-200",
						disabled ? "bg-gray-100" : "bg-transparent",
						disabled ? "dark:bg-gray-600" : "dark:bg-transparent",
					)}
				>
					{startAdornment && <InputLeftAddon>{startAdornment}</InputLeftAddon>}
					{field}
					{endAdornment && (
						<InputRightAddon className="rounded-l-[0] rounded-r-[6px] bg-transparent">
							{endAdornment}
						</InputRightAddon>
					)}
					{clearable && value && value.length && (
						<InputRightElement
							onClick={clear}
							className="rounded-l-[0] rounded-r-[6px] bg-transparent cursor-pointer"
						>
							<ClearIcon />
						</InputRightElement>
					)}
				</InputGroup>
				{!!error && <FormErrorMessage>{error}</FormErrorMessage>}
			</FormControl>
		);
	},
);
