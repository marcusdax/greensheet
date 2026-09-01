import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass, TrendingUp, CheckCircle2 } from "lucide-react";
import { money } from "@/components/Layout";

const VOLUME_TIERS = [
  { lbs: 500, discountPct: 5 },
  { lbs: 1000, discountPct: 8 },
  { lbs: 2000, discountPct: 12, label: "full pallet" },
];

export default function Pricing() {
  const [params] = useSearchParams();
  const roasterId = Number(params.get("roasterId"));
  const lotId = Number(params.get("lotId"));
  const valid = Number.isInteger(roasterId) && roasterId > 0 && Number.isInteger(lotId) && lotId > 0;

  const { data: roasters } = trpc.crm.list.useQuery();
  const { data: lots } = trpc.catalog.list.useQuery();
  const roaster = roasters?.find((r) => r.id === roasterId);
  const lot = lots?.find((l) => l.id === lotId);

  const track = trpc.growth.trackPricingClick.useMutation();
  const tracked = useRef(false);
  useEffect(() => {
    if (valid && !tracked.current) {
      tracked.current = true;
      track.mutate({ roasterId, lotId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, roasterId, lotId]);

  return (
    <div className="min-h-screen bg-parchment text-foreground">
      <header
        className="text-parchment-100"
        style={{ background: "linear-gradient(168deg, #16323E 0%, #0E1A22 100%)" }}
      >
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-3">
          <Compass className="h-6 w-6 text-gold" />
          <div>
            <div className="font-display text-lg font-semibold tracking-tight leading-none text-parchment-50">
              Auctum <span className="text-gold-300">Ledger</span>
            </div>
            <div className="text-[9px] uppercase tracking-[0.24em] text-parchment-100/45 mt-1">
              Greensheet Platform
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 animate-page-enter">
        {!valid || (roasters && !roaster) || (lots && !lot) ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              This pricing link is missing or no longer valid. Reach out to your Greensheet contact for current
              pricing.
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              {roaster ? `Hi ${roaster.contactName},` : "Hi,"}
            </p>
            <h1 className="font-display text-[2.3rem] font-semibold leading-[1.15] tracking-[-0.015em] mb-2">
              {lot?.name ?? "Loading pricing…"}
            </h1>
            {lot && (
              <p className="text-muted-foreground mb-9">
                {lot.origin} · {lot.varietal} · {lot.processMethod} · SCA {lot.cupScore}
              </p>
            )}

            {lot && (
              <Card className="mb-6 border-gold/40">
                <CardContent className="pt-6 flex items-center justify-between">
                  <div>
                    <div className="overline-label">Current price</div>
                    <div className="font-display text-[2.4rem] font-semibold leading-none mt-2">
                      {money(lot.pricePerLbCents)}
                      <span className="font-sans text-sm font-normal text-muted-foreground ml-1">/lb</span>
                    </div>
                  </div>
                  <Badge className="bg-navy text-parchment-50 font-mono">
                    {lot.availableLbs.toLocaleString()} lbs available
                  </Badge>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-gold-600" />
                  <span className="text-sm font-semibold">Volume discounts unlock as you scale</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {VOLUME_TIERS.map((t) => (
                    <div
                      key={t.lbs}
                      className="rounded-xl border border-border p-4 text-center transition-all duration-300 ease-standard hover:border-gold/50 hover:shadow-card-hover hover:-translate-y-0.5"
                    >
                      <div className="font-display text-2xl font-semibold text-navy">{t.discountPct}%</div>
                      <div className="text-xs text-muted-foreground mt-1.5 font-mono">
                        {t.lbs.toLocaleString()} lbs{t.label ? ` (${t.label})` : ""}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-5 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  Reply to your Greensheet contact to lock a volume tier before this allocation moves.
                </p>
              </CardContent>
            </Card>

            {lot?.flavorNotes && (
              <p className="font-display text-[1.05rem] italic text-muted-foreground mt-9 text-center">
                "{lot.flavorNotes}"
              </p>
            )}

            <div className="mt-12 pt-6 border-t border-border text-center">
              <div className="text-[9px] uppercase tracking-[0.28em] text-gold-600/80">Auctum</div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Every lot a ledger. Every cup a connection.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
