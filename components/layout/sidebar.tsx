"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  KanbanSquare,
  ListChecks,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  Check,
  LogOut,
  Plus,
  CheckCircle,
  CalendarDays,
  HeartHandshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { switchWorkspaceAction, signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { EntityAvatar } from "@/components/ui/badge";
import { CommandMenu } from "@/components/layout/command-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PlaidActCredit } from "@/components/layout/plaidact-credit";

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  logoEmoji: string;
  role: string;
};

export type DirectorySegment = {
  key: string;
  label: string;
  count: number;
};

const NAV = [
  { href: "/contacts", label: "Contacts", icon: Users, hint: "Annuaire des décideurs" },
  { href: "/campaigns", label: "Campagnes", icon: KanbanSquare, hint: "Pipelines & interpellations" },
  { href: "/tasks", label: "Tâches", icon: CheckCircle, hint: "Relances & suivis" },
  { href: "/supporters", label: "Soutiens", icon: HeartHandshake, hint: "Base citoyenne engagée" },
  { href: "/events", label: "Événements", icon: CalendarDays, hint: "Réunions & RSVP" },
  { href: "/lists", label: "Listes partagées", icon: ListChecks, hint: "Annuaires publiés" },
  { href: "/settings", label: "Paramètres", icon: Settings, hint: "Champs, équipes, membres" },
] as const;

export function Sidebar({
  workspace,
  workspaces,
  userName,
  directorySegments,
}: {
  workspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  userName: string;
  /** Present when the extended directory flag is on (associations). */
  directorySegments?: DirectorySegment[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchCategory = searchParams.get("category") ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("actyl_sidebar_collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem("actyl_sidebar_collapsed", c ? "0" : "1");
      return !c;
    });
  }

  async function switchWorkspace(wsId: string) {
    if (wsId === workspace.id) return;
    setSwitching(wsId);
    await switchWorkspaceAction(wsId);
    router.refresh();
    setSwitching(null);
  }

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[56px]" : "w-[228px]",
      )}
    >
      {/* Workspace switcher */}
      <div className={cn("flex items-center gap-2 px-3 pb-2 pt-4", collapsed && "justify-center px-0")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "group flex min-w-0 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-elev",
                collapsed && "p-0",
              )}
            >
              <EntityAvatar
                name={workspace.name}
                emoji={workspace.logoEmoji}
                size="sm"
              />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                    {workspace.name}
                  </span>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-faint group-hover:text-mut" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Espaces de travail</DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} onClick={() => void switchWorkspace(ws.id)}>
                <span>{ws.logoEmoji}</span>
                <span className="truncate">{ws.name}</span>
                {ws.id === workspace.id && <Check className="ml-auto !text-indigo-700 dark:text-indigo-400" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/sign-up")}>
              <Plus />
              Nouvel espace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav */}
      <nav className={cn("mt-2 flex flex-col gap-0.5 px-3", collapsed && "items-center px-0")}>
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const showSegments =
            item.href === "/contacts" && !!directorySegments?.length;
          return (
            <div key={item.href} className="w-full">
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
                  collapsed && "w-9 justify-center px-0",
                  active && !searchCategory
                    ? "bg-hoverstrong font-medium text-fg"
                    : "text-faint hover:bg-elev hover:text-mut",
                )}
              >
                <item.icon className={cn("size-4 shrink-0", active && "text-indigo-700 dark:text-indigo-400")} />
                {!collapsed && item.label}
              </Link>
              {showSegments && !collapsed && (
                <div className="mb-1 ml-[26px] mt-0.5 flex flex-col border-l border-line pl-2">
                  {directorySegments!.map((seg) => {
                    const segActive = pathname === "/contacts" && searchCategory === seg.key;
                    return (
                      <Link
                        key={seg.key || "all"}
                        href={seg.key ? `/contacts?category=${seg.key}` : "/contacts"}
                        className={cn(
                          "flex h-6.5 items-center justify-between rounded-md px-1.5 text-[12px] transition-colors",
                          segActive
                            ? "bg-elev font-medium text-fg"
                            : "text-faint hover:bg-elev hover:text-mut",
                        )}
                      >
                        <span className="truncate">{seg.label}</span>
                        <span className="ml-2 shrink-0 tabular-nums text-[10.5px] text-faint">
                          {seg.count}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex-1" />

      {!collapsed && (
        <div className="px-4 pb-1 pt-2">
          <PlaidActCredit />
        </div>
      )}

      {/* Footer: collapse + user */}
      <div className="flex flex-col gap-1 border-t border-line p-3">
        <div className={cn("flex items-center justify-between gap-2", collapsed && "flex-col")}>
          <CommandMenu
            trigger={
              collapsed ? (
                <Button variant="ghost" size="icon-sm" title="Recherche (⌘K)">
                  <kbd className="text-[10px]">⌘K</kbd>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-7 flex-1 justify-start gap-2 text-[12px] text-faint">
                  Rechercher… <span className="ml-auto font-mono text-[10px]">⌘K</span>
                </Button>
              )
            }
          />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            title={collapsed ? "Déplier" : "Replier"}
          >
            {collapsed ? (
              <PanelLeftOpen />
            ) : (
              <PanelLeftClose />
            )}
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "mt-1 flex w-full items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-elev",
                collapsed && "justify-center",
              )}
            >
              <EntityAvatar name={userName} color="indigo" size="sm" />
              {!collapsed && (
                <span className="min-w-0 flex-1 truncate text-left text-[12.5px] text-mut">
                  {userName}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem asChild>
              <Link href="/settings?tab=profil">
                <Settings />
                Mon profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <button type="submit" className="w-full">
                <DropdownMenuItem destructive asChild>
                  <span>
                    <LogOut />
                    Déconnexion
                  </span>
                </DropdownMenuItem>
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {switching && (
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 bg-black/20" />
      )}
    </aside>
  );
}
