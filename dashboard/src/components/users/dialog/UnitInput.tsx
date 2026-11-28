import { NumberField } from "components/ui/number-field";
import type { FC } from "react";

type UnitInputProps = {
	id?: string;
	value: string;
	onChange: (raw: string) => void;
	unit: string;
	disabled?: boolean;
	invalid?: boolean;
	integer?: boolean;
};

export const UnitInput: FC<UnitInputProps> = ({
	id,
	value,
	onChange,
	unit,
	disabled,
	invalid,
	integer,
}) => (
	<NumberField
		id={id}
		value={value}
		onChange={onChange}
		unit={unit}
		disabled={disabled}
		invalid={invalid}
		inputMode={integer ? "numeric" : "decimal"}
	/>
);
