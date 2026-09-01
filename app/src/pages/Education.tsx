import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraduationCap, BookOpen, CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABEL: Record<string, string> = {
  warehouse: "Warehouse",
  cupping: "Cupping",
  samples: "Retained Samples",
  agreements: "Agreements",
  marketing: "Marketing",
};

const CATEGORY_STYLE: Record<string, string> = {
  warehouse: "bg-warning-soft text-warning",
  cupping: "bg-info-soft text-info",
  samples: "bg-roast-100 text-roast",
  agreements: "bg-navy text-white",
  marketing: "bg-gold text-navy",
};

export default function Education() {
  const { data: library } = trpc.education.library.useQuery();
  const [openCode, setOpenCode] = useState<string | null>(null);

  const groups = (library ?? []).reduce<Record<string, typeof library>>((acc, doc) => {
    (acc[doc.category] ??= []).push(doc);
    return acc;
  }, {});

  return (
    <Layout>
      <PageHeader
        title="SOP Library"
        sub="Warehouse runbooks, cupping standards, retained-sample procedures, and partnership agreements — with training sign-off"
      />

      <div className="space-y-6">
        {Object.entries(groups).map(([category, docs]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={CATEGORY_STYLE[category] ?? ""}>{CATEGORY_LABEL[category] ?? category}</Badge>
              <span className="text-xs text-muted-foreground">{docs!.length} document{docs!.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {docs!.map((doc) => (
                <Card
                  key={doc.id}
                  className="cursor-pointer hover:border-gold/60 transition-colors"
                  onClick={() => setOpenCode(doc.code)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 shrink-0 text-navy" />
                        {doc.title}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{doc.code}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2">{doc.summary}</p>
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span>v{doc.version}</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {doc.acknowledgmentCount} acknowledged
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {library && library.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No SOP documents seeded yet.
            </CardContent>
          </Card>
        )}
      </div>

      {openCode && <DocumentDialog code={openCode} onClose={() => setOpenCode(null)} />}
    </Layout>
  );
}

function DocumentDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: doc } = trpc.education.document.useQuery({ code });
  const [personName, setPersonName] = useState("");
  const [role, setRole] = useState("");

  const acknowledge = trpc.education.acknowledge.useMutation({
    onSuccess: () => {
      utils.education.document.invalidate({ code });
      utils.education.library.invalidate();
      setPersonName("");
      setRole("");
      toast.success("Training acknowledgment recorded");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {doc?.title ?? code}
            {doc && <span className="text-xs font-mono text-muted-foreground">{doc.code} · v{doc.version}</span>}
          </DialogTitle>
        </DialogHeader>

        {doc && (
          <div className="space-y-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/40 rounded-md p-4 border border-border">
              {doc.content}
            </pre>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Sign off — I read and understood this SOP
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Warehouse Lead" />
                </div>
              </div>
              <Button
                className="w-full mt-3 bg-navy hover:bg-navy-800"
                disabled={acknowledge.isPending || personName.trim().length < 2}
                onClick={() => acknowledge.mutate({ documentId: doc.id, personName, role })}
              >
                Acknowledge training
              </Button>
            </div>

            {doc.acknowledgments.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Acknowledgment log ({doc.acknowledgments.length})
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {doc.acknowledgments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        {a.personName}
                        {a.role && <span className="text-muted-foreground">· {a.role}</span>}
                      </span>
                      <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
