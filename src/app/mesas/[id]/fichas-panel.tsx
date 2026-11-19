"use client";

import { useEffect, useState } from "react";
import { AppWindow, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CharacterView, Dossier } from "@/lib/mesas/characters";
import { getCharacterAction, getDossierAction } from "./character-actions";
import { CharacterSheetView } from "./character-sheet";
import { CharacterWizard } from "./character-wizard";
import { DossierDialog } from "./dossier-dialog";
import { Avatar } from "./sheet-ficha";
import { CHARACTER_DRAG_TYPE } from "@/lib/mesas/map";
import type { CharactersApi } from "./use-characters";

/**
 * Clicar no nome abre o dossiê (todos veem). Do dossiê, só o dono e o Mestre abrem a ficha, num modal com abas
 * (e um botão para levá-la a uma janela separada). Se a ficha já está numa janela, o clique leva para ela.
 */
export function FichasPanel({ api, tableId, currentUserId, isMaster }: { api: CharactersApi; tableId: string; currentUserId: string; isMaster: boolean }) {
  const [creating, setCreating] = useState(false);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<{ id: string; value: Dossier | null } | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ id: string; value: CharacterView | null; load: number } | null>(null);
  const [tab, setTab] = useState("ficha");
  const [notice, setNotice] = useState<string | null>(null);

  // Busca de novo ao abrir e sempre que outra pessoa muda algo (api.changeCount).
  useEffect(() => {
    if (!dossierId) return;
    let cancelled = false;
    getDossierAction(dossierId).then((value) => {
      if (!cancelled) setDossier({ id: dossierId, value });
    });
    return () => {
      cancelled = true;
    };
  }, [dossierId, api.changeCount]);

  useEffect(() => {
    if (!sheetId) return;
    let cancelled = false;
    getCharacterAction(sheetId).then((value) => {
      if (!cancelled) setSheet((prev) => ({ id: sheetId, value, load: (prev?.load ?? 0) + 1 }));
    });
    return () => {
      cancelled = true;
    };
  }, [sheetId, api.changeCount]);

  function openCharacter(id: string) {
    if (api.focusWindow(id)) return;
    setDossierId(id);
  }

  function openSheet(id: string) {
    setDossierId(null);
    if (api.focusWindow(id)) return;
    setTab("ficha");
    setSheetId(id);
  }

  function popOut() {
    if (sheetId && api.openWindow(sheetId)) setSheetId(null);
  }

  const dossierReady = dossier !== null && dossier.id === dossierId;
  const sheetReady = sheet !== null && sheet.id === sheetId;

  return (
    <div className="space-y-4">
      <Button type="button" className="w-full" onClick={() => setCreating(true)}>
        <Plus className="size-4" /> Criar personagem
      </Button>

      {api.characters.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum personagem na mesa ainda.</p>
      ) : (
        <ul className="space-y-1">
          {api.characters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => openCharacter(c.id)}
                // Dono e Mestre arrastam o personagem para o mapa (ele entra na casa onde for solto).
                draggable={isMaster || c.ownerId === currentUserId}
                onDragStart={(e) => {
                  e.dataTransfer.setData(CHARACTER_DRAG_TYPE, c.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                title={isMaster || c.ownerId === currentUserId ? "Arraste para o mapa para colocar no grid" : undefined}
                className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
              >
                <Avatar name={c.name} imageUrl={c.imageUrl} className="size-10 shrink-0 rounded-md object-cover text-base" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.race} · {c.archetype}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.careers.join(" + ")} · {c.ownerId === currentUserId ? "você" : c.ownerName}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <CharacterWizard
        tableId={tableId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={async (id, imageError) => {
          setCreating(false);
          await api.afterChange();
          setNotice(imageError);
          openSheet(id); // ao salvar, abre a ficha direto
        }}
      />

      <DossierDialog
        open={dossierId !== null}
        name={api.characters.find((c) => c.id === dossierId)?.name ?? ""}
        dossier={dossierReady ? dossier.value : undefined}
        onClose={() => setDossierId(null)}
        onOpenSheet={openSheet}
      />

      <Dialog modal={false} open={sheetId !== null} onOpenChange={(o) => !o && (setSheetId(null), setNotice(null))}>
        <DialogContent floating className="flex h-[min(56rem,94dvh)] flex-col gap-3 overflow-hidden p-0 sm:max-w-4xl">
          <DialogTitle className="sr-only">{sheetReady ? (sheet.value?.name ?? "Ficha") : "Ficha"}</DialogTitle>
          <DialogDescription className="sr-only">Ficha do personagem.</DialogDescription>
          <button
            type="button"
            onClick={popOut}
            aria-label="Abrir em janela separada"
            title="Abrir em janela separada"
            className="absolute top-4 left-4 z-10 rounded-xs p-0.5 opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:outline-hidden"
          >
            <AppWindow className="size-4" />
          </button>
          <div className="mt-12 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {notice && <p role="alert" className="mb-3 text-sm text-destructive">{notice}</p>}
            {sheetReady && sheet.value ? (
              <CharacterSheetView key={`${sheet.id}:${sheet.load}`} view={sheet.value} tab={tab} onTabChange={setTab} onChanged={() => void api.afterChange()} onDeleted={() => setSheetId(null)} />
            ) : (
              <p className="text-sm text-muted-foreground">{sheetReady ? "Ficha indisponível." : "Carregando a ficha…"}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
