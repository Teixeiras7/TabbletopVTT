"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Request = { title: string; message?: string; confirmLabel: string; resolve: (ok: boolean) => void };

// Um só modal de confirmação para o app inteiro: `confirm()` pede, o <ConfirmHost /> (no layout raiz) mostra.
let show: ((r: Request) => void) | null = null;

/** Pergunta "tem certeza?" num modal do app. Resolve true só se a pessoa confirmar. */
export function confirm(title: string, options: { message?: string; confirmLabel?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(window.confirm(title)); // sem o host montado (não deveria acontecer)
    show({ title, message: options.message, confirmLabel: options.confirmLabel ?? "Excluir", resolve });
  });
}

export function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null);
  useEffect(() => {
    show = setRequest;
    return () => {
      show = null;
    };
  }, []);

  function answer(ok: boolean) {
    request?.resolve(ok);
    setRequest(null);
  }

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && answer(false)}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogTitle className="leading-snug">{request?.title}</DialogTitle>
        <DialogDescription className={request?.message ? undefined : "sr-only"}>{request?.message ?? "Confirme a ação."}</DialogDescription>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => answer(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" autoFocus onClick={() => answer(true)}>
            {request?.confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
