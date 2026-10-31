import logoUrl from "assets/logo.svg";

export const BootScreen = () => (
	<div className="grid min-h-[100dvh] place-items-center bg-panel-main">
		<div className="flex flex-col items-center gap-3">
			<img
				src={logoUrl}
				alt=""
				aria-hidden="true"
				draggable={false}
				className="size-10 animate-pulse [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)]"
			/>
			<span className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-panel-text-muted">
				Rebecca
			</span>
		</div>
	</div>
);
