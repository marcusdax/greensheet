import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Coffee,
  Users,
  Package,
  Megaphone,
  ShoppingCart,
  Compass,
  Warehouse as WarehouseIcon,
  FlaskConical,
  Handshake,
  Send,
  GraduationCap,
  Rocket,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const NAV_GROUPS: { label: string; items: { to: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Trade",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/catalog", label: "Catalog", icon: Coffee },
      { to: "/orders", label: "Orders", icon: ShoppingCart },
    ],
  },
  {
    label: "Relationships",
    items: [
      { to: "/crm", label: "CRM", icon: Users },
      { to: "/samples", label: "Sample Kits", icon: Package },
      { to: "/campaigns", label: "Campaigns", icon: Megaphone },
      { to: "/comms", label: "Comms", icon: Send },
      { to: "/growth", label: "Growth", icon: Rocket },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/warehouse", label: "Warehouse", icon: WarehouseIcon },
      { to: "/qc", label: "QC Lab", icon: FlaskConical },
      { to: "/partners", label: "Partners", icon: Handshake },
      { to: "/education", label: "Education", icon: GraduationCap },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className="fixed inset-y-0 left-0 w-64 flex flex-col text-parchment-100"
        style={{ background: "linear-gradient(172deg, #12252F 0%, #0E1A22 100%)" }}
      >
        {/* Gold hairline along the ledger's edge */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-gold/50 via-gold/15 to-transparent"
        />

        <Link to="/" className="flex items-center gap-3 px-5 h-[4.5rem] border-b border-white/10 shrink-0 group">
          <Compass className="h-7 w-7 text-gold shrink-0 transition-transform duration-500 ease-compass group-hover:rotate-45" />
          <div>
            <div className="font-display text-[1.3rem] font-semibold leading-none tracking-tight text-parchment-50">
              Auctum <span className="text-gold-300">Ledger</span>
            </div>
            <div className="mt-1.5 text-[9px] uppercase tracking-[0.24em] text-parchment-100/40">
              Greensheet Platform
            </div>
          </div>
        </Link>

        <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-parchment-100/35">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => {
                  const active = pathname === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-all duration-200 ease-out",
                        active
                          ? "bg-white/[0.07] text-gold-300 shadow-[inset_2px_0_0_0_#D4B96A]"
                          : "text-parchment-100/65 hover:bg-white/[0.05] hover:text-parchment-50 hover:translate-x-[2px]",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 transition-colors duration-200", active && "text-gold-300")} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 space-y-3 border-t border-white/10 shrink-0">
          <div className="flex gap-2">
            <Link
              to="/foundry"
              className="flex-1 text-center rounded-lg border border-gold/25 px-2 py-1.5 text-[11px] tracking-wide text-gold-300/90 transition-all duration-200 hover:border-gold/50 hover:bg-gold/10 hover:text-gold-300"
            >
              Flavor Foundry
            </Link>
            <Link
              to="/lotspace"
              className="flex-1 text-center rounded-lg border border-gold/25 px-2 py-1.5 text-[11px] tracking-wide text-gold-300/90 transition-all duration-200 hover:border-gold/50 hover:bg-gold/10 hover:text-gold-300"
            >
              LotSpace
            </Link>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.28em] text-gold/70">Auctum</div>
            <div className="mt-1.5 text-[10.5px] leading-relaxed text-parchment-100/40">
              Every lot a ledger.
              <br />
              Every cup a connection.
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-64 px-10 py-9 max-w-[1440px]">
        <div key={pathname} className="animate-page-enter">
          {children}
        </div>
      </main>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-[1.95rem] font-semibold leading-tight tracking-[-0.015em]">{title}</h1>
          {sub && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{sub}</p>}
        </div>
        {actions && <div className="flex gap-2 shrink-0 pt-1">{actions}</div>}
      </div>
      <div className="gold-rule mt-5" />
    </div>
  );
}

export function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
