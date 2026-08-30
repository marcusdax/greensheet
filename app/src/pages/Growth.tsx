import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import WaitlistForm from "@/components/WaitlistForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MARKETING_PILLARS } from "@contracts/constants";
import { Rocket, Plus, MousePointerClick } from "lucide-react";
import { toast } from "sonner";

const SECTIONS = ["Waitlists", "Referrals", "Calendar", "Pricing clicks"] as const;
type Section = (typeof SECTIONS)[number];

const REFERRAL_BADGE: Record<string, string> = {
  signed_up: "bg-muted text-foreground",
  kit_sent: "bg-[#d9a441] text-[#16382a]",
  rewarded: "bg-[#2f6b4a] text-white",
};

export default function Growth() {
  const [section, setSection] = useState<Section>("Waitlists");

  return (
    <Layout>
      <PageHeader
        title="Growth"
        sub="Teaser waitlists, the referral engine, the POS-01…04 calendar, and COF-004 pricing clicks"
        actions={
          <div className="flex rounded-md border border-border overflow-hidden">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  section === s ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      />
      {section === "Waitlists" && <WaitlistsSection />}
      {section === "Referrals" && <ReferralsSection />}
      {section === "Calendar" && <CalendarSection />}
      {section === "Pricing clicks" && <PricingClicksSection />}
    </Layout>
  );
}

function WaitlistsSection() {
  const { data } = trpc.growth.waitlist.useQuery();
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        {(["foundry", "lotspace"] as const).map((product) => (
          <Card key={product}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {product === "foundry" ? "Flavor Foundry" : "Lotspace"} waitlist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data?.counts[product] ?? "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">signups</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Signups</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Manual add</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>JoinWaitlist — manual entry</DialogTitle></DialogHeader>
              <ManualWaitlistAdd />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {data?.signups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No signups yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Interest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.signups.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><Badge variant="outline">{s.product}</Badge></TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    <TableCell className="text-muted-foreground">{s.company || "—"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[240px] truncate">{s.interest || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ManualWaitlistAdd() {
  const [product, setProduct] = useState<"foundry" | "lotspace">("foundry");
  return (
    <div className="space-y-3">
      <div>
        <Label>Product</Label>
        <Select value={product} onValueChange={(v) => setProduct(v as typeof product)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="foundry">Flavor Foundry</SelectItem>
            <SelectItem value="lotspace">Lotspace</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <WaitlistForm product={product} dark={false} />
    </div>
  );
}

function ReferralsSection() {
  const utils = trpc.useUtils();
  const { data: rows } = trpc.growth.referrals.useQuery();
  const { data: roasters } = trpc.crm.list.useQuery();
  const [open, setOpen] = useState(false);
  const [referrerId, setReferrerId] = useState<string>("");
  const [referredId, setReferredId] = useState<string>("");

  const create = trpc.growth.createReferral.useMutation({
    onSuccess: (r) => {
      utils.growth.referrals.invalidate();
      setOpen(false);
      toast.success(`Referral ${r.code} created — growth.referral_created emitted`);
    },
    onError: (e) => toast.error(e.message),
  });
  const advance = trpc.growth.advanceReferral.useMutation({
    onSuccess: () => {
      utils.growth.referrals.invalidate();
      toast.success("Referral advanced");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">"Give a Kit, Get a Bag"</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Create referral</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>CreateReferral</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Referrer roaster</Label>
                <Select value={referrerId} onValueChange={setReferrerId}>
                  <SelectTrigger><SelectValue placeholder="Who is referring?" /></SelectTrigger>
                  <SelectContent>
                    {roasters?.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.roasterName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Referred roaster</Label>
                <Select value={referredId} onValueChange={setReferredId}>
                  <SelectTrigger><SelectValue placeholder="Who joins?" /></SelectTrigger>
                  <SelectContent>
                    {roasters?.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.roasterName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={!referrerId || !referredId || create.isPending}
                onClick={() =>
                  create.mutate({ referrerRoasterId: Number(referrerId), referredRoasterId: Number(referredId) })
                }
              >
                {create.isPending ? "Creating…" : "Create referral"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows?.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No referrals yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Referrer</TableHead>
                <TableHead>Referred</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead className="text-right">Advance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.referrerName}</TableCell>
                  <TableCell>{r.referredName}</TableCell>
                  <TableCell><Badge className={REFERRAL_BADGE[r.status]}>{r.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{r.rewardNote || "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "signed_up" && (
                      <Button size="sm" variant="outline" onClick={() => advance.mutate({ referralId: r.id, target: "kit_sent" })}>
                        Kit sent
                      </Button>
                    )}
                    {r.status === "kit_sent" && (
                      <Button size="sm" onClick={() => advance.mutate({ referralId: r.id, target: "rewarded" })}>
                        Reward both
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CalendarSection() {
  const utils = trpc.useUtils();
  const { data: posts } = trpc.growth.marketingCalendar.useQuery();
  const setStatus = trpc.growth.setPostStatus.useMutation({
    onSuccess: () => {
      utils.growth.marketingCalendar.invalidate();
      toast.success("Post status updated — growth.post_status_changed emitted");
    },
    onError: (e) => toast.error(e.message),
  });

  const pillarMap = new Map<string, (typeof MARKETING_PILLARS)[number]>(
    MARKETING_PILLARS.map((p) => [p.code, p]),
  );
  const weeks = [...new Set(posts?.map((p) => p.week) ?? [])].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      {weeks.map((week) => (
        <Card key={week}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Week {week}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {posts
              ?.filter((p) => p.week === week)
              .map((p) => {
                const pillar = pillarMap.get(p.pillar);
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                    <span
                      className="shrink-0 rounded px-2 py-0.5 text-[11px] font-mono text-white"
                      style={{ backgroundColor: pillar?.color ?? "#5B6A5F" }}
                      title={pillar?.name}
                    >
                      {p.pillar}
                    </span>
                    <Badge variant="outline" className="shrink-0">{p.channel}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.body}</div>
                    </div>
                    <Select
                      value={p.status}
                      onValueChange={(v) => setStatus.mutate({ postId: p.id, status: v as "draft" | "scheduled" | "published" })}
                    >
                      <SelectTrigger className="w-[130px] shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      ))}
      {posts?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No calendar posts seeded — run <code>npm run db:seed:expansion</code>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PricingClicksSection() {
  const utils = trpc.useUtils();
  const { data: clicks } = trpc.growth.pricingClicks.useQuery();
  const { data: roasters } = trpc.crm.list.useQuery();
  const { data: lots } = trpc.catalog.list.useQuery();
  const [open, setOpen] = useState(false);
  const [roasterId, setRoasterId] = useState<string>("");
  const [lotId, setLotId] = useState<string>("");

  const track = trpc.growth.trackPricingClick.useMutation({
    onSuccess: () => {
      utils.growth.pricingClicks.invalidate();
      setOpen(false);
      toast.success("Click tracked — campaigns.link_clicked emitted (COF-004 trigger)");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">COF-004 pricing-link clicks</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <MousePointerClick className="h-3.5 w-3.5 mr-1" /> Simulate click
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>TrackPricingClick</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Roaster</Label>
                <Select value={roasterId} onValueChange={setRoasterId}>
                  <SelectTrigger><SelectValue placeholder="Roaster" /></SelectTrigger>
                  <SelectContent>
                    {roasters?.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.roasterName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lot</Label>
                <Select value={lotId} onValueChange={setLotId}>
                  <SelectTrigger><SelectValue placeholder="Lot" /></SelectTrigger>
                  <SelectContent>
                    {lots?.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Emits the byte-identical <code>campaigns.link_clicked</code> event the COF-004 rule reacts to.
              </p>
              <Button
                className="w-full"
                disabled={!roasterId || !lotId || track.isPending}
                onClick={() => track.mutate({ roasterId: Number(roasterId), lotId: Number(lotId) })}
              >
                {track.isPending ? "Tracking…" : "Track click"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {clicks?.length === 0 ? (
          <div className="py-8 text-center">
            <Rocket className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No pricing clicks recorded yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roaster</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clicks?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.roasterName}</TableCell>
                  <TableCell>{c.lotName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
