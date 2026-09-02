<<<<<<< HEAD
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import WaitlistForm from "@/components/WaitlistForm";
import { Boxes, Repeat, Users, Compass } from "lucide-react";

const FEATURES = [
  { icon: Compass, name: "Sovereign Spaces", desc: "Every farm, roaster, and café keeps a data-rich Space — identity, shopfront, and income ledger in one page." },
  { icon: Boxes, name: "The live offer board", desc: "Surplus and micro-lot inventory listed the moment it's cut loose, priced against the verified ledger." },
  { icon: Repeat, name: "Trade on the graph", desc: "Follow farms, swap allocations roaster-to-roaster, and route every deal back through the transaction rails." },
];

export default function Lotspace() {
  const { data: waitlist } = trpc.growth.waitlist.useQuery();

  return (
    <Layout>
      <PageHeader
        title="LotSpace"
        sub="Internal preview of the public teaser page — the social layer of the verified ledger"
      />

      <div
        className="relative overflow-hidden rounded-2xl text-parchment-100 p-10 mb-6"
        style={{ background: "linear-gradient(160deg, #16323E 0%, #0E1A22 100%)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(640px circle at 88% -12%, rgba(201, 163, 74, 0.14), transparent 60%)" }}
        />
        <div className="relative">
          <span className="inline-block rounded-full border border-gold/30 bg-gold/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-300 mb-5">
            Coming soon
          </span>
          <h2 className="font-display text-[2.2rem] font-semibold leading-[1.15] tracking-[-0.015em] text-parchment-50 mb-4 max-w-2xl">
            Every farm a Space. Every lot a ledger. Every cup a connection.
          </h2>
          <p className="text-parchment-100/70 max-w-2xl mb-8 leading-relaxed">
            LotSpace is the offer sheet, made social — an open network layered on the verified Greensheet
            ledger where farmers, collectors, roasters, and drinkers connect directly and trade against the
            same source of truth. The farmer's name is the brand; the lot is the ledger.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-9">
            {FEATURES.map((f) => (
              <div
                key={f.name}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 ease-standard hover:bg-white/[0.07] hover:border-gold/30 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <f.icon className="h-4 w-4 text-gold-300" />
                  <span className="font-display text-[1.05rem] font-semibold text-parchment-50">{f.name}</span>
                </div>
                <p className="text-xs text-parchment-100/65 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="max-w-md">
            <WaitlistForm product="lotspace" dark />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-center gap-4">
          <Boxes className="h-8 w-8 text-gold shrink-0" />
          <div>
            <div className="font-display text-[1.6rem] font-semibold leading-none">{waitlist?.counts.lotspace ?? 0}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
              <Users className="h-3 w-3" /> roasters on the LotSpace waitlist
            </div>
          </div>
        </CardContent>
      </Card>
=======
import Layout, { PageHeader } from "@/components/Layout";
import WaitlistForm from "@/components/WaitlistForm";
import { Boxes } from "lucide-react";

export default function Lotspace() {
  return (
    <Layout>
      <PageHeader title="Lotspace" sub="Shared verified-lot marketplace — coming soon" />
      <div className="rounded-xl bg-[#16382a] text-[#eaf2ec] p-10 max-w-2xl">
        <Boxes className="h-10 w-10 text-[#d9a441]" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">
          Split verified lots with roasters you trust.
        </h2>
        <p className="mt-3 text-sm text-[#c4d8cb] leading-relaxed max-w-prose">
          Lotspace lets smaller roasters pool demand on full-container verified lots —
          shared freight, transparent splits, and the same ledger-backed lot record for
          every participant. Early access opens to the waitlist first.
        </p>
        <div className="mt-8 max-w-md">
          <WaitlistForm product="lotspace" />
        </div>
      </div>
>>>>>>> 74655d4a8597236534be742336bb3a80b4bbd80f
    </Layout>
  );
}
