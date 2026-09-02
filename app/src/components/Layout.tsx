import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Coffee,
  Users,
  Package,
  Megaphone,
  ShoppingCart,
  Receipt,
  Banknote,
  Compass,
  Warehouse as WarehouseIcon,
  FlaskConical,
  Handshake,
  Send,
  GraduationCap,
  Rocket,
  LogOut,
  BarChart3,
  ScanLine,
  HandCoins,
  CalendarClock,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth";
import { trpc } from "@/providers/trpc";
import { ROLE_LABELS, type UserRole } from "@contracts/constants";
import type { ReactNode } from "react";

const STAFF: UserRole[] = ["platform_admin", "ops_manager"];
const ALL_ROLES: UserRole[] = ["platform_admin", "ops_manager", "sales_csm", "analyst", "roaster_buyer"];
const READERS: UserRole[] = ["platform_admin", "ops_manager", "sales_csm", "analyst"];

const NAV_GROUPS: {
  label: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard; roles: UserRole[] }[];
}[] = [
  {
    label: "Trade",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: READERS },
      { to: "/catalog", label: "Catalog", icon: Coffee, roles: ALL_ROLES },
      { to: "/orders", label: "Orders", icon: ShoppingCart, roles: ALL_ROLES },
      { to: "/invoices", label: "Invoices", icon: Receipt, roles: [...READERS, "roaster_buyer"] },
      { to: "/payments", label: "Payments & AR", icon: Banknote, roles: [...STAFF, "analyst"] },
      { to: "/collections", label: "Collections & FX", icon: HandCoins, roles: [...STAFF, "sales_csm", "analyst"] },
      { to: "/subscriptions", label: "Standing Orders", icon: CalendarClock, roles: [...STAFF, "sales_csm", "analyst"] },
    ],
  },
  {
    label: "Intelligence",
    items: [{ to: "/analytics", label: "Analytics", icon: BarChart3, roles: READERS }],
  },
  {
    label: "Relationships",
    items: [
      { to: "/crm", label: "CRM", icon: Users, roles: READERS },
      { to: "/samples", label: "Sample Kits", icon: Package, roles: [...STAFF, "sales_csm", "roaster_buyer"] },
      { to: "/campaigns", label: "Campaigns", icon: Megaphone, roles: STAFF },
      { to: "/comms", label: "Comms", icon: Send, roles: STAFF },
      { to: "/growth", label: "Growth", icon: Rocket, roles: STAFF },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/warehouse", label: "Warehouse", icon: WarehouseIcon, roles: STAFF },
      { to: "/intake", label: "Doc Intake", icon: ScanLine, roles: STAFF },
      { to: "/qc", label: "QC Lab", icon: FlaskConical, roles: STAFF },
      { to: "/partners", label: "Partners", icon: Handshake, roles: STAFF },
      { to: "/education", label: "Education", icon: GraduationCap, roles: ALL_ROLES },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSettled: async () => {
      await utils.invalidate();
      navigate("/login", { replace: true });
    },
  });

  const role = user?.role;
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => role != null && item.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
       <aside className="fixed inset-y-0 left-0 w-60 border-r border-white/10 bg-[#16323E] text-[#F6F1E7] flex flex-col">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 shrink-0">
          <Compass className="h-6 w-6 text-[#C9A34A]" />
          <div>
            <div className="font-bold tracking-tight leading-none font-display">Greensheet</div>
            <div className="text-[10px] uppercase tracking-widest text-[#9fc0ab] mt-1">
              ODASI Technologies
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-[#7fa48e]">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      pathname === to
                        ? "bg-[#C9A34A] text-[#16323E] font-semibold"
                        : "text-[#c4d8cb] hover:bg-white/10",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
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
                Lotspace
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
          </div>
        </div>
      </aside>
      <main className="ml-60 p-8 max-w-[1400px]">{children}</main>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
