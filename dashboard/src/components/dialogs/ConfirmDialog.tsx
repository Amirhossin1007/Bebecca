import { AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay } from "components/shadcn/dialog";
import { Button } from "components/shadcn/button";
import { useDisclosure } from "hooks/useDisclosure";
import { withClass } from "components/shadcn/icon";
import { cn } from "lib/cn";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
	cloneElement,
	type MouseEvent,
	type ReactElement,
	type ReactNode,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";

const WarningIcon = withClass(ExclamationTriangleIcon, "w-6 h-6");

export type ConfirmDialogProps = {
	isOpen: boolean;
	title: ReactNode;
	description: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	colorScheme?: string;
	isLoading?: boolean;
	isConfirmDisabled?: boolean;
	onClose: () => void;
	onConfirm: () => void | Promise<void>;
};

export const ConfirmDialog = ({
	isOpen,
	title,
	description,
	confirmLabel,
	cancelLabel,
	colorScheme = "primary",
	isLoading = false,
	isConfirmDisabled = false,
	onClose,
	onConfirm,
}: ConfirmDialogProps) => {
	const { t } = useTranslation();
	const cancelRef = useRef<HTMLButtonElement | null>(null);
	const dialogBg = "bg-surface-light dark:bg-surface-dark";
	const dialogBorder = "border-light-border! dark:border-gray-700!";
	const mutedText = "text-gray-600 dark:text-gray-300";
	const iconBg = `bg-${colorScheme}-50 dark:bg-${colorScheme}-900`;
	const iconColor = `text-${colorScheme}-600 dark:text-${colorScheme}-200`;

	return (
		<AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
			<AlertDialogOverlay className="bg-blackAlpha-500">
				<AlertDialogContent onKeyDown={(event) => {
						if (event.key !== "Enter" || isLoading || isConfirmDisabled) {
							return;
						}
						event.preventDefault();
						void onConfirm();
					}} className={cn("border rounded-2xl shadow-2xl overflow-hidden mx-4 sm:mx-0 w-[calc(100vw_-_32px)] sm:w-auto max-w-[calc(100vw_-_32px)] sm:max-w-[520px] px-4 sm:px-4.5 py-3.5 sm:py-4", dialogBg, dialogBorder, "rb-confirm-dialog-content")}>
					<div className="flex items-start gap-2.5">
						<div className={cn(iconBg, iconColor, "flex items-center justify-center flex-[0_0_auto] w-9 h-9 rounded-full")}>
							<WarningIcon />
						</div>
						<div className="flex-1 min-w-0!">
							<AlertDialogHeader className="p-0 text-[1.125rem] font-extrabold leading-[1.375] mb-0.5">
								{title}
							</AlertDialogHeader>
							<AlertDialogBody className="p-0 mt-1.5">
								{typeof description === "string" ? (
									<p className={cn("text-[0.875rem] leading-[1.45]", mutedText)}>
										{description}
									</p>
								) : (
									description
								)}
							</AlertDialogBody>
						</div>
					</div>
					<AlertDialogFooter className="p-0 pt-1.5 sm:pt-2 gap-1.5 flex-wrap justify-end rb-confirm-dialog-actions">
						<Button variant="solid" ref={cancelRef} onClick={onClose} isDisabled={isLoading} size="sm" className="min-w-[76px]! h-[34px] min-h-[34px] px-3 text-[0.875rem]">
							{cancelLabel ?? t("cancel")}
						</Button>
						<Button colorScheme={colorScheme} onClick={onConfirm} isLoading={isLoading} isDisabled={isConfirmDisabled} size="sm" className="min-w-[76px]! h-[34px] min-h-[34px] px-3 text-[0.875rem]">
							{confirmLabel ?? t("confirm")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialogOverlay>
		</AlertDialog>
	);
};

const stripHtmlTags = (value: string) => value.replace(/<[^>]*>/g, "");

export type DeleteConfirmDialogProps = {
	children: ReactElement;
	description?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	isLoading?: boolean;
	isDisabled?: boolean;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void;
};

export const DeleteConfirmDialog = ({
	children,
	description,
	confirmLabel,
	cancelLabel,
	isLoading,
	isDisabled,
	onConfirm,
	onCancel,
}: DeleteConfirmDialogProps) => {
	const { t } = useTranslation();
	const { isOpen, onClose, onOpen } = useDisclosure();
	const [isConfirming, setIsConfirming] = useState(false);
	const busy = Boolean(isLoading) || isConfirming;
	const confirmMessage =
		typeof description === "string"
			? stripHtmlTags(description)
			: (description ?? t("common.confirmDelete"));

	const handleClose = () => {
		if (busy) return;
		onCancel?.();
		onClose();
	};
	const handleConfirm = async () => {
		setIsConfirming(true);
		try {
			await onConfirm();
			onClose();
		} finally {
			setIsConfirming(false);
		}
	};
	const childProps = children.props as {
		onClick?: (event: MouseEvent<HTMLElement>) => void;
		onClickCapture?: (event: MouseEvent<HTMLElement>) => void;
	};
	const trigger = cloneElement(children, {
		onClickCapture: (event: MouseEvent<HTMLElement>) => {
			childProps.onClickCapture?.(event);
			if (event.defaultPrevented) return;
			event.preventDefault();
			event.stopPropagation();
			if (!isDisabled && !busy) onOpen();
		},
		onClick: (event: MouseEvent<HTMLElement>) => {
			childProps.onClick?.(event);
			event.stopPropagation();
		},
	} as Partial<typeof children.props>);

	return (
		<>
			{trigger}
			<ConfirmDialog
				isOpen={isOpen}
				onClose={handleClose}
				onConfirm={handleConfirm}
				title={t("common.confirmAction")}
				description={confirmMessage}
				confirmLabel={confirmLabel ?? t("delete")}
				cancelLabel={cancelLabel ?? t("cancel")}
				colorScheme="red"
				isLoading={busy}
				isConfirmDisabled={Boolean(isDisabled)}
			/>
		</>
	);
};
