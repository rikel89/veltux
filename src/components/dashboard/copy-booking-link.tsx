"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBookingLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{path}</code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copiar enlace de reservas"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-lime transition-colors hover:bg-white/15"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
