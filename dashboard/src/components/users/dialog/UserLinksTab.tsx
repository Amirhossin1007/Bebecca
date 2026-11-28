import { Badge } from "components/ui/badge";
import { buttonVariants } from "components/ui/button";
import { Check, Copy, QrCode } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import type {
	ConfigLinkItem,
	SubscriptionLinkItem,
} from "./userDialog.types";

type UserLinksTabProps = {
	username: string | null;
	subscriptionLinks: SubscriptionLinkItem[];
	configItems: ConfigLinkItem[];
	configLinksText: string;
	copiedKey: string | null;
	onCopy: (key: string, value: string) => void;
	onOpenQr: (links: string[], subLink: string | null) => void;
};

export const UserLinksTab: FC<UserLinksTabProps> = ({
	subscriptionLinks,
	configItems,
	configLinksText,
	copiedKey,
	onCopy,
	onOpenQr,
}) => {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<span className="text-sm font-medium">
					{t("userDialog.links.subscription")}
				</span>
				{subscriptionLinks.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{t("userDialog.links.noSubscription")}
					</p>
				) : (
					subscriptionLinks.map((item) => (
						<div
							key={item.key}
							className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
						>
							<div className="flex min-w-0 items-center gap-2">
								<span className="truncate text-sm">{item.label}</span>
								{item.key === "key" ? (
									<Badge variant="secondary">
										{t("userDialog.links.recommended")}
									</Badge>
								) : null}
							</div>
							<div className="flex shrink-0 items-center">
								<button
									type="button"
									aria-label={t("a11y.copySubscriptionLink")}
									title={copiedKey === item.key ? t("copied") : t("copy")}
									onClick={() => onCopy(item.key, item.url)}
									className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
								>
									{copiedKey === item.key ? <Check /> : <Copy />}
								</button>
								<button
									type="button"
									aria-label={t("a11y.subscriptionQr")}
									title={t("userDialog.links.qr")}
									onClick={() => onOpenQr([], item.url)}
									className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
								>
									<QrCode />
								</button>
							</div>
						</div>
					))
				)}
			</div>

			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<span className="text-sm font-medium">
						{t("userDialog.links.configs")}
					</span>
					{configItems.length > 0 ? (
						<button
							type="button"
							onClick={() => onCopy("all", configLinksText)}
							className={buttonVariants({ variant: "outline", size: "sm" })}
						>
							{copiedKey === "all" ? <Check /> : <Copy />}
							{copiedKey === "all"
								? t("copied")
								: t("userDialog.links.copyAllConfigs")}
						</button>
					) : null}
				</div>
				{configItems.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{t("userDialog.links.noConfigs")}
					</p>
				) : (
					configItems.map((item, index) => (
						<div
							key={`${item.link}-${index}`}
							className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
						>
							<span
								dir="ltr"
								className="min-w-0 flex-1 truncate text-start text-sm"
							>
								{item.label}
							</span>
							<div className="flex shrink-0 items-center">
								<button
									type="button"
									aria-label={t("a11y.copyConfig")}
									title={
										copiedKey === `config-${index}` ? t("copied") : t("copy")
									}
									onClick={() => onCopy(`config-${index}`, item.link)}
									className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
								>
									{copiedKey === `config-${index}` ? <Check /> : <Copy />}
								</button>
								<button
									type="button"
									aria-label={t("a11y.configQr")}
									title={t("userDialog.links.qr")}
									onClick={() => onOpenQr([item.link], null)}
									className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
								>
									<QrCode />
								</button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};
