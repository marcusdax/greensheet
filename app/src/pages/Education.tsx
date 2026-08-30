import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  warehouse: "Warehouse",
  cupping: "Cupping",
  samples: "Samples",
  agreements: "Agreements",
  marketing: "Marketing",
};

export default function Education() {
  const utils = trpc.useUtils();
  const { data: library } = trpc.education.library.useQuery();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [ackOpen, setAckOpen] = useState(false);

  const { data: doc } = trpc.education.document.useQuery(
    { code: selectedCode ?? "" },
    { enabled: !!selectedCode },
  );

  const acknowledge = trpc.education.acknowledge.useMutation({
    onSuccess: () => {
      utils.education.library.invalidate();
      if (selectedCode) utils.education.document.invalidate({ code: selectedCode });
      setAckOpen(false);
      toast.success("Sign-off recorded — education.sop_acknowledged emitted");
    },
    onError: (e) => toast.error(e.message),
  });

  const categories = [...new Set(library?.map((d) => d.category) ?? [])];

  return (
    <Layout>
      <PageHeader
        title="Education & SOPs"
        sub="Runbooks, cupping standards, and agreements — every sign-off is attested on the ledger"
      />

      <div className="grid lg:grid-cols-[minmax(280px,1fr)_2fr] gap-6 items-start">
        <div className="space-y-5">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              <div className="space-y-2">
                {library
                  ?.filter((d) => d.category === cat)
                  .map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedCode(d.code)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedCode === d.code
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-snug">{d.title}</span>
                        <Badge variant="outline" className="shrink-0">v{d.version}</Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-mono">{d.code}</span>
                        <span>{d.acknowledgmentCount} sign-off{d.acknowledgmentCount === 1 ? "" : "s"}</span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}
          {library && library.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No SOP documents seeded yet — run <code>npm run db:seed</code>.
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          {doc ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg leading-snug">{doc.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {doc.code} · v{doc.version} · {CATEGORY_LABELS[doc.category] ?? doc.category}
                    </p>
                  </div>
                  <Dialog open={ackOpen} onOpenChange={setAckOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Sign off
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader><DialogTitle>AcknowledgeSop — {doc.code}</DialogTitle></DialogHeader>
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          acknowledge.mutate({
                            documentId: doc.id,
                            personName: String(f.get("personName")),
                            role: String(f.get("role") ?? ""),
                          });
                        }}
                      >
                        <div><Label>Your name</Label><Input name="personName" required minLength={2} placeholder="Dana Whitfield" /></div>
                        <div><Label>Role</Label><Input name="role" placeholder="Warehouse lead" /></div>
                        <p className="text-xs text-muted-foreground">
                          Signing attests you read and understood this SOP version.
                        </p>
                        <Button type="submit" className="w-full" disabled={acknowledge.isPending}>
                          {acknowledge.isPending ? "Recording…" : "Attest & sign"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                {doc.summary && <p className="text-sm text-muted-foreground mt-2">{doc.summary}</p>}
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-md border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                  {doc.content}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                    Acknowledgments
                  </div>
                  {doc.acknowledgments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sign-offs yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Signed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {doc.acknowledgments.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.personName}</TableCell>
                            <TableCell className="text-muted-foreground">{a.role || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(a.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-20 text-center">
                <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Select an SOP from the library to read it and record sign-offs.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
