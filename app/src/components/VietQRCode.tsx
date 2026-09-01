// VietQR display — §8.3.
//
// The QR is half the component. The other half is the manual fallback: some
// payers will type the transfer into their banking app, and the memo token is
// the only thing standing between that transfer and the exception queue. So the
// token is large, copyable, and explained.
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/Money";
import { Check, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";

export type VietQrProps = {
  qrCodeData: string | null;
  memoToken: string;
  amountMinor: bigint;
  currency: string;
  beneficiary?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  };
};

export function VietQRCode({
  qrCodeData,
  memoToken,
  amountMinor,
  currency,
  beneficiary,
}: VietQrProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!qrCodeData || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrCodeData, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#221E1B", light: "#FAF9F4" },
    }).catch((err: unknown) => setRenderError(String(err)));
  }, [qrCodeData]);

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        {qrCodeData && !renderError ? (
          <canvas ref={canvasRef} className="rounded-md border" />
        ) : (
          <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 rounded-md border border-dashed text-center text-xs text-muted-foreground">
            <QrCode className="h-6 w-6" />
            <span className="px-4">
              {renderError
                ? "QR could not be rendered — use the transfer details"
                : "No QR for this invoice; transfer manually using the details shown"}
            </span>
          </div>
        )}
        <Money
          amountMinor={amountMinor}
          currency={currency}
          emphasis
          className="text-lg"
        />
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Transfer reference — must appear in the memo
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-base tracking-[0.2em]">
              {memoToken}
            </code>
            <CopyButton value={memoToken} label="reference" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Without this reference the payment lands in the exception queue and
            has to be matched by hand.
          </p>
        </div>

        {beneficiary && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {beneficiary.bankName && (
              <>
                <dt className="text-muted-foreground">Bank</dt>
                <dd>{beneficiary.bankName}</dd>
              </>
            )}
            {beneficiary.accountNumber && (
              <>
                <dt className="text-muted-foreground">Account</dt>
                <dd className="flex items-center gap-2 font-mono">
                  {beneficiary.accountNumber}
                  <CopyButton
                    value={beneficiary.accountNumber}
                    label="account number"
                  />
                </dd>
              </>
            )}
            {beneficiary.accountName && (
              <>
                <dt className="text-muted-foreground">Name</dt>
                <dd>{beneficiary.accountName}</dd>
              </>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error(`Could not copy the ${label}`);
        }
      }}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
