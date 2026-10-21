import { Alert, AlertIcon } from "components/shadcn/alert";
import { Tag } from "components/shadcn/badge";
import { CloseButton } from "components/shadcn/button";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useAPIRequestErrors } from "service/http";
import { requestErrorHref } from "utils/diagnostics";

export const RequestErrors = () => {
	const location = useLocation();
	const { errors, clear } = useAPIRequestErrors();
	const { t } = useTranslation();
	if (!errors.length) return null;
	return (
		<div role="alert" aria-live="polite" className="flex flex-col gap-2 mb-4">
			{errors.map((item) => (
				<div key={item.key} className="relative">
					<Alert as={Link} to={
							item.href ||
							requestErrorHref(
								item.key,
								location.pathname.replace(/\/$/, "").endsWith("/xray-settings")
									? location.search
									: "",
							)
						} role="link" aria-label={`${t("diagnostics.requestFailed")}: ${item.message}`} status="error" className="rounded-xl items-start no-underline hover:no-underline hover:shadow-md focus-visible:[outline:2px_solid] focus-visible:outline-blue-400 focus-visible:[outline-offset:2px]">
						<AlertIcon className="mt-1" />
						<div className="flex-1 min-w-0!">
							<div className="flex flex-row items-center gap-2 justify-between pe-8">
								<Tag colorScheme="red" size="sm">
									{t("diagnostics.level.error")}
								</Tag>
								<p className="font-semibold">
									{t("diagnostics.requestFailed")}
								</p>
							</div>
							<p dir="ltr" className="text-[0.75rem] font-mono">
								{item.key}
							</p>
							<p className="text-[0.875rem] whitespace-pre-wrap [word-break:break-word]">
								{item.message}
							</p>
						</div>
					</Alert>
					<CloseButton size="sm" aria-label={t("close")} onClick={() => clear(item.key)} className="end-2 absolute top-2" />
				</div>
			))}
		</div>
	);
};
