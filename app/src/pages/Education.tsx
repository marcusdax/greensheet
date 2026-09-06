import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, HelpCircle } from "lucide-react";

const OFFERINGS = [
  {
    icon: BookOpen,
    title: "Cupping & calibration guides",
    desc: "SCA-style lexicon sheets so every roaster reads the ledger the same way.",
  },
  {
    icon: GraduationCap,
    title: "Origin working sessions",
    desc: "Live walkthroughs of farm economics with the producers on your contracts.",
  },
  {
    icon: HelpCircle,
    title: "Green-sheet literacy",
    desc: "What a cup score really means — and why the tenth does not trade.",
  },
];

export default function Education() {
  return (
    <Layout>
      <PageHeader
        title="Education"
        overline="Auctum · Relationships"
        sub="Materials and sessions for buying teams — the ledger, read correctly."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {OFFERINGS.map(({ icon: Icon, title, desc }) => (
          <Card key={title}>
            <CardHeader className="pb-3">
              <Icon className="h-5 w-5 text-brass" aria-hidden="true" />
              <CardTitle className="mt-2 font-display text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-caption text-muted-foreground">
        Library is under construction — check the Comms stream for the first drop schedule.
      </p>
    </Layout>
  );
}