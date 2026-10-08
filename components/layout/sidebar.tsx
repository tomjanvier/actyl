"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Menu,
  Search,
  X,
  UsersRound,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/controls";
import { EntityAvatar } from "@/components/ui/badge";
import { CommandMenu } from "@/components/layout/command-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PlaidActCredit } from "@/components/layout/plaidact-credit";
import { ActylLogo } from "@/components/layout/actyl-logo";

const RAIL_WIDTH = 60;
const MIN_WIDTH = 192;
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 224;
const WIDTH_KEY = "actyl_sidebar_width_v2";
const COLLAPSED_KEY = "actyl_sidebar_collapsed";

function clampWidth(value: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
}

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

export function Sidebar({
  workspace,
  workspaces,
  userName,
  isSuperAdmin = false,
  directorySegments,
  pinnedCampaigns = [],
  pinnedLists = [],
  presidentialEnabled = false,
}: {
  workspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  userName: string;
  isSuperAdmin?: boolean;
  /** Segments actifs de l'annuaire. */
  directorySegments?: DirectorySegment[];
  pinnedCampaigns?: Array<{ id: string; slug: string; name: string; emoji: string }>;
  pinnedLists?: Array<{ id: string; name: string }>;
  presidentialEnabled?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchCategory = searchParams.get("category") ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Miroir de la largeur : les appuis répétés doivent s'accumuler dans le même tick.
  const liveWidth = useRef(width);

  function applyWidth(next: number) {
    liveWidth.current = next;
    setWidth(next);
  }

  // Construit le menu avec les modules actifs de l'espace.
  const nav = useMemo(() => {
    const base: Array<{ href: string; label: string; icon: typeof Users }> = [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/campaigns", label: "Campagnes", icon: KanbanSquare },
      { href: "/tasks", label: "Tâches", icon: CheckCircle },
      { href: "/supporters", label: "Soutiens", icon: HeartHandshake },
      { href: "/events", label: "Événements", icon: CalendarDays },
      ...(presidentialEnabled
        ? [{ href: "/presidentielle", label: "Présidentielle 2027", icon: UsersRound }]
        : []),
    ];
    base.push(
      { href: "/lists", label: "Listes partagées", icon: ListChecks },
      { href: "/settings", label: "Paramètres", icon: Settings },
      ...(isSuperAdmin ? [{ href: "/admin", label: "Super administration", icon: Settings }] : []),
    );
    return base;
  }, [presidentialEnabled, isSuperAdmin]);

  // Restaure la largeur et le repli mémorisés, une seule fois au montage.
  useEffect(() => {
    const storedWidth = Number(localStorage.getItem(WIDTH_KEY));
    if (storedWidth >= MIN_WIDTH && storedWidth <= MAX_WIDTH) {
      liveWidth.current = storedWidth;
      setWidth(storedWidth);
    }
    if (localStorage.getItem(COLLAPSED_KEY) === "1") setCollapsed(true);
  }, []);

  const persistWidth = useCallback((next: number) => {
    localStorage.setItem(WIDTH_KEY, String(next));
  }, []);

  function toggleCollapsed() {
    if (collapsed) {
      expand(clampWidth(Number(localStorage.getItem(WIDTH_KEY)) || DEFAULT_WIDTH));
    } else {
      collapse();
    }
  }

  /** Repli quand la largeur demandée tient dans le rail, sinon largeur bornée. */
  function setRailWidth(next: number) {
    if (next < MIN_WIDTH - 24) {
      collapse();
      return;
    }
    expand(clampWidth(next));
  }

  function collapse() {
    setCollapsed(true);
    localStorage.setItem(COLLAPSED_KEY, "1");
  }

  /** Réouvre à une largeur lisible, puis enregistre la valeur demandée. */
  function expand(next: number) {
    setCollapsed(false);
    localStorage.setItem(COLLAPSED_KEY, "0");
    applyWidth(next);
    persistWidth(next);
  }

  /** Drag au pointeur : le menu suit le curseur sans transition qui traîne. */
  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startWidth = collapsed ? RAIL_WIDTH : liveWidth.current;
    const startX = event.clientX;
    let next = startWidth;
    let wasRail = collapsed;

    const onMove = (move: PointerEvent) => {
      next = startWidth + (move.clientX - startX);
      setResizing(true);
      if (next < MIN_WIDTH - 24) {
        if (!wasRail) {
          collapse();
          wasRail = true;
        }
      } else {
        if (wasRail) {
          expand(clampWidth(next));
          wasRail = false;
        } else {
          applyWidth(clampWidth(next));
        }
      }
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      document.body.classList.remove("actyl-resizing");
      setResizing(false);
      if (next < MIN_WIDTH - 24) collapse();
      else expand(clampWidth(next));
    };

    document.body.classList.add("actyl-resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }

  /** Le même réglage au clavier, avec la sémantique d'un séparateur. */
  function onResizeKeyDown(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 32 : 16;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? step : -step;
      // Depuis le rail, une flèche vers la droite rouvre à la largeur mémorisée
      // plutôt que de bricoler 16 px sous le minimum.
      if (collapsed && delta > 0) {
        expand(
          clampWidth(Number(localStorage.getItem(WIDTH_KEY)) || DEFAULT_WIDTH),
        );
        return;
      }
      setRailWidth((collapsed ? RAIL_WIDTH : liveWidth.current) + delta);
    } else if (event.key === "Home") {
      event.preventDefault();
      setRailWidth(MIN_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      setRailWidth(MAX_WIDTH);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCollapsed();
    }
  }

  async function switchWorkspace(wsId: string) {
    if (wsId === workspace.id) return;
    setSwitching(wsId);
    await switchWorkspaceAction(wsId);
    router.refresh();
    setSwitching(null);
  }

  // Le rail ne concerne que le bureau : le tiroir mobile garde ses libellés.
  const rail = collapsed && !mobileOpen;

  const searchTrigger = (
    <button
      type="button"
      className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-elev px-2.5 text-left text-[12.5px] text-faint transition-colors hover:border-hoverstrong hover:text-mut"
    >
      <Search aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">Rechercher…</span>
      <kbd className="ml-auto shrink-0 rounded border border-line px-1.5 py-px font-mono text-[10px] leading-4">
        ⌘K
      </kbd>
    </button>
  );

  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        className="fixed left-3 top-3 z-40 md:hidden"
        aria-label="Ouvrir le menu"
        onClick={() => setMobileOpen(true)}
      >
        <Menu />
      </Button>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    <aside
      data-testid="app-sidebar"
      className={cn(
        "sticky top-0 self-start flex h-dvh min-w-0 shrink-0 flex-col overflow-x-hidden border-r border-line bg-sidebar max-md:fixed max-md:left-0 max-md:top-0 max-md:z-50 max-md:!w-[min(86vw,300px)] max-md:shadow-2xl",
        rail ? "w-[60px]" : "w-[var(--sidebar-width)]",
        !resizing && "transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        !mobileOpen && "max-md:-translate-x-full",
      )}
      style={{ ["--sidebar-width" as string]: `${width}px` }}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-line px-3",
          rail && "justify-center px-0",
        )}
      >
        <Link href="/" aria-label="Accueil Actyl">
          <ActylLogo
            variant={rail ? "icon" : "lockup"}
            className={rail ? "size-7" : "h-7 w-[116px]"}
            priority
          />
        </Link>
      </div>

      {/* Sélecteur d’espace de travail. */}
      <div className={cn("flex items-center gap-2 px-3 pb-2 pt-4", rail && "justify-center px-0")}>
        <Button variant="ghost" size="icon-sm" className="ml-auto md:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu">
          <X />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "group flex min-w-0 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-elev",
                rail && "p-0",
              )}
            >
              <EntityAvatar
                name={workspace.name}
                emoji={workspace.logoEmoji}
                size="sm"
              />
              {!rail && (
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
                {ws.id === workspace.id && <Check className="ml-auto !text-accent-text" />}
              </DropdownMenuItem>
            ))}
            {isSuperAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/admin")}>
                  <Plus />
                  Super administration
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation principale. */}
      <nav aria-label="Navigation principale" className={cn("mt-2 flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overscroll-contain overflow-y-auto px-3", rail && "items-center px-0")}>
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const showSegments =
            item.href === "/contacts" && !!directorySegments?.length;
          const link = (
            <Link
              href={item.href}
              aria-current={active && !searchCategory ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors md:min-h-8",
                rail && "w-9 justify-center px-0",
                active && !searchCategory
                  ? "bg-accent-soft font-semibold text-fg ring-1 ring-inset ring-accent-ring/40"
                  : "text-faint hover:bg-elev hover:text-mut",
              )}
            >
              <item.icon className={cn("size-4 shrink-0", active && "text-accent-text")} />
              {!rail && item.label}
            </Link>
          );
          return (
            <div key={item.href} className={cn("w-full min-w-0", rail && "flex justify-center")}>
              {rail ? (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
              {item.href === "/campaigns" && !rail && pinnedCampaigns.length > 0 && (
                <div className="mb-1 ml-[26px] mt-0.5 flex flex-col border-l border-line pl-2">
                  {pinnedCampaigns.map((campaign) => (
                    <Link
                      key={campaign.id}
                      href={`/campaigns/${campaign.id}/kanban`}
                      className="flex min-h-8 items-center gap-1.5 truncate rounded-md px-2 text-[11.5px] text-faint hover:bg-elev hover:text-mut"
                      onClick={() => setMobileOpen(false)}
                    >
                      <span>{campaign.emoji}</span>
                      <span className="truncate">{campaign.name}</span>
                    </Link>
                  ))}
                </div>
              )}
              {item.href === "/lists" && !rail && pinnedLists.length > 0 && (
                <div className="mb-1 ml-[26px] mt-0.5 flex flex-col border-l border-line pl-2">
                  {pinnedLists.map((list) => (
                    <Link
                      key={list.id}
                      href={`/contacts?list=${encodeURIComponent(list.id)}`}
                      className="flex min-h-8 items-center truncate rounded-md px-2 text-[11.5px] text-faint hover:bg-elev hover:text-mut"
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="truncate">{list.name}</span>
                    </Link>
                  ))}
                </div>
              )}
              {showSegments && !rail && (
                <div className="mb-1 ml-[26px] mt-0.5 flex flex-col border-l border-line pl-2">
                  {directorySegments!.map((seg) => {
                    const segActive = pathname === "/contacts" && searchCategory === seg.key;
                    return (
                      <Link
                        key={seg.key || "all"}
                        href={seg.key ? `/contacts?category=${seg.key}` : "/contacts"}
                        aria-current={segActive ? "page" : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex min-h-11 items-center justify-between rounded-md px-1.5 text-[12px] transition-colors md:min-h-8",
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


      {!rail && (
        <div className="px-4 pb-1 pt-2">
          <PlaidActCredit />
        </div>
      )}

      {/* Pied du menu : recherche, thème, largeur et compte utilisateur. */}
      <div className="flex flex-col gap-1 border-t border-line p-3">
        {rail ? (
          <CommandMenu
            presidentialEnabled={presidentialEnabled}
            listShortcuts={pinnedLists}
            trigger={
              <Button variant="ghost" size="icon-sm" title="Recherche globale" aria-label="Recherche globale">
                <Search />
              </Button>
            }
          />
        ) : (
          <CommandMenu
            presidentialEnabled={presidentialEnabled}
            listShortcuts={pinnedLists}
            trigger={searchTrigger}
          />
        )}
        <div className={cn("flex items-center justify-between gap-2", rail && "flex-col")}>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            title={rail ? "Déplier le menu" : "Replier le menu"}
            aria-label={rail ? "Déplier le menu" : "Replier le menu"}
          >
            {rail ? (
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
                "flex w-full items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-elev",
                rail && "justify-center",
              )}
            >
              <EntityAvatar name={userName} color="indigo" size="sm" />
              {!rail && (
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

      {/* Poignée de largeur : visible au survol, utilisable au clavier. */}
      <button
        type="button"
        role="separator"
        aria-label="Redimensionner le menu latéral"
        aria-orientation="vertical"
        aria-valuenow={rail ? RAIL_WIDTH : width}
        aria-valuemin={RAIL_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuetext={rail ? "Menu replié" : `${width} pixels`}
        data-active={resizing ? "true" : undefined}
        className="actyl-resizer hidden md:block"
        onPointerDown={startResize}
        onDoubleClick={() => setRailWidth(DEFAULT_WIDTH)}
        onKeyDown={onResizeKeyDown}
      />
    </aside>
    </>
  );
}