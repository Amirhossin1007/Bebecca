import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "components/ui/dialog";
import { cn } from "lib/cn";

import type { ComponentProps, ReactNode } from "react";

const SIZE_CLASSES = {
	sm: "sm:max-w-md",
	md: "sm:max-w-lg",
	lg: "sm:max-w-2xl",
	xl: "sm:max-w-3xl",
	"2xl": "sm:max-w-4xl",
	"3xl": "sm:max-w-5xl",
	"4xl": "sm:max-w-6xl",
	full: "max-w-[100vw] h-[100dvh] max-h-[100dvh]",
} as const;

export type AppDialogProps = {
	open: boolean;
	onClose: () => void;
	title: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	size?: keyof typeof SIZE_CLASSES;
	contentProps?: ComponentProps<typeof DialogContent>;
	headerProps?: ComponentProps<typeof DialogHeader>;
	bodyProps?: ComponentProps<"div">;
	footerProps?: ComponentProps<typeof DialogFooter>;
};

export const AppDialog = ({
	open,
	onClose,
	title,
	children,
	footer,
	size = "md",
	contentProps,
	headerProps,
	bodyProps,
	footerProps,
}: AppDialogProps) => (
	<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
		<DialogContent {...contentProps} className={cn(SIZE_CLASSES[size], contentProps?.className)}>
			<DialogHeader {...headerProps}>
				<DialogTitle>{title}</DialogTitle>
			</DialogHeader>
			<div {...bodyProps} className={cn("px-5 py-4 overflow-y-auto", bodyProps?.className)}>
				{children}
			</div>
			{footer != null && <DialogFooter {...footerProps}>{footer}</DialogFooter>}
		</DialogContent>
	</Dialog>
);
