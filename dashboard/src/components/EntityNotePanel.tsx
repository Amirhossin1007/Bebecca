import {
	Button,
	FormControl,
	FormHelperText,
	FormLabel,
	HStack,
	Textarea,
	useToast,
} from "@chakra-ui/react";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import useGetUser from "hooks/useGetUser";
import { fetch as apiFetch, getAPIErrorMessage } from "service/http";
import { AdminRole } from "types/Admin";

export type EntityNoteType = "admin" | "host" | "inbound";

type EntityNote = {
	note: string;
	updated_by: string;
	updated_at: number;
};

const NOTE_MAX_LENGTH = 4000;

export const EntityNotePanel: FC<{
	entityType: EntityNoteType;
	entityKey: string | number;
}> = ({ entityType, entityKey }) => {
	const { t } = useTranslation();
	const toast = useToast();
	const queryClient = useQueryClient();
	const { userData } = useGetUser();
	const canView =
		userData?.role === AdminRole.Sudo ||
		userData?.role === AdminRole.FullAccess;
	const key = String(entityKey);
	const path = `/notes/${entityType}/${encodeURIComponent(key)}`;
	const queryKey = ["entity-note", entityType, key];
	const { data, isLoading } = useQuery<EntityNote>(
		queryKey,
		() => apiFetch<EntityNote>(path),
		{ enabled: canView },
	);
	const [draft, setDraft] = useState("");

	useEffect(() => {
		setDraft(data?.note ?? "");
	}, [data]);

	const { mutate: save, isLoading: isSaving } = useMutation(
		(note: string) =>
			apiFetch<EntityNote>(path, { method: "PUT", body: { note } }),
		{
			onSuccess: (saved) => {
				queryClient.setQueryData(queryKey, saved);
				toast({
					status: "success",
					title: t("entityNote.saved"),
					isClosable: true,
				});
			},
			onError: (error) => {
				toast({
					status: "error",
					title: getAPIErrorMessage(error) ?? t("entityNote.saveFailed"),
					isClosable: true,
				});
			},
		},
	);

	if (!canView) {
		return null;
	}
	const dirty = draft.trim() !== (data?.note ?? "");
	return (
		<FormControl>
			<FormLabel>{t("entityNote.label")}</FormLabel>
			<Textarea
				rows={3}
				maxLength={NOTE_MAX_LENGTH}
				value={draft}
				isDisabled={isLoading}
				placeholder={t("entityNote.placeholder")}
				onChange={(event) => setDraft(event.target.value)}
			/>
			<FormHelperText>{t("entityNote.hint")}</FormHelperText>
			{data?.updated_by ? (
				<FormHelperText>
					{t("entityNote.lastEdited", { name: data.updated_by })}
				</FormHelperText>
			) : null}
			<HStack justify="flex-end" mt={2}>
				<Button
					size="sm"
					isDisabled={!dirty || isLoading}
					isLoading={isSaving}
					onClick={() => save(draft.trim())}
				>
					{t("entityNote.save")}
				</Button>
			</HStack>
		</FormControl>
	);
};
