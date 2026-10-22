import type { ReactNode } from "react";
import { cn } from "lib/cn";
import { Label } from "components/ui/label";

type FormFieldProps = {
	/** Omit when the enclosing card's title already names the field. */
	label?: ReactNode;
	htmlFor?: string;
	description?: ReactNode;
	error?: string;
	className?: string;
	children: ReactNode;
};

/** Label, control, hint and error stacked the way every dialog field is laid out. */
export const FormField = ({ label, htmlFor, description, error, className, children }: FormFieldProps) => (
	<div className={cn("flex min-w-0 flex-col gap-2", className)}>
		{label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
		{children}
		{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
		{error ? (
			<p role="alert" className="text-xs text-destructive">
				{error}
			</p>
		) : null}
	</div>
);
