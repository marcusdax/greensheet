import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gift, Plus, Sparkles, MousePointerClick, ListChecks } from "lucide-react";
import { toast } from "sonner";

const REFERRAL_STATUS: Record<string, string> = {
  signed_up: "bg-info-soft text-info",
  kit_sent: "bg-warning-soft text-warning",
  rewarded: "bg-success-soft text-success",
};

const POST_STATUS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-warning-soft text-warning",
  published: "bg-success-soft text-success",
};

const PILLAR_LABEL: Record<string, string> = {
  "POS-01": "Value Before Tasting",
  "POS-02": "Price Is Signal, Not Verdict",
  "POS-03": "Coffee Is Infrastructure",
  "POS-04": "Reinvest, Not Extract",
};

export default function Growth() {
<<<<<<< HEAD
=======
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
                {product === "foundry" ? "Flavor Foundry" : "LotSpace"} by Auctum waitlist
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
            <SelectItem value="foundry">Flavor Foundry by Auctum</SelectItem>
            <SelectItem value="lotspace">LotSpace by Auctum</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <WaitlistForm product={product} dark={false} />
    </div>
  );
}

function ReferralsSection() {
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
  const utils = trpc.useUtils();
  const { data: roasters } = trpc.crm.list.useQuery();
  const { data: referrals } = trpc.growth.referrals.useQuery();
  const { data: waitlist } = trpc.growth.waitlist.useQuery();
  const { data: posts } = trpc.growth.marketingCalendar.useQuery();
  const { data: clicks } = trpc.growth.pricingClicks.useQuery();
  const advance = trpc.growth.advanceReferral.useMutation({
    onSuccess: () => {
      utils.growth.referrals.invalidate();
      toast.success("Referral advanced");
    },
    onError: (e) => toast.error(e.message),
  });

  const setPostStatus = trpc.growth.setPostStatus.useMutation({
    onSuccess: () => {
      utils.growth.marketingCalendar.invalidate();
      toast.success("Post status updated");    },
    onError: (e) => toast.error(e.message),
  });

  const postsByWeek = (posts ?? []).reduce<Record<number, typeof posts>>((acc, p) => {
    (acc[p.week] ??= []).push(p);
    return acc;
  }, {});

  return (
    <Layout>
      <PageHeader
        title="Growth"
        sub={'"Give a Kit, Get a Bag" referral engine, POS-01â€“POS-04 marketing calendar, and pricing-link telemetry'}
        actions={<CreateReferralDialog roasters={roasters ?? []} onDone={() => utils.growth.referrals.invalidate()} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <div className="font-display text-[1.6rem] font-semibold leading-none">{waitlist?.counts.foundry ?? 0}</div>
              <div className="text-xs text-muted-foreground">Flavor Foundry waitlist</div>
            </div>
            <Sparkles className="h-6 w-6 text-gold" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <div className="font-display text-[1.6rem] font-semibold leading-none">{waitlist?.counts.lotspace ?? 0}</div>
              <div className="text-xs text-muted-foreground">LotSpace waitlist</div>
            </div>
            <Sparkles className="h-6 w-6 text-gold" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <div className="font-display text-[1.6rem] font-semibold leading-none">{referrals?.filter((r) => r.status === "rewarded").length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Referrals rewarded</div>
            </div>
            <Gift className="h-6 w-6 text-navy" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-4 w-4" /> Give a Kit, Get a Bag â€” referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referred</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(referrals ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="text-sm">{r.referrerName}</TableCell>
                    <TableCell className="text-sm">{r.referredName}</TableCell>
                    <TableCell>
                      <Badge className={REFERRAL_STATUS[r.status]}>{r.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.rewardNote || "â€”"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status === "signed_up" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advance.mutate({ referralId: r.id, target: "kit_sent" })}>
                            Mark kit sent
                          </Button>
                        )}
                        {r.status === "kit_sent" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advance.mutate({ referralId: r.id, target: "rewarded" })}>
                            Mark rewarded
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(referrals ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      No referrals yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" /> Marketing calendar â€” POS-01â€¦04 social series
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4].map((week) =>
              postsByWeek[week]?.length ? (
                <div key={week}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Week {week}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {postsByWeek[week]!.map((p) => (
                      <div key={p.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline">{p.pillar}</Badge>
                          <Select value={p.status} onValueChange={(v) => setPostStatus.mutate({ postId: p.id, status: v as "draft" | "scheduled" | "published" })}>
                            <SelectTrigger className="h-6 w-28 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-sm font-medium">{p.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{PILLAR_LABEL[p.pillar] ?? ""} Â· {p.channel}</div>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{p.body}</p>
                        <Badge className={`${POST_STATUS[p.status]} mt-2`}>{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
            {(posts ?? []).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">No marketing posts scheduled yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MousePointerClick className="h-4 w-4" /> Pricing-link clicks (COF-004 trigger)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roaster</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Clicked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(clicks ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{c.roasterName}</TableCell>
                    <TableCell className="text-sm">{c.lotName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {(clicks ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                      No pricing-link clicks recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function CreateReferralDialog({
  roasters,
  onDone,
}: {
  roasters: { id: number; roasterName: string }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [referrerRoasterId, setReferrerRoasterId] = useState("");
  const [referredRoasterId, setReferredRoasterId] = useState("");

  const create = trpc.growth.createReferral.useMutation({
    onSuccess: (r) => {
      toast.success(`Referral ${r.code} created`);
      setOpen(false);
      setReferrerRoasterId("");
      setReferredRoasterId("");
      onDone();    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-navy hover:bg-navy-800">
          <Plus className="h-4 w-4 mr-1" /> New referral
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give a Kit, Get a Bag â€” new referral</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Referring roaster</label>
            <Select value={referrerRoasterId} onValueChange={setReferrerRoasterId}>
              <SelectTrigger>
                <SelectValue placeholder="Select referrer" />
              </SelectTrigger>
              <SelectContent>
                {roasters.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.roasterName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Referred roaster</label>
            <Select value={referredRoasterId} onValueChange={setReferredRoasterId}>
              <SelectTrigger>
                <SelectValue placeholder="Select referred" />
              </SelectTrigger>
              <SelectContent>
                {roasters.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.roasterName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full bg-navy hover:bg-navy-800"
            disabled={create.isPending || !referrerRoasterId || !referredRoasterId || referrerRoasterId === referredRoasterId}
            onClick={() => create.mutate({ referrerRoasterId: Number(referrerRoasterId), referredRoasterId: Number(referredRoasterId) })}
          >
            Create referral
          </Button>
        </div>
      </DialogContent>
    </Dialog>  );
}
