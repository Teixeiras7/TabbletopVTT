"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyInvite({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  async function copy(kind: "link" | "code", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Sem permissão de área de transferência: o código continua visível para copiar à mão.
    }
  }

  return (
    <div className="space-y-3">
      <p className="rounded-md border border-input bg-muted px-3 py-3 text-center font-mono text-lg tracking-widest">
        {code}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => copy("link", link)}>
          {copied === "link" ? "Link copiado" : "Copiar link"}
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={() => copy("code", code)}>
          {copied === "code" ? "Código copiado" : "Copiar código"}
        </Button>
      </div>
    </div>
  );
}
