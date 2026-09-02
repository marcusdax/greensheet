// Document capture surface — spec §5.3.
//
// One component for every entry point in §4.1, because the alternative is six
// slightly different upload widgets that drift apart. It takes a file and
// nothing else; what happens to that file is the caller's business.
//
// Mobile is not an afterthought here. §4.1 calls out exporters and QC staff
// capturing at origin or at port, so `capture="environment"` opens the rear
// camera directly rather than making someone find the photo they just took.
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Camera, Image as ImageIcon, Loader2, ScanLine, X } from "lucide-react";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

export type ScannerSurfaceProps = {
  onFile: (file: File) => void;
  onClear?: () => void;
  busy?: boolean;
  /** Overrides the idle copy where a specific document is expected. */
  prompt?: string;
  className?: string;
};

export function ScannerSurface({
  onFile,
  onClear,
  busy = false,
  prompt = "Photograph or drop an SCA report, contract, or warehouse receipt",
  className,
}: ScannerSurfaceProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      if (file.size > MAX_BYTES) {
        // Said plainly and with the actual number: "file too large" makes
        // someone guess, and they will guess wrong twice before asking.
        setError(
          `That file is ${(file.size / 1_048_576).toFixed(1)} MB. The limit is 10 MB — resize a phone photo to about 2000px on its long edge.`
        );
        return;
      }
      setError(null);
      setPreview({
        url: file.type === "application/pdf" ? "" : URL.createObjectURL(file),
        name: file.name,
      });
      onFile(file);
    },
    [onFile]
  );

  function clear() {
    setPreview(null);
    setError(null);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    onClear?.();
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative flex min-h-[180px] flex-col items-center justify-center rounded-md border bg-paper-50 p-6 text-center transition-colors",
          // Dashed only while empty — §5.3. Once a document is in the frame the
          // border becomes solid, so the surface stops asking for something it
          // already has.
          preview ? "border-solid border-neutral-200" : "border-dashed",
          dragging ? "border-oxblood-500 bg-paper-100" : "border-neutral-200"
        )}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-oxblood-500" />
            <span className="font-mono text-xs tabular-nums text-neutral-500">
              Reading document…
            </span>
          </div>
        ) : preview ? (
          <>
            {preview.url ? (
              <img
                src={preview.url}
                alt={preview.name}
                className="max-h-64 rounded-sm border border-neutral-200 object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-neutral-500">
                <ScanLine className="h-8 w-8" />
                <span className="font-mono text-xs">{preview.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={clear}
              aria-label="Remove document"
              className="absolute right-2 top-2 rounded-full bg-paper-100 p-1 text-neutral-500 hover:text-ink-900"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <ScanLine className="h-8 w-8 text-neutral-500" aria-hidden />
            <p className="mt-2 max-w-xs text-sm text-neutral-500">{prompt}</p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {/* Two inputs rather than one: `capture` on a single input would take the
          gallery option away on mobile, and a QC lead photographing at origin
          and an operator attaching a scan at a desk are both real. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => accept(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={e => accept(e.target.files?.[0])}
      />

      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1 sm:flex-none"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
        >
          <Camera className="mr-2 h-4 w-4" />
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={() => galleryRef.current?.click()}
          disabled={busy}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          Choose file
        </Button>
      </div>
    </div>
  );
}
