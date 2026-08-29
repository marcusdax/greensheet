import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCentsPerLb, KIT_TRANSITIONS, type KitStatus } from "@contracts/constants";
import { Plus, Star, Truck, PackageCheck, Hammer, AlertOctagon, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL: Record<KitStatus, string> = {
  requested: "Requested",
  assembling: "Assembling",
  shipped: "Shipped",
  delivered: "Delivered",
  exception: "Exception",
  feedback_received: "Feedback received",
  feedback_stale: "Feedback stale",
};

export default function Samples() {
  const utils = trpc.useUtils();
  const { data: kits } = trpc.samples.list.useQuery();
  const { data: roasters } = trpc.crm.list.useQuery();
  const { data: lots } = trpc.catalog.list.useQuery();

  const [open, setOpen] = useState(false);
  const [roasterId, setRoasterId] = useState<string>("");
  const [picked, setPicked] = useState<number[]>([]);
  const [feedbackKit, setFeedbackKit] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState("");

  const invalidate = () => {
    utils.samples.list.invalidate();
    utils.crm.list.invalidate();
    utils.campaigns.dispatches.invalidate();
    utils.analytics.dashboard.invalidate();
  };

  const request = trpc.samples.request.useMutation({
    onSuccess: () => { invalidate(); setOpen(false); setPicked([]); setRoasterId(""); toast.success("Kit requested — samples.kit_requested"); },
    onError: (e) => toast.error(e.message),
  });
  const advance = trpc.samples.advance.useMutation({
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(
        v.target === "delivered"
          ? "sample_kit.delivered emitted — COF-001 Touch-1 dispatched"
          : `Kit moved to ${v.target}`,
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const submitFeedback = trpc.samples.submitFeedback.useMutation({
    onSuccess: (_d, v) => {
      invalidate();
      setFeedbackKit(null);
      setNotes("");
      setRating(5);
      toast.success(
        v.rating >= 4
          ? "feedback.submitted — COF-002 pricing email dispatched"
          : v.rating <= 2
            ? "feedback.submitted — COF-003 fired: lifecycle → needs_attention + SMS + intervention"
            : "feedback.submitted recorded",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const activeLots = lots?.filter((l) => l.status === "active") ?? [];

  return (
    <Layout>
      <PageHeader
        title="Sample Kit Fulfilment"
        sub="Requested → assembling → shipped → delivered → feedback · max 2 active kits per roaster · lot snapshots locked at assembly"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Request kit</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>RequestSampleKit</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Roaster</Label>
                  <Select value={roasterId} onValueChange={setRoasterId}>
                    <SelectTrigger><SelectValue placeholder="Select roaster" /></SelectTrigger>
                    <SelectContent>
                      {roasters?.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.roasterName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lots (1–5, snapshots taken at assembly)</Label>
                  <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                    {activeLots.map((l) => (
                      <label key={l.id} className="flex items-start gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={picked.includes(l.id)}
                          onCheckedChange={(c) =>
                            setPicked((p) => (c ? [...p, l.id].slice(0, 5) : p.filter((x) => x !== l.id)))
                          }
                        />
                        <span>
                          {l.name} <span className="text-muted-foreground">· {l.cupScore.toFixed(1)} SCA · {formatCentsPerLb(l.pricePerLbCents)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!roasterId || picked.length === 0 || request.isPending}
                  onClick={() => request.mutate({ roasterId: Number(roasterId), lotIds: picked })}
                >
                  Request kit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {kits?.map((kit) => (
          <Card key={kit.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Kit #{kit.id}</CardTitle>
                <Badge className="capitalize">{STATUS_LABEL[kit.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {kit.roasterName} · requested {new Date(kit.createdAt).toLocaleDateString()}
                {kit.trackingNumber && <> · <span className="font-mono">{kit.trackingNumber}</span></>}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-xs space-y-1">
                {kit.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span className="truncate">{i.lotName}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {i.cupScoreSnapshot.toFixed(1)} · {formatCentsPerLb(i.pricePerLbCentsSnapshot)}
                    </span>
                  </li>
                ))}
              </ul>

              {kit.feedback && (
                <div className="rounded-md bg-muted p-2 text-xs">
                  <div className="flex items-center gap-1 font-medium">
                    {Array.from({ length: kit.feedback.rating }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-[#d9a441] text-[#d9a441]" />
                    ))}
                    <span className="ml-1">{kit.feedback.rating}/5</span>
                  </div>
                  {kit.feedback.notes && <p className="mt-1 italic">{kit.feedback.notes}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {KIT_TRANSITIONS[kit.status].map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={t === "exception" ? "destructive" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => advance.mutate({ kitId: kit.id, target: t as "assembling" })}
                  >
                    {t === "assembling" && <Hammer className="h-3 w-3 mr-1" />}
                    {t === "shipped" && <Truck className="h-3 w-3 mr-1" />}
                    {t === "delivered" && <PackageCheck className="h-3 w-3 mr-1" />}
                    {t === "exception" && <AlertOctagon className="h-3 w-3 mr-1" />}
                    {t === "requested" && <RotateCcw className="h-3 w-3 mr-1" />}
                    → {STATUS_LABEL[t]}
                  </Button>
                ))}
                {kit.status === "delivered" && !kit.feedback && (
                  <Button size="sm" className="h-7 text-xs" onClick={() => setFeedbackKit(kit.id)}>
                    <Star className="h-3 w-3 mr-1" /> Submit feedback
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {kits?.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">No kits yet — request one to kick off the COF-001 nurture sequence.</p>
        )}
      </div>

      <Dialog open={feedbackKit !== null} onOpenChange={(o) => !o && setFeedbackKit(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>SubmitFeedback — Kit #{feedbackKit}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating (gates COF-002 ≥4 / COF-003 ≤2)</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)}>
                    <Star className={`h-7 w-7 ${n <= rating ? "fill-[#d9a441] text-[#d9a441]" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Cupping notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder=" sweetness, acidity, defects…" />
            </div>
            <Button
              className="w-full"
              disabled={submitFeedback.isPending}
              onClick={() => feedbackKit && submitFeedback.mutate({ kitId: feedbackKit, rating, notes })}
            >
              Submit feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
