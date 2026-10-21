import { NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper } from "components/shadcn/input";
import type { ComponentProps, ComponentPropsWithoutRef, Ref } from "react";

type NumericInputProps = Omit<ComponentProps<typeof NumberInput>, "onChange"> & {
	fieldProps?: ComponentPropsWithoutRef<typeof NumberInputField>;
	fieldRef?: Ref<HTMLInputElement>;
	onChange?: (valueAsString: string, valueAsNumber: number) => void;
};

export const NumericInput = ({
	fieldProps = {},
	fieldRef,
	min = 0,
	step = 1,
	defaultValue = 0,
	...props
}: NumericInputProps) => {
	const { style: fieldStyle, ...restFieldProps } = fieldProps;

	return (
		<NumberInput min={min} step={step} defaultValue={props.value === undefined ? defaultValue : undefined} {...props}>
			<NumberInputField ref={fieldRef} inputMode="decimal" {...restFieldProps} style={{ paddingRight: "2rem", ...fieldStyle }} />
			<NumberInputStepper className="opacity-0 pointer-events-none [transition:opacity_0.15s_ease] [[role=group]:hover_&]:opacity-100 [[role=group]:hover_&]:pointer-events-auto [[role=group]:focus-within_&]:opacity-100 [[role=group]:focus-within_&]:pointer-events-auto rb-number-stepper [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto">
				<NumberIncrementStepper />
				<NumberDecrementStepper />
			</NumberInputStepper>
		</NumberInput>
	);
};
