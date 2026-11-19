"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Dossier } from "@/lib/mesas/characters";
import { Avatar } from "./sheet-ficha";

const FIELDS: { key: keyof Dossier["personal"]; label: string }[] = [
  { key: "age", label: "Idade" },
  { key: "nationality", label: "Nacionalidade" },
  { key: "filiation", label: "Filiação" },
  { key: "organization", label: "Organização" },
  { key: "height", label: "Altura" },
  { key: "weight", label: "Peso" },
];

/**
 * Dossiê do personagem: imagem à esquerda, nome em cima e os dados pessoais à direita. Qualquer participante
 * da mesa vê. Só o dono e o Mestre têm o botão para abrir a ficha.
 */
export function DossierDialog({
  open,
  name,
  dossier,
  onClose,
  onOpenSheet,
}: {
  open: boolean;
  /** Nome já conhecido pela lista: o título aparece na hora, antes do dossiê carregar. */
  name: string;
  /** undefined = carregando; null = indisponível. */
  dossier: Dossier | null | undefined;
  onClose: () => void;
  onOpenSheet: (id: string) => void;
}) {
  return (
    <Dialog modal={false} open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent floating className="sm:max-w-2xl">
        <DialogTitle className="pr-8 text-2xl leading-tight break-words">{dossier?.name ?? name}</DialogTitle>
        <DialogDescription className="sr-only">Dossiê do personagem.</DialogDescription>
        {dossier === undefined && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {dossier === null && <p className="text-sm text-muted-foreground">Dossiê indisponível.</p>}
        {dossier && (
          <>
            <div className="grid gap-5 sm:grid-cols-[13rem_1fr]">
              <Avatar name={dossier.name} imageUrl={dossier.imageUrl} className="aspect-[3/4] w-full rounded-xl object-cover" />
              {/* Em pares, como na aba Pessoal: Idade | Nacionalidade, Filiação | Organização, Altura | Peso. */}
              <dl className="grid content-start grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {FIELDS.map((f) => (
                  <div key={f.key} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="break-words whitespace-pre-wrap">{dossier.personal[f.key] || <span className="text-muted-foreground">—</span>}</dd>
                  </div>
                ))}
                {/* Nem todo personagem tem crimes: só aparece quando preenchido. */}
                {dossier.personal.crimes && (
                  <div className="col-span-2 border-t border-border pt-4">
                    <dt className="text-xs text-muted-foreground">Observações (Crimes)</dt>
                    <dd className="break-words whitespace-pre-wrap">{dossier.personal.crimes}</dd>
                  </div>
                )}
              </dl>
            </div>
            {dossier.canOpenSheet && (
              <div className="flex justify-end">
                <Button type="button" onClick={() => onOpenSheet(dossier.id)}>
                  Abrir ficha
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
