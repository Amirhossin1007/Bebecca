import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { Tag } from "components/shadcn/badge";
import { Button } from "components/shadcn/button";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import {
	XrayModalBody,
	XrayModalContent,
	XrayModalHeader,
} from "./xray/XrayDialog";

type DnsPreset = {
	name: string;
	family: boolean;
	servers: string[];
};

const DNS_PRESETS: DnsPreset[] = [
	{
		name: "Google DNS",
		family: false,
		servers: [
			"8.8.8.8",
			"8.8.4.4",
			"2001:4860:4860::8888",
			"2001:4860:4860::8844",
		],
	},
	{
		name: "Cloudflare DNS",
		family: false,
		servers: [
			"1.1.1.1",
			"1.0.0.1",
			"2606:4700:4700::1111",
			"2606:4700:4700::1001",
		],
	},
	{
		name: "Adguard DNS",
		family: false,
		servers: [
			"94.140.14.14",
			"94.140.15.15",
			"2a10:50c0::ad1:ff",
			"2a10:50c0::ad2:ff",
		],
	},
	{
		name: "Adguard Family DNS",
		family: true,
		servers: [
			"94.140.14.14",
			"94.140.15.15",
			"2a10:50c0::ad1:ff",
			"2a10:50c0::ad2:ff",
		],
	},
	{
		name: "Cloudflare Family DNS",
		family: true,
		servers: [
			"1.1.1.3",
			"1.0.0.3",
			"2606:4700:4700::1113",
			"2606:4700:4700::1003",
		],
	},
];

interface DnsPresetsModalProps {
	open: boolean;
	onClose: () => void;
	onSelectPreset: (servers: string[]) => void;
}

export const DnsPresetsModal: FC<DnsPresetsModalProps> = ({
	open: isOpen,
	onClose,
	onSelectPreset,
}) => {
	const { t } = useTranslation();

	return (
		<Modal open={isOpen} onClose={onClose} size="md">
			<ModalOverlay className="bg-blackAlpha-400" />
			<XrayModalContent className="mx-3">
				<XrayModalHeader>
					{t("pages.xray.dns.dnsPresetTitle")}
				</XrayModalHeader>
				<ModalCloseButton />
				<XrayModalBody className="pb-6">
					<div className="flex flex-col gap-3 items-stretch">
						{DNS_PRESETS.map((preset) => (
							<div key={preset.name} className="border rounded-md p-3 xray-dialog-section">
								<div className="flex flex-row items-center gap-3">
									<Tag colorScheme={preset.family ? "purple" : "green"} size="sm">
										{preset.family
											? t("pages.xray.dns.dnsPresetFamily")
											: t("DNS")}
									</Tag>
									<p className="font-semibold">{preset.name}</p>
									<div className="flex-1" />
									<Button size="xs" colorScheme="primary" onClick={() => {
											onSelectPreset(preset.servers);
											onClose();
										}}>
										{t("install")}
									</Button>
								</div>
							</div>
						))}
					</div>
				</XrayModalBody>
			</XrayModalContent>
		</Modal>
	);
};
