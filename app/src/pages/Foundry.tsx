<<<<<<< HEAD
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import WaitlistForm from "@/components/WaitlistForm";
import { FlaskConical, Sparkles, Users } from "lucide-react";

const TIERS = [
  { code: "HOUSE", name: "House", desc: "Our standing washed / natural / honey menu, ready to ship on any lot." },
  { code: "SEMI", name: "Semi-Custom", desc: "Pick a base process family and dial in fermentation time, temperature, and inoculant." },
  { code: "DE NOVO", name: "De Novo", desc: "Fully bespoke protocol co-designed with our lab, run exclusively for one roaster." },
];

export default function Foundry() {
  const { data: waitlist } = trpc.growth.waitlist.useQuery();

  return (
    <Layout>
      <PageHeader
        title="Flavor Foundry"
        sub="Internal preview of the public teaser page — coming-soon micro-lot processing menu"
      />

      <div
        className="relative overflow-hidden rounded-2xl text-parchment-100 p-10 mb-6"
        style={{ background: "linear-gradient(160deg, #16323E 0%, #0E1A22 100%)" }}
      >
        {/* Earned-gold glow, top right — decorative */}
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
            13 process families. 110 processes. Your cup, engineered.
          </h2>
          <p className="text-parchment-100/70 max-w-2xl mb-8 leading-relaxed">
            Flavor Foundry lets roasters commission a specific fermentation and drying protocol on a reserved
            micro-lot — not just buy what's on the shelf. Explore 14 sensory families across three commitment
            tiers, from our standing House menu to a fully De Novo protocol built with our lab.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-9">
            {TIERS.map((t) => (
              <div
                key={t.code}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 ease-standard hover:bg-white/[0.07] hover:border-gold/30 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical className="h-4 w-4 text-gold-300" />
                  <span className="font-display text-[1.05rem] font-semibold text-parchment-50">{t.name}</span>
                </div>
                <p className="text-xs text-parchment-100/65 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
          <div className="max-w-md">
            <WaitlistForm product="foundry" dark />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-center gap-4">
          <Sparkles className="h-8 w-8 text-gold shrink-0" />
          <div>
            <div className="font-display text-[1.6rem] font-semibold leading-none">{waitlist?.counts.foundry ?? 0}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
              <Users className="h-3 w-3" /> roasters on the Flavor Foundry waitlist
            </div>
          </div>
        </CardContent>
      </Card>
=======
import Layout, { PageHeader } from "@/components/Layout";
import WaitlistForm from "@/components/WaitlistForm";
import { FlaskConical } from "lucide-react";

export default function Foundry() {
  return (
    <Layout>
      <PageHeader title="Flavor Foundry" sub="Experimental processing collaborations — coming soon" />
      <div className="rounded-xl bg-[#16382a] text-[#eaf2ec] p-10 max-w-2xl">
        <FlaskConical className="h-10 w-10 text-[#d9a441]" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">
          Co-design lots with the producers who grow them.
        </h2>
        <p className="mt-3 text-sm text-[#c4d8cb] leading-relaxed max-w-prose">
          Flavor Foundry pairs roasters with origin partners to commission experimental
          fermentations and processing runs — with the economics on the sheet from day one.
          Early access opens to the waitlist first.
        </p>
        <div className="mt-8 max-w-md">
          <WaitlistForm product="foundry" />
        </div>
      </div>
>>>>>>> 74655d4a8597236534be742336bb3a80b4bbd80f
    </Layout>
  );
}
