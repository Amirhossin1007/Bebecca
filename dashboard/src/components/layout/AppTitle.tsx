import logoUrl from "assets/logo.svg";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "components/ui/sidebar";
import { Link } from "react-router-dom";

export function AppTitle() {
	const { setOpenMobile } = useSidebar();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					size="lg"
					asChild
					className="h-12 w-full gap-2.5 rounded-xl border border-transparent p-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
				>
					<Link
						to="/"
						onClick={() => setOpenMobile(false)}
						className="flex items-center gap-2.5 text-start"
					>
						<div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-panel-border bg-panel-elevated p-1 shadow-xs">
							<img
								src={logoUrl}
								alt="Rebecca"
								className="size-6 object-contain"
							/>
						</div>
						<div className="grid min-w-0 flex-1 leading-tight">
							<span className="truncate text-sm font-bold tracking-tight text-panel-text">
								Rebecca
							</span>
							<span className="truncate text-[10px] font-medium tracking-wider text-panel-text-muted uppercase">
								Control Panel
							</span>
						</div>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
