import {
  Ban,
  CircleCheck,
  Copy,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeleteUser, useResetUserUsage, useSetUserStatus } from "@/features/users/api"
import { errorMessage } from "@/lib/api"
import type { UserListItem } from "@/types/api"

export function UserRowActions({ user }: { user: UserListItem }) {
  const { t } = useTranslation()
  const reset = useResetUserUsage()
  const setStatus = useSetUserStatus()
  const remove = useDeleteUser()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const disabled = user.status === "disabled"

  const copySubscription = async () => {
    try {
      await navigator.clipboard.writeText(user.subscription_url)
      toast.success(t("next.toast.copied"))
    } catch {
      toast.error(t("next.toast.copyFailed"))
    }
  }

  const run = (action: () => void) => {
    action()
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground opacity-60 transition-opacity group-hover/row:opacity-100 data-[state=open]:opacity-100"
            aria-label={t("actions")}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => run(() => void copySubscription())}>
            <Copy className="size-4" />
            {t("next.users.copySubscription")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={reset.isPending}
            onSelect={() =>
              run(() => {
                reset.mutate(user.username, {
                  onSuccess: () => toast.success(t("next.users.resetUsage")),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              })
            }
          >
            {reset.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            {t("next.users.resetUsage")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={setStatus.isPending}
            onSelect={() =>
              run(() => {
                setStatus.mutate(
                  { username: user.username, status: disabled ? "active" : "disabled" },
                  { onError: (error) => toast.error(errorMessage(error)) },
                )
              })
            }
          >
            {disabled ? <CircleCheck className="size-4" /> : <Ban className="size-4" />}
            {disabled ? t("next.users.enable") : t("next.users.disable")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            {t("next.users.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("next.users.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("next.users.deleteConfirm", { username: user.username })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                remove.mutate(user.username, {
                  onSuccess: () => toast.success(`${user.username} — ${t("next.users.delete")}`),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
