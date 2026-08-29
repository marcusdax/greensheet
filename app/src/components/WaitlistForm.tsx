import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function WaitlistForm({
  product,
  dark = true,
}: {
  product: "foundry" | "lotspace";
  dark?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [interest, setInterest] = useState("");
  const [joined, setJoined] = useState<number | null>(null);

  const join = trpc.growth.joinWaitlist.useMutation({
    onSuccess: (r) => {
      setJoined(r.position);
      toast.success(r.alreadyJoined ? "You're already on the list" : "You're on the waitlist");
    },
    onError: (e) => toast.error(e.message),
  });

  if (joined != null) {
    return (
      <div className={`rounded-xl border p-8 text-center ${dark ? "border-[#d9a441]/40 bg-white/5" : "border-border bg-muted/40"}`}>
        <CheckCircle2 className="h-10 w-10 mx-auto text-[#d9a441]" />
        <div className="mt-3 text-xl font-semibold">You're on the list</div>
        <p className={`mt-1 text-sm ${dark ? "text-[#c4d8cb]" : "text-muted-foreground"}`}>
          We'll reach out the moment early access opens.
        </p>
      </div>
    );
  }

  const inputCls = dark
    ? "bg-white/10 border-white/20 text-white placeholder:text-white/40"
    : "";

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        join.mutate({ product, name, email, company, interest });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Input className={inputCls} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        <Input className={inputCls} placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <Input className={inputCls} type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Textarea
        className={inputCls}
        placeholder="What would you use it for? (optional)"
        rows={3}
        value={interest}
        onChange={(e) => setInterest(e.target.value)}
      />
      <Button
        type="submit"
        disabled={join.isPending}
        className="w-full bg-[#d9a441] text-[#16382a] hover:bg-[#c9963a] font-semibold"
      >
        {join.isPending ? "Joining…" : "Join the waitlist"}
      </Button>
    </form>
  );
}
