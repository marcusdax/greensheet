import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, MessageCircle, MessageSquare, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-800",
  queued: "bg-amber-100 text-amber-800",
  halted: "bg-slate-200 text-slate-700",
  lifecycle_updated: "bg-sky-100 text-sky-800",
  converted: "bg-[#16382a] text-white",
};

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  crm: MessageSquare,
  system: MessageSquare,
};

export default function Comms() {
  const utils = trpc.useUtils();
  const { data: status } = trpc.comms.channelStatus.useQuery();
  const { data: templates } = trpc.comms.templates.useQuery();
  const { data: ledger } = trpc.comms.ledger.useQuery();
  const { data: roasterRows } = trpc.crm.list.useQuery();

  const [roasterId, setRoasterId] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [waLink, setWaLink] = useState<string | null>(null);

  const selectedRoaster = (roasterRows ?? []).find((r) => String(r.id) === roasterId);

  const applyTemplate = (code: string) => {
    setTemplateCode(code);
    const tpl = (templates ?? []).find((t) => t.code === code);
    if (!tpl) return;
    const rendered = tpl.body.replaceAll("{roaster_name}", selectedRoaster?.roasterName ?? "{roaster_name}");
    setBody(rendered);
    if (tpl.channel === "email" && !subject) setSubject(tpl.name);
  };

  const sendEmail = trpc.comms.sendEmail.useMutation({
    onSuccess: (r) => {
      toast[r.status === "sent" ? "success" : "info"](r.note);
      utils.comms.ledger.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendWhatsApp = trpc.comms.sendWhatsApp.useMutation({
    onSuccess: (r) => {
      setWaLink(r.link);
      toast.success("WhatsApp handoff queued — open the link to send");
      utils.comms.ledger.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Layout>
      <PageHeader title="Comms Dispatch" sub="Email + WhatsApp channels, templates, and the full dispatch ledger" />

      {/* Channel status */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {status &&
          ([
            ["Email", status.email, Mail],
            ["WhatsApp", status.whatsapp, MessageCircle],
            ["SMS", status.sms, MessageSquare],
          ] as const).map(([label, s, Icon]) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4" /> {label}
                  <Badge
                    className={
                      s.mode === "live"
                        ? "bg-emerald-100 text-emerald-800"
                        : s.mode === "deeplink"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-amber-100 text-amber-800"
                    }
                  >
                    {s.mode}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">{s.note}</CardContent>
            </Card>
          ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Compose */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Compose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Roaster</Label>
              <Select
                value={roasterId}
                onValueChange={(v) => {
                  setRoasterId(v);
                  setWaLink(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select roaster" />
                </SelectTrigger>
                <SelectContent>
                  {(roasterRows ?? []).map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.roasterName}
                      {r.whatsappNumber ? " · WA" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template</Label>
              <Select value={templateCode} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  {(templates ?? []).map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject (email)</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#16382a] hover:bg-[#1f4a38]"
                disabled={sendEmail.isPending || !roasterId || !subject.trim() || !body.trim()}
                onClick={() => sendEmail.mutate({ roasterId: Number(roasterId), subject, body })}
              >
                <Mail className="h-4 w-4 mr-1" /> Email
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={sendWhatsApp.isPending || !roasterId || !body.trim()}
                onClick={() => sendWhatsApp.mutate({ roasterId: Number(roasterId), body })}
              >
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              </Button>
            </div>
            {selectedRoaster && !selectedRoaster.whatsappNumber && (
              <p className="text-xs text-amber-700">
                No WhatsApp number on this roaster's record — set one from the CRM page.
              </p>
            )}
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 break-all"
              >
                <ExternalLink className="h-3 w-3 shrink-0" /> Open WhatsApp handoff
              </a>
            )}
          </CardContent>
        </Card>

        {/* Ledger */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" /> Dispatch Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Roaster</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ledger ?? []).map((d) => {
                  const Icon = CHANNEL_ICON[d.channel] ?? MessageSquare;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.ruleCode}</TableCell>
                      <TableCell className="text-sm">{d.roasterName}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-xs">
                          <Icon className="h-3.5 w-3.5" /> {d.channel}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm max-w-[240px] truncate">{d.subject}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLE[d.status] ?? "bg-slate-100 text-slate-700"}>
                          {d.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
                {(ledger ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No dispatches yet.
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
