import { cn } from "lib/cn";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHref, useSearchParams } from "react-router-dom";
import { getTutorialsUrl } from "utils/tutorials";

export const TutorialsPage = () => {
	const { t, i18n } = useTranslation();
	const dashboardRoot = useHref("/");
	const [searchParams] = useSearchParams();
	const [isLoaded, setIsLoaded] = useState(false);
	const borderColor = "border-panel-border!";
	const frameBg = "bg-panel-surface";
	const frameSrc = getTutorialsUrl(
		dashboardRoot,
		i18n.language,
		searchParams.get("doc") || "",
	);
	return (
		<div className={cn("border rounded-md overflow-hidden relative h-[calc(100dvh_-_172px)] md:h-[calc(100dvh_-_96px)] min-h-[420px] md:min-h-[560px]", borderColor, frameBg)}>
			{!isLoaded ? (
				<div className={cn("flex items-center justify-center absolute inset-0", frameBg)}>
					<p className="text-panel-text-muted">{t("loading")}...</p>
				</div>
			) : null}
			<iframe title={t("tutorials.menu")} src={frameSrc} onLoad={() => setIsLoaded(true)} className={cn("w-full h-full border-0", frameBg, isLoaded ? "opacity-100" : "opacity-0")} />
		</div>
	);
};
