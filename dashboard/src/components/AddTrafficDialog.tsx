import { Button } from "components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { Database, X } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";

const GB_IN_BYTES = 1024 * 1024 * 1024;

export const TRAFFIC_PRESETS_GB = [100, 512, 1024, 2048, 5120] as const;

const PRESET_LABELS: Record<(typeof TRAFFIC_PRESETS_GB)[number], string> = {
	100: "100 GB",
	512: "512 GB",
	1024: "1 TB",
	2048: "2 TB",
	5120: "5 TB",
};

export type TrafficTarget = { kind: "user" | "admin"; name: string };

type AddTrafficDialogProps = {
	target: TrafficTarget | null;
	onClose: () => void;
	onApply: (deltaBytes: number) => Promise<void>;
};

export const AddTrafficDialog: FC<AddTrafficDialogProps> = ({
	target,
	onClose,
	onApply,
}) => {
	const { t } = useTranslation();
	const [view, setView] = useState<"presets" | "custom">("presets");
	const [amountGb, setAmountGb] = useState("");
	const [busy, setBusy] = useState(false);

	const finish = () => {
		setView("presets");
		setAmountGb("");
		onClose();
	};

	const apply = async (deltaBytes: number) => {
		if (!(deltaBytes > 0) || busy) return;
		setBusy(true);
		try {
			await onApply(deltaBytes);
			finish();
		} catch {
		} finally {
			setBusy(false);
		}
	};

	if (!target) return null;

	return (
		<Dialog
			open={target !== null}
			onOpenChange={(open) => {
				if (!open && !busy) finish();
			}}
		>
			<DialogContent className="max-w-sm overflow-hidden rounded-[20px] border border-panel-border bg-panel-card p-0 shadow-2xl z-[1500]">
				<DialogHeader className="flex flex-row items-center justify-between border-b border-panel-border px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-xl bg-panel-accent/10 text-panel-accent">
							<Database className="size-4" />
						</div>
						<div>
							<DialogTitle className="text-sm font-bold text-panel-text">
								{t("services.userActions.traffic.add", "Add Traffic")}
							</DialogTitle>
							<p
								dir="ltr"
								className="text-[11px] font-mono text-panel-text-secondary text-start"
							>
								{target.name}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={finish}
						className="flex size-8 items-center justify-center rounded-xl border border-panel-border/70 text-panel-text-secondary transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text cursor-pointer active:scale-95"
					>
						<X className="size-4" />
					</button>
				</DialogHeader>

				<div className="px-6 py-5">
					{view === "presets" ? (
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
							{TRAFFIC_PRESETS_GB.map((gb) => (
								<button
									key={gb}
									type="button"
									disabled={busy}
									onClick={() => void apply(gb * GB_IN_BYTES)}
									className="rounded-xl border border-panel-border bg-panel-surface py-2.5 text-xs font-semibold text-panel-text transition-all min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent active:scale-95 cursor-pointer disabled:opacity-40"
								>
									{PRESET_LABELS[gb]}
								</button>
							))}
							<button
								type="button"
								disabled={busy}
								onClick={() => setView("custom")}
								className="rounded-xl border border-dashed border-panel-border bg-panel-surface/60 py-2.5 text-xs font-medium text-panel-text-secondary transition-all min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent active:scale-95 cursor-pointer"
							>
								{t("addTraffic.custom", "Custom")}
							</button>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<div className="relative flex items-center">
								<Input
									type="number"
									step="1"
									min={1}
									dir="ltr"
									value={amountGb}
									onChange={(e) => setAmountGb(e.target.value)}
									placeholder="e.g. 50"
									className="h-10 rounded-xl border border-panel-border bg-panel-surface text-sm text-panel-text pe-12"
								/>
								<span className="absolute end-3 text-xs font-semibold text-panel-text-muted pointer-events-none select-none">
									GB
								</span>
							</div>
						</div>
					)}
				</div>

				<div className="flex items-center justify-between border-t border-panel-border px-6 py-3.5 bg-panel-surface/60">
					{view === "custom" ? (
						<>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setView("presets")}
								disabled={busy}
								className="h-9 rounded-xl border-panel-border bg-panel-surface text-xs font-medium"
							>
								{t("addTraffic.back", "Back")}
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={busy || !(Number(amountGb) > 0)}
								onClick={() =>
									void apply(Math.round(Number(amountGb) * GB_IN_BYTES))
								}
								className="h-9 rounded-xl bg-panel-accent text-xs font-semibold text-white shadow-xs"
							>
								{t("add", "Add")}
							</Button>
						</>
					) : (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={finish}
							disabled={busy}
							className="ms-auto h-9 rounded-xl border-panel-border bg-panel-surface text-xs font-medium"
						>
							{t("cancel")}
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
