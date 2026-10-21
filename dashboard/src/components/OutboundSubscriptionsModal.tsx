import { useToast } from "components/shadcn/toast";
import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { FormControl, FormHelperText, FormLabel } from "components/shadcn/field";
import { Input } from "components/shadcn/input";
import { Switch } from "components/shadcn/selection";
import { Badge, Tag } from "components/shadcn/badge";
import { Button, IconButton } from "components/shadcn/button";
import { Spinner } from "components/shadcn/feedback";
import { Tooltip } from "components/shadcn/tooltip";
import {
	ArrowDownIcon,
	ArrowPathIcon,
	ArrowUpIcon,
	EyeIcon,
	PlusIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import {
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { fetch as apiFetch } from "service/http";
import { AppleEmojiText } from "./common/AppleEmojiText";
import {
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
	XrayModalHeader,
} from "./xray/XrayDialog";

type OutboundSub = {
	id: number;
	remark?: string;
	url?: string;
	enabled?: boolean;
	allowPrivate?: boolean;
	tagPrefix?: string;
	updateInterval?: number;
	priority?: number;
	prepend?: boolean;
	lastUpdated?: number;
	lastError?: string;
	outboundCount?: number;
};

type OutboundSubForm = {
	remark: string;
	url: string;
	tagPrefix: string;
	updateInterval: number;
	enabled: boolean;
	allowPrivate: boolean;
	prepend: boolean;
};

const blankForm: OutboundSubForm = {
	remark: "",
	url: "",
	tagPrefix: "",
	updateInterval: 600,
	enabled: true,
	allowPrivate: false,
	prepend: false,
};

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onChanged?: () => void | Promise<void>;
};

const parseAPIError = (error: any, fallback: string) =>
	error?.response?._data?.detail ??
	error?.data?.detail ??
	error?.message ??
	fallback;

const responseOK = (response: any) => response?.success !== false;

export const OutboundSubscriptionsModal: FC<Props> = ({
	isOpen,
	onClose,
	onChanged,
}) => {
	const { t } = useTranslation();
	const toast = useToast();
	const [items, setItems] = useState<OutboundSub[]>([]);
	const [form, setForm] = useState<OutboundSubForm>(blankForm);
	const [editingID, setEditingID] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [previewing, setPreviewing] = useState(false);
	const [busyID, setBusyID] = useState<number | null>(null);
	const [preview, setPreview] = useState<Array<Record<string, any>>>([]);

	const intervalMinutes = useMemo(
		() => Math.max(1, Math.round((form.updateInterval || 600) / 60)),
		[form.updateInterval],
	);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const response = await apiFetch<{ success: boolean; obj: OutboundSub[] }>(
				"/panel/xray/outbound-subs",
			);
			if (responseOK(response)) {
				setItems(Array.isArray(response.obj) ? response.obj : []);
			}
		} catch (error: any) {
			toast({
				title: parseAPIError(
					error,
					t("pages.xray.outboundSub.toastLoadFailed"),
				),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setLoading(false);
		}
	}, [t, toast]);

	useEffect(() => {
		if (isOpen) {
			void load();
		}
	}, [isOpen, load]);

	const resetForm = () => {
		setForm(blankForm);
		setEditingID(null);
		setPreview([]);
	};

	const edit = (item: OutboundSub) => {
		setEditingID(item.id);
		setForm({
			remark: item.remark ?? "",
			url: item.url ?? "",
			tagPrefix: item.tagPrefix ?? "",
			updateInterval: item.updateInterval ?? 600,
			enabled: item.enabled ?? true,
			allowPrivate: item.allowPrivate ?? false,
			prepend: item.prepend ?? false,
		});
		setPreview([]);
	};

	const notifyChanged = async () => {
		await load();
		await onChanged?.();
	};

	const save = async () => {
		if (!form.url.trim()) {
			toast({
				title: t("pages.xray.outboundSub.toastUrlRequired"),
				status: "warning",
				isClosable: true,
				position: "top",
			});
			return;
		}
		setSaving(true);
		try {
			const path =
				editingID === null
					? "/panel/xray/outbound-subs"
					: `/panel/xray/outbound-subs/${editingID}`;
			const response = await apiFetch(path, { method: "POST", body: form });
			if (responseOK(response)) {
				toast({
					title:
						editingID === null
							? t("pages.xray.outboundSub.toastAdded")
							: t("pages.xray.outboundSub.toastUpdated"),
					status: "success",
					isClosable: true,
					position: "top",
				});
				resetForm();
				await notifyChanged();
			}
		} catch (error: any) {
			toast({
				title: parseAPIError(
					error,
					t("pages.xray.outboundSub.toastAddFailed"),
				),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setSaving(false);
		}
	};

	const previewURL = async () => {
		if (!form.url.trim()) return;
		setPreviewing(true);
		setPreview([]);
		try {
			const response = await apiFetch<{
				success: boolean;
				obj: Array<Record<string, any>>;
			}>("/panel/xray/outbound-subs/parse", {
				method: "POST",
				body: {
					url: form.url,
					allowPrivate: form.allowPrivate,
				},
			});
			if (responseOK(response)) {
				setPreview(Array.isArray(response.obj) ? response.obj : []);
			}
		} catch (error: any) {
			toast({
				title: parseAPIError(
					error,
					t("pages.xray.outboundSub.previewEmpty"),
				),
				status: "error",
				isClosable: true,
				position: "top",
			});
		} finally {
			setPreviewing(false);
		}
	};

	const refreshOne = async (id: number) => {
		setBusyID(id);
		try {
			await apiFetch(`/panel/xray/outbound-subs/${id}/refresh`, {
				method: "POST",
			});
			await notifyChanged();
		} finally {
			setBusyID(null);
		}
	};

	const deleteOne = async (id: number) => {
		setBusyID(id);
		try {
			await apiFetch(`/panel/xray/outbound-subs/${id}/del`, { method: "POST" });
			await notifyChanged();
		} finally {
			setBusyID(null);
		}
	};

	const toggle = async (item: OutboundSub) => {
		setBusyID(item.id);
		try {
			await apiFetch(`/panel/xray/outbound-subs/${item.id}`, {
				method: "POST",
				body: {
					remark: item.remark ?? "",
					url: item.url ?? "",
					tagPrefix: item.tagPrefix ?? "",
					updateInterval: item.updateInterval ?? 600,
					enabled: !item.enabled,
					allowPrivate: item.allowPrivate ?? false,
					prepend: item.prepend ?? false,
				},
			});
			await notifyChanged();
		} finally {
			setBusyID(null);
		}
	};

	const move = async (id: number, dir: "up" | "down") => {
		setBusyID(id);
		try {
			await apiFetch(`/panel/xray/outbound-subs/${id}/move`, {
				method: "POST",
				body: { dir },
			});
			await notifyChanged();
		} finally {
			setBusyID(null);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
			<ModalOverlay className="bg-blackAlpha-400" />
			<XrayModalContent className="mx-3">
				<XrayModalHeader>
					{t("pages.xray.outboundSub.title")}
				</XrayModalHeader>
				<ModalCloseButton />
				<XrayModalBody>
					<div className="flex flex-col items-stretch gap-4">
						<div className="xray-section">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<FormControl>
									<FormLabel>{t("hostsDialog.remark")}</FormLabel>
									<Input size="sm" value={form.remark} onChange={(event) =>
											setForm((prev) => ({ ...prev, remark: event.target.value }))
										} placeholder={t("pages.xray.outboundSub.remarkPlaceholder")} />
								</FormControl>
								<FormControl isRequired>
									<FormLabel>{t("pages.xray.outboundSub.url")}</FormLabel>
									<Input size="sm" value={form.url} onChange={(event) =>
											setForm((prev) => ({ ...prev, url: event.target.value }))
										} placeholder="https://example.com/sub" />
								</FormControl>
								<FormControl>
									<FormLabel>{t("pages.xray.tor.tagPrefix")}</FormLabel>
									<Input size="sm" value={form.tagPrefix} onChange={(event) =>
											setForm((prev) => ({ ...prev, tagPrefix: event.target.value }))
										} placeholder="sub1-" />
									<FormHelperText>
										{t("pages.xray.outboundSub.tagPrefixHint")}
									</FormHelperText>
								</FormControl>
								<FormControl>
									<FormLabel>{t("pages.xray.outboundSub.interval")}</FormLabel>
									<Input size="sm" type="number" min={1} value={intervalMinutes} onChange={(event) =>
											setForm((prev) => ({
												...prev,
												updateInterval: Math.max(60, Number(event.target.value || 10) * 60),
											}))
										} />
									<FormHelperText>
										{t("pages.xray.outboundSub.intervalHint")}
									</FormHelperText>
								</FormControl>
							</div>
							<div className="flex flex-row items-center mt-3 gap-5 flex-wrap">
								<div className="flex flex-row items-center gap-2">
									<Switch size="sm" isChecked={form.enabled} onChange={(event) =>
											setForm((prev) => ({ ...prev, enabled: event.target.checked }))
										} />
									<p className="text-[0.875rem]">{t("nodes.enabled")}</p>
								</div>
								<div className="flex flex-row items-center gap-2">
									<Switch size="sm" isChecked={form.prepend} onChange={(event) =>
											setForm((prev) => ({ ...prev, prepend: event.target.checked }))
										} />
									<p className="text-[0.875rem]">{t("pages.xray.outboundSub.prepend")}</p>
								</div>
								<div className="flex flex-row items-center gap-2">
									<Switch size="sm" isChecked={form.allowPrivate} onChange={(event) =>
											setForm((prev) => ({ ...prev, allowPrivate: event.target.checked }))
										} />
									<p className="text-[0.875rem]">{t("pages.xray.outboundSub.allowPrivate")}</p>
								</div>
							</div>
							{preview.length > 0 && (
								<div className="flex flex-wrap mt-3 gap-2">
									{preview.map((item, index) => (
										<div key={`${item.tag}-${index}`}>
											<Tag size="sm" colorScheme="green">
												{item.tag || "-"} · {item.protocol || "-"}
											</Tag>
										</div>
									))}
								</div>
							)}
						</div>

						<div className="xray-section">
							<div className="flex flex-row items-center gap-2 justify-between mb-3">
								<div>
									<p className="font-semibold">
										{t("pages.xray.outboundSub.active")}
									</p>
									<p className="text-gray-500 text-[0.75rem]">
										{t("pages.xray.outboundSub.restartHint")}
									</p>
								</div>
								<Button size="xs" variant="ghost" leftIcon={<ArrowPathIcon className="w-14" />} isLoading={loading} onClick={load}>
									{t("refresh")}
								</Button>
							</div>
							<hr className="mb-3 w-full border-0 border-b border-panel-border! opacity-60" />
							{loading ? (
								<div className="flex flex-row items-center gap-2 justify-center py-6">
									<Spinner size="sm" />
								</div>
							) : items.length === 0 ? (
								<p className="text-gray-500 text-[0.875rem]">
									{t("pages.xray.outboundSub.empty")}
								</p>
							) : (
								<table className="w-full border-separate border-spacing-0">
									<thead>
										<tr>
											<th className="bg-panel-elevated px-6 py-3 text-start text-[0.75rem] font-bold uppercase leading-4 tracking-wider text-panel-text w-[70px]">#</th>
											<th className="bg-panel-elevated px-6 py-3 text-start text-[0.75rem] font-bold uppercase leading-4 tracking-wider text-panel-text">{t("hostsDialog.remark")}</th>
											<th className="bg-panel-elevated px-6 py-3 text-start text-[0.75rem] font-bold uppercase leading-4 tracking-wider text-panel-text">{t("pages.xray.Outbounds")}</th>
											<th className="bg-panel-elevated px-6 py-3 text-start text-[0.75rem] font-bold uppercase leading-4 tracking-wider text-panel-text">{t("status")}</th>
											<th className="bg-panel-elevated px-6 py-3 text-start text-[0.75rem] font-bold uppercase leading-4 tracking-wider text-panel-text">{t("nodes.enabled")}</th>
											<th className="bg-panel-elevated px-6 py-3 text-start text-[0.75rem] font-bold uppercase leading-4 tracking-wider text-panel-text">{t("actions")}</th>
										</tr>
									</thead>
									<tbody>
										{items.map((item, index) => (
											<tr key={item.id}>
												<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text">
													<div className="flex flex-row items-center gap-0">
														<IconButton aria-label={t("a11y.moveUp")} size="xs" variant="ghost" icon={<ArrowUpIcon className="w-14" />} isDisabled={index === 0 || busyID === item.id} onClick={() => move(item.id, "up")} />
														<IconButton aria-label={t("a11y.moveDown")} size="xs" variant="ghost" icon={<ArrowDownIcon className="w-14" />} isDisabled={index === items.length - 1 || busyID === item.id} onClick={() => move(item.id, "down")} />
													</div>
												</td>
												<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text max-w-[260px]">
													<p className="font-semibold truncate">
														<AppleEmojiText>
															{item.remark || item.url || ""}
														</AppleEmojiText>
													</p>
													<p className="text-gray-500 text-[0.75rem] truncate">
														{item.tagPrefix || "sub-"} · {item.url}
													</p>
												</td>
												<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text">
													<Badge colorScheme="blue">{item.outboundCount ?? 0}</Badge>
												</td>
												<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text">
													{item.lastError ? (
														<Tooltip label={item.lastError}>
															<Badge colorScheme="red">error</Badge>
														</Tooltip>
													) : (
														<Badge colorScheme="green">
															{item.lastUpdated
																? new Date(item.lastUpdated * 1000).toLocaleString()
																: t("myaccount.never")}
														</Badge>
													)}
												</td>
												<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text">
													<Switch size="sm" isChecked={!!item.enabled} isDisabled={busyID === item.id} onChange={() => toggle(item)} />
												</td>
												<td className="px-6 py-4 text-[0.875rem] leading-5 text-panel-text">
													<div className="flex flex-row items-center gap-1">
														<Button size="xs" variant="ghost" onClick={() => edit(item)}>
															{t("edit")}
														</Button>
														<IconButton aria-label={t("refresh")} size="xs" variant="ghost" icon={<ArrowPathIcon className="w-14" />} isLoading={busyID === item.id} onClick={() => refreshOne(item.id)} />
														<IconButton aria-label={t("delete")} size="xs" variant="ghost" colorScheme="red" icon={<TrashIcon className="w-14" />} isDisabled={busyID === item.id} onClick={() => deleteOne(item.id)} />
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					</div>
				</XrayModalBody>
				<XrayModalFooter>
					<div className="flex flex-row items-center w-full justify-between gap-2 flex-wrap">
						<div>
							{editingID !== null && (
								<Button size="sm" variant="ghost" onClick={resetForm}>
									{t("cancel")}
								</Button>
							)}
						</div>
						<div className="flex flex-row items-center gap-2 flex-wrap">
							<Button size="sm" variant="ghost" leftIcon={<EyeIcon className="w-16" />} isLoading={previewing} onClick={previewURL}>
								{t("bulkActions.preview")}
							</Button>
							<Button size="sm" colorScheme="primary" leftIcon={<PlusIcon className="w-16" />} isLoading={saving} onClick={save}>
								{editingID === null ? t("add") : t("save")}
							</Button>
							<Button size="sm" variant="ghost" onClick={onClose}>
								{t("close")}
							</Button>
						</div>
					</div>
				</XrayModalFooter>
			</XrayModalContent>
		</Modal>
	);
};
