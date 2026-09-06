import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Coffee,
  Users,
  Package,
  Megaphone,
  ShoppingCart,
<<<<<<< HEAD
=======
  Receipt,
  Banknote,
  Compass,
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
  Warehouse as WarehouseIcon,
  FlaskConical,
  Handshake,
  Send,
  GraduationCap,
  Rocket,
  LogOut,
  BarChart3,
  ScanLine,
<<<<<<< HEAD
  Compass,
  Search,
  Bell,
  Sun,
  Moon,
  PanelLeft,
  Menu,
=======
  HandCoins,
  CalendarClock,
  ShieldCheck,
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
} from "lucide-react";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth";
import { trpc } from "@/providers/trpc";
import { ROLE_LABELS, type UserRole } from "@contracts/constants";

const STAFF: UserRole[] = ["platform_admin", "ops_manager"];
const ALL_ROLES: UserRole[] = ["platform_admin", "ops_manager", "sales_csm", "analyst", "roaster_buyer"];
const READERS: UserRole[] = ["platform_admin", "ops_manager", "sales_csm", "analyst"];

const NAV_GROUPS: {
  label: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard; roles: UserRole[] }[];
}[] = [
  {
    label: "Source",
    items: [
      { to: "/navigator", label: "Navigator", icon: Compass, roles: ALL_ROLES },
      { to: "/catalog", label: "Catalog", icon: Coffee, roles: ALL_ROLES },
<<<<<<< HEAD
      { to: "/samples", label: "Sample Kits", icon: Package, roles: [...STAFF, "sales_csm", "roaster_buyer"] },
    ],
  },
  {
    label: "Engage",
    items: [
      { to: "/campaigns", label: "Campaigns", icon: Megaphone, roles: STAFF },
      { to: "/comms", label: "Comms", icon: Send, roles: STAFF },
      { to: "/growth", label: "Growth", icon: Rocket, roles: STAFF },
    ],
  },
  {
    label: "Relationships",
    items: [
      { to: "/crm", label: "Roasters", icon: Users, roles: READERS },
      { to: "/education", label: "Education", icon: GraduationCap, roles: ALL_ROLES },
=======
      { to: "/orders", label: "Orders", icon: ShoppingCart, roles: ALL_ROLES },
      { to: "/invoices", label: "Invoices", icon: Receipt, roles: [...READERS, "roaster_buyer"] },
      { to: "/payments", label: "Payments & AR", icon: Banknote, roles: [...STAFF, "analyst"] },
      { to: "/collections", label: "Collections & FX", icon: HandCoins, roles: [...STAFF, "sales_csm", "analyst"] },
      { to: "/trust", label: "Trust", icon: ShieldCheck, roles: [...READERS, "roaster_buyer"] },
      { to: "/subscriptions", label: "Standing Orders", icon: CalendarClock, roles: [...STAFF, "sales_csm", "analyst"] },
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
    ],
  },
  {
    label: "Intelligence",
    items: [{ to: "/analytics", label: "Analytics", icon: BarChart3, roles: READERS }],
  },
  {
    label: "Operations",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: READERS },
      { to: "/orders", label: "Orders", icon: ShoppingCart, roles: ALL_ROLES },
      { to: "/warehouse", label: "Warehouse", icon: WarehouseIcon, roles: STAFF },
      { to: "/intake", label: "Doc Intake", icon: ScanLine, roles: STAFF },
      { to: "/qc", label: "QC Lab", icon: FlaskConical, roles: STAFF },
      { to: "/partners", label: "Partners", icon: Handshake, roles: STAFF },
    ],
  },
];

function pathLabel(pathname: string) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.to) return { group: group.label, page: item.label };
    }
  }
  return { group: "", page: "" };
}

function AuctumSeal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="12" cy="12" r="7.75" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <ellipse cx="12" cy="12" rx="3.4" ry="2.1" transform="rotate(30 12 12)" fill="none" stroke="#C9978F" strokeWidth="0.75" />
      <path d="M8.6 14.6 Q12 11.2 15.4 9.6" fill="none" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
    </svg>
  );
}

function useTheme() {
  const [dark, setDark] = useState(
    () =>
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark",
  );
  return {
    dark,
    toggle: () => {
      const next = !dark;
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
      try {
        localStorage.setItem("auctum-theme", next ? "dark" : "light");
      } catch {
        void 0;
      }
    },
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const openCmdKRef = useRef<HTMLButtonElement>(null);
  const theme = useTheme();

  const { data: lots } = trpc.catalog.list.useQuery(undefined, { enabled: searchOpen || query.length > 0 });
  const { data: watchlist } = trpc.analytics.churnWatchlist.useQuery(undefined, { enabled: true });

  const logout = trpc.auth.logout.useMutation({
    onSettled: async () => {
      await utils.invalidate();
      navigate("/login", { replace: true });
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const role = user?.role;
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => role != null && item.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

<<<<<<< HEAD
  const crumb = pathLabel(pathname);
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return (lots ?? [])
      .filter((l) => `${l.name} ${l.origin} ${l.region}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, lots]);

  const dangerCount = watchlist?.length ?? 0;
  const initials = (user?.name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const sidebarInner = (
    <>
      <div className={cn("flex items-center gap-2.5 h-16 shrink-0 border-b border-white/10", collapsed ? "px-4 justify-center" : "px-5")}>
        <AuctumSeal className="h-8 w-8 shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display text-lg leading-none text-paper-50">Auctum Ledger</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#A9A08C]">By Auctum</div>
=======
  return (
    <div className="min-h-screen bg-background text-foreground">
       <aside className="fixed inset-y-0 left-0 w-60 border-r border-white/10 bg-[#16323E] text-[#F6F1E7] flex flex-col">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 shrink-0">
          <Compass className="h-6 w-6 text-[#C9A34A]" />
          <div>
            <div className="font-bold tracking-tight leading-none font-display">Auctum Ledger</div>
            <div className="text-[10px] uppercase tracking-widest text-[#9fc0ab] mt-1">
              ODASI Technologies
            </div>
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
          </div>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-5 overflow-y-auto" aria-label="Primary">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7E8D7F]">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? label : undefined}
                    className={cn(
<<<<<<< HEAD
                      "relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors duration-fast",
                      collapsed ? "justify-center h-10 w-10 mx-auto" : "h-10 px-3",
                      active
                        ? "bg-oxblood text-paper-50"
                        : "text-paper-50/70 hover:bg-white/10 hover:text-paper-50",
=======
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      pathname === to
                        ? "bg-[#C9A34A] text-[#16323E] font-semibold"
                        : "text-[#c4d8cb] hover:bg-white/10",
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
                    )}
                  >
                    {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm bg-brass" aria-hidden="true" />}
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
<<<<<<< HEAD
=======
          ))}
        </nav>
        <div className="p-4 space-y-3 border-t border-white/10 shrink-0">
          {role != null && STAFF.includes(role) && (
            <div className="flex gap-2">
              <Link
                to="/foundry"
                className="flex-1 text-center rounded-md border border-[#C9A34A]/40 px-2 py-1.5 text-[11px] text-[#C9A34A] hover:bg-[#C9A34A]/10 transition-colors"
              >
                Flavor Foundry
              </Link>
              <Link
                to="/lotspace"
                className="flex-1 text-center rounded-md border border-[#C9A34A]/40 px-2 py-1.5 text-[11px] text-[#C9A34A] hover:bg-[#C9A34A]/10 transition-colors"
              >
                LotSpace
              </Link>
            </div>
          )}
          {user && (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{user.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-[#7fa48e]">
                  {ROLE_LABELS[user.role]}
                </div>
              </div>
              <button
                onClick={() => logout.mutate()}
                title="Sign out"
                className="rounded-md p-2 text-[#c4d8cb] hover:bg-white/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="text-[10px] text-[#7fa48e] leading-relaxed">
            Navigate Your Reality.
            <br />
            Own Your Journey.
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
          </div>
        ))}
      </nav>
      <div className="p-3 space-y-3 border-t border-white/10 shrink-0">
        {user && (
          <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate text-paper-50">{user.name}</div>
              {!collapsed && (
                <div className="text-[10px] uppercase tracking-widest text-[#7E8D7F]">{ROLE_LABELS[user.role]}</div>
              )}
            </div>
            <button
              onClick={() => logout.mutate()}
              title="Sign out"
              className="rounded-md p-2 text-paper-50/70 hover:bg-white/10 hover:text-paper-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-max focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-paper-50"
      >
        Skip to content
      </a>

      {/* Mobile scrim */}
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-overlay bg-ink/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={cn("fixed inset-y-0 left-0 flex-col bg-sidebar text-sidebar-foreground", collapsed ? "w-[72px]" : "w-[264px]", "hidden lg:flex z-sticky transition-[width] duration-base")}>
        {sidebarInner}
      </aside>

      <aside key={pathname} className={cn("fixed inset-y-0 left-0 flex-col bg-sidebar text-sidebar-foreground w-[264px] z-sticky lg:hidden transition-transform duration-slow", mobileOpen ? "transform-none" : "-translate-x-full")}>
        {sidebarInner}
      </aside>

      <div className={cn("transition-[padding] duration-base", collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]")}>
        <header className="sticky top-0 z-sticky h-16 bg-surface border-b border-border flex items-center gap-3 px-4 lg:px-6">
          <button
            className="lg:hidden rounded-md p-2 text-muted hover:bg-recessed"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            className="hidden lg:inline-flex rounded-md p-2 text-muted hover:bg-recessed"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((c) => !c)}
          >
            <PanelLeft className="h-5 w-5" />
          </button>

          <div className="hidden md:flex items-center gap-2 text-sm min-w-0">
            {crumb.group && <span className="text-muted">{crumb.group}</span>}
            {crumb.group && <span className="text-subtle">/</span>}
            <span className="text-ink font-medium">{crumb.page}</span>
          </div>

          <div className="relative ml-auto w-full max-w-xs">
            <button
              ref={openCmdKRef}
              onClick={() => {
                setSearchOpen(true);
                setTimeout(() => searchRef.current?.focus(), 50);
              }}
              className="flex w-full items-center gap-2 rounded-md border border-neutral-400 bg-background px-3 h-9 text-sm text-muted-foreground hover:border-neutral-600 focus-visible:border-oxblood focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-1 focus-visible:outline-none"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left truncate text-muted-foreground/80">Search lots, origins, roasters…</span>
              <kbd className="hidden sm:inline-flex rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted">⌘K</kbd>
            </button>
            {searchOpen && (
              <>
                <div className="fixed inset-0 z-dropdown" onClick={() => { setSearchOpen(false); setQuery(""); }} />
                <div className="absolute right-0 left-0 top-full mt-1 z-dropdown rounded-lg border border-border bg-popover shadow-e4 p-1.5">
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setSearchOpen(false); setQuery(""); }
                    }}
                    placeholder="Type a lot, origin, or region…"
                    className="h-9 w-full rounded-md border border-neutral-300 bg-background px-3 text-sm outline-none focus-visible:border-oxblood"
                  />
                  <div className="mt-1.5 space-y-0.5 max-h-72 overflow-y-auto">
                    {results.map((l) => (
                      <button
                        key={l.id}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-recessed"
                        onClick={() => { navigate("/catalog"); setSearchOpen(false); setQuery(""); }}
                      >
                        <span className="truncate text-ink">{l.name}</span>
                        <span className="shrink-0 font-mono text-xs text-muted">{l.cupScore.toFixed(1)}</span>
                      </button>
                    ))}
                    {query.trim() && results.length === 0 && (
                      <p className="px-2.5 py-2 text-sm text-muted-foreground">No matches.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={theme.toggle}
            aria-pressed={theme.dark}
            title={theme.dark ? "Switch to paper" : "Switch to ink"}
            className="rounded-md p-2 text-muted hover:bg-recessed focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:outline-none"
          >
            {theme.dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <Link
            to="/analytics"
            title="Churn watchlist"
            className="relative rounded-md p-2 text-muted hover:bg-recessed"
          >
            <Bell className="h-5 w-5" />
            {dangerCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] text-white">
                {dangerCount}
              </span>
            )}
          </Link>

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper-50 font-mono text-xs font-semibold" title={user?.name}>
            {initials}
          </div>
        </header>

        <main id="main" className="mx-auto max-w-[1280px] px-4 lg:px-6 py-6 lg:py-8">
          {children}
        </main>
      </div>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}

<<<<<<< HEAD
export function PageHeader({
  title,
  sub,
  actions,
  overline,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
  overline?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {overline && <div className="folio mb-1.5">{overline}</div>}
        <h1 className="font-display text-3xl tracking-[-0.015em] text-ink">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1.5">{sub}</p>}
=======
/**
 * `kicker` is the folio overline — the small caps line above a title, and the
 * same typographic role the Trust panel uses for its band label. Partners and
 * QC Lab were already passing one; it was being dropped on the floor, so their
 * authored text never appeared. Rendering it is the fix, not removing it.
 */
export function PageHeader({
  kicker,
  title,
  endorsement,
  sub,
  actions,
}: {
  kicker?: string;
  title: string;
  /**
   * Endorsement line for a product label sitting under the master brand
   * (master plan §06). Rendered at half the title's optical size, inside the
   * same heading, because "Flavor Foundry" is not a brand on its own — it is a
   * label endorsed by Auctum, and setting it at the same weight as the master
   * mark is exactly the house-of-brands drift the rebrand retired.
   */
  endorsement?: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {kicker && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {kicker}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight">
          {title}
          {endorsement && (
            <span className="ml-2 align-baseline text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {endorsement}
            </span>
          )}
        </h1>
        {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}