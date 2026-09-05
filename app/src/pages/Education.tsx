import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GraduationCap, CheckCircle2, Users, BookOpen } from "lucide-react";
import { CupperCard, CupperRosterSummary } from "@/components/CupperCard";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  warehouse: "Warehouse",
  cupping: "Cupping",
  samples: "Samples",
  agreements: "Agreements",
  marketing: "Marketing",
};

type Tab = "library" | "cuppers" | "curriculum";

export default function Education() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("library");
  const { data: library } = trpc.education.library.useQuery();
  const { data: cuppers } = trpc.education.cuppers.useQuery(undefined, {
    enabled: tab === "cuppers",
  });
  const { data: curriculum } = trpc.education.curriculum.useQuery(undefined, {
    enabled: tab === "curriculum",
  });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const { data: doc } = trpc.education.document.useQuery(
    { code: selectedCode ?? "" },
    { enabled: !!selectedCode }
  );

  const acknowledge = trpc.education.acknowledge.useMutation({
    onSuccess: res => {
      utils.education.library.invalidate();
      if (selectedCode)
        utils.education.document.invalidate({ code: selectedCode });
      toast.success(
        res.alreadyAcknowledged
          ? "You already signed this version — re-reading is not a second sign-off."
          : "Sign-off recorded against your account"
      );
    },
    onError: e => toast.error(e.message),
  });

  const categories = [...new Set(library?.map(d => d.category) ?? [])];

  return (
    <Layout>
      <PageHeader
        kicker="Folio 04 — The Craft"
        title="Education & Qualification"
        sub="SOPs, the cupping curriculum, and who is actually certified to score a lot"
      />

      {/* Three questions, in the order someone asks them: what are the
          standards, who has met them, and how does anyone meet them. */}
      <div className="mb-6 flex gap-1 border-b border-neutral-200">
        {(
          [
            ["library", "SOP library", BookOpen],
            ["cuppers", "Cupper roster", Users],
            ["curriculum", "Curriculum", GraduationCap],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "-mb-px flex items-center gap-1.5 border-b-2 border-oxblood-500 px-3 py-2 text-sm font-medium text-ink-900"
                : "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-neutral-500 hover:text-ink-700"
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "cuppers" && (
        <div>
          <CupperRosterSummary
            total={cuppers?.length ?? 0}
            clear={cuppers?.filter(c => c.authority.inGoodStanding).length ?? 0}
            qGraders={
              cuppers?.filter(
                c => c.tier === "tier_1" && c.authority.inGoodStanding
              ).length ?? 0
            }
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(cuppers ?? []).map(c => (
              <CupperCard
                key={c.id}
                fullName={c.fullName}
                tier={c.tier}
                tierLabel={c.tierLabel}
                performance={c.performance}
                observedVariance={c.observedVariance}
                supervisedCups={c.supervisedCups}
                totalCups={c.totalCups}
                inGoodStanding={c.authority.inGoodStanding}
                blockers={c.authority.blockers}
                daysUntilRecertification={c.authority.daysUntilRecertification}
                daysUntilLicenceExpiry={c.authority.daysUntilLicenceExpiry}
              />
            ))}
            {(cuppers ?? []).length === 0 && (
              <p className="text-sm text-neutral-500">
                No cupper profiles yet. Until one exists, §1.1 Tier 0 applies
                and nobody may cup for verification purposes.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "curriculum" && curriculum && (
        <div className="space-y-6">
          <Card className="bg-paper-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Cupper tiers &amp; authority · {curriculum.modelVersion}
              </CardTitle>
              <p className="mt-1 text-xs text-neutral-500">
                What each tier may do. A cup score sets the Revenue Share tier
                and therefore a farmer&apos;s payment, so this is a financial
                control — the QC screen refuses a session from anyone outside
                their authority.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>Requirement</TableHead>
                    <TableHead className="text-right">Band</TableHead>
                    <TableHead>May cup alone</TableHead>
                    <TableHead>Tier 2/3 exceptions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {curriculum.tiers.map(t => (
                    <TableRow key={t.key}>
                      <TableCell className="font-medium">{t.label}</TableCell>
                      <TableCell className="max-w-md text-xs text-neutral-500">
                        {t.requirement}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {t.accuracyBand === null ? "—" : `±${t.accuracyBand}`}
                      </TableCell>
                      <TableCell>
                        {t.authority.independentCupping ? "Yes" : "No"}
                      </TableCell>
                      <TableCell>
                        {t.authority.tier2And3Exceptions ? "Yes" : "No"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {curriculum.phases.map(phase => (
              <Card key={phase.code} className="bg-paper-50">
                <CardHeader className="pb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <CardTitle className="text-sm">
                      Phase {phase.phase} · {phase.title}
                    </CardTitle>
                    <span className="font-mono text-[11px] text-neutral-500">
                      {phase.weeks}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs leading-relaxed text-ink-700">
                    {phase.objective}
                  </p>
                  <p className="rounded-md border border-neutral-200 bg-paper-100 px-2 py-1.5 text-[11px] text-ink-700">
                    <span className="font-semibold">Pass:</span>{" "}
                    {phase.passCriterion}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-paper-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Wider curriculum</CardTitle>
              <p className="mt-1 text-xs text-neutral-500">
                Cultivation, processing, financial literacy and compliance.
                These carry no automated threshold yet, so they are taught
                content rather than certification gates — labelled as such
                rather than implying they qualify anyone.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Track</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Assessment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {curriculum.modules
                    .filter(m => m.track !== "cupping")
                    .map(m => (
                      <TableRow key={m.code}>
                        <TableCell>
                          <span className="font-medium">{m.title}</span>
                          <span className="block font-mono text-[11px] text-neutral-500">
                            {m.code}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs capitalize">
                          {m.track}
                        </TableCell>
                        <TableCell className="text-xs">
                          {m.durationLabel}
                        </TableCell>
                        <TableCell className="max-w-xs text-xs text-neutral-500">
                          {m.passCriterion}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "library" && (
        <div className="grid lg:grid-cols-[minmax(280px,1fr)_2fr] gap-6 items-start">
          <div className="space-y-5">
            {categories.map(cat => (
              <div key={cat}>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                  {CATEGORY_LABELS[cat] ?? cat}
                </div>
                <div className="space-y-2">
                  {library
                    ?.filter(d => d.category === cat)
                    .map(d => (
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
                          <span className="text-sm font-medium leading-snug">
                            {d.title}
                          </span>
                          <Badge variant="outline" className="shrink-0">
                            v{d.version}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-mono">{d.code}</span>
                          <span>
                            {d.acknowledgmentCount} sign-off
                            {d.acknowledgmentCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
            {library && library.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No SOP documents seeded yet — run <code>npm run db:seed</code>
                  .
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
                      <CardTitle className="text-lg leading-snug">
                        {doc.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {doc.code} · v{doc.version} ·{" "}
                        {CATEGORY_LABELS[doc.category] ?? doc.category}
                      </p>
                    </div>
                    {/* The signature is the session, not a typed name. There is
                      no name field any more: a training record you can file
                      under a colleague's name is not evidence of training. */}
                    <Button
                      size="sm"
                      onClick={() => acknowledge.mutate({ documentId: doc.id })}
                      disabled={acknowledge.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {acknowledge.isPending ? "Recording…" : "Sign off as me"}
                    </Button>
                  </div>
                  {doc.summary && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {doc.summary}
                    </p>
                  )}
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
                      <p className="text-sm text-muted-foreground">
                        No sign-offs yet.
                      </p>
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
                          {doc.acknowledgments.map(a => (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium">
                                {a.personName}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {a.role || "—"}
                              </TableCell>
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
                    Select an SOP from the library to read it and record
                    sign-offs.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
