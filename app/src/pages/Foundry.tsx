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
    </Layout>
  );
}
