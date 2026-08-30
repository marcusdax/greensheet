import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// Museum Folio treatment: Paper ground, Ink text, Oxblood action.
export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/", { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB] text-[#221E1B] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <ShieldCheck className="h-7 w-7 text-[#74362F]" />
          <div>
            <div className="font-bold tracking-tight text-lg leading-none">Auctum Ledger</div>
            <div className="text-[10px] uppercase tracking-widest text-[#58514B] mt-1">
              Verified green coffee distribution
            </div>
          </div>
        </div>
        <form
          className="rounded-lg border border-[#D9D3C9] bg-[#FAF9F4] p-6 space-y-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ email, password });
          }}
        >
          <div>
            <Label className="text-[#221E1B]">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="admin@auctumledger.io"
              className="bg-white border-[#D9D3C9]"
            />
          </div>
          <div>
            <Label className="text-[#221E1B]">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="bg-white border-[#D9D3C9]"
            />
          </div>
          <Button
            type="submit"
            disabled={login.isPending}
            className="w-full bg-[#74362F] hover:bg-[#5f2c26] text-white font-semibold"
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-[11px] text-[#58514B] leading-relaxed">
            Dev accounts are printed by <code>npm run db:seed:auth</code>.
          </p>
        </form>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
