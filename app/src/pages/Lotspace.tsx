import Layout, { PageHeader } from "@/components/Layout";
import WaitlistForm from "@/components/WaitlistForm";
import { Boxes } from "lucide-react";

export default function Lotspace() {
  return (
    <Layout>
      <PageHeader
        title="LotSpace"
        endorsement="by Auctum"
        sub="Shared verified-lot marketplace — coming soon"
      />
      <div className="rounded-xl bg-[#16382a] text-[#eaf2ec] p-10 max-w-2xl">
        <Boxes className="h-10 w-10 text-[#d9a441]" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">
          Split verified lots with roasters you trust.
        </h2>
        <p className="mt-3 text-sm text-[#c4d8cb] leading-relaxed max-w-prose">
          LotSpace by Auctum lets smaller roasters pool demand on full-container verified lots —
          shared freight, transparent splits, and the same ledger-backed lot record for
          every participant. Early access opens to the waitlist first.
        </p>
        <div className="mt-8 max-w-md">
          <WaitlistForm product="lotspace" />
        </div>
      </div>
    </Layout>
  );
}
