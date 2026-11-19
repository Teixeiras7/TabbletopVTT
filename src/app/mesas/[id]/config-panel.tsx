"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { confirm } from "@/components/confirm";
import type { MesaRole } from "@/lib/mesas/roles";
import {
  BACKGROUND_TOO_BIG_MESSAGE,
  GRID_SIZES,
  MAX_BACKGROUND_BYTES,
  nearestGridSizeIndex,
} from "@/lib/mesas/map";
import { leaveMesaAction } from "../actions";
import { removeSceneBackgroundAction, updateGridSizeAction, uploadSceneBackgroundAction } from "./actions";

export function ConfigPanel({
  table,
  role,
  inviteLink,
  scene,
  onClearMyChat,
  onClearAllChat,
}: {
  table: { id: string; name: string; inviteCode: string };
  role: MesaRole;
  inviteLink: string;
  scene: { id: string; gridSize: number; backgroundUrl: string | null };
  onClearMyChat: () => Promise<boolean>;
  onClearAllChat: () => Promise<boolean>;
}) {
  const isMaster = role === "master";
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [sizeIndex, setSizeIndex] = useState(() => nearestGridSizeIndex(scene.gridSize));
  const gridSize = GRID_SIZES[sizeIndex] ?? scene.gridSize;
  const [savingGrid, setSavingGrid] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasBackground, setHasBackground] = useState(scene.backgroundUrl !== null);
  const [clearing, setClearing] = useState(false);
  const [chatMessage, setChatMessage] = useState<string | null>(null);

  async function copy(kind: "link" | "code", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Sem permissão de área de transferência: o valor continua visível para copiar à mão.
    }
  }

  async function clearChat(all: boolean) {
    const message = all
      ? "Apagar o chat para TODOS os participantes? Isso não pode ser desfeito."
      : "Limpar o chat? As mensagens somem só para você; os outros continuam vendo.";
    if (!(await confirm(message, { confirmLabel: all ? "Apagar" : "Limpar" }))) return;
    setClearing(true);
    setChatMessage(null);
    const ok = await (all ? onClearAllChat() : onClearMyChat());
    setClearing(false);
    setChatMessage(ok ? (all ? "Chat apagado para todos." : "Chat limpo.") : "Não foi possível limpar o chat.");
  }

  async function commitGridSize(index: number) {
    const size = GRID_SIZES[index];
    if (size === undefined) return;
    setSavingGrid(true);
    await updateGridSizeAction(scene.id, size);
    setSavingGrid(false);
  }

  async function handleBackgroundChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BACKGROUND_BYTES) {
      setUploadError(BACKGROUND_TOO_BIG_MESSAGE);
      return;
    }
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadSceneBackgroundAction(scene.id, table.id, formData);
    setUploading(false);
    if (result.ok) setHasBackground(true);
    else setUploadError(result.message ?? "Não foi possível enviar a imagem.");
  }

  async function removeBackground() {
    if (!(await confirm("Remover a imagem de fundo?", { message: "O mapa volta ao grid normal.", confirmLabel: "Remover" }))) return;
    setUploading(true);
    setUploadError(null);
    const result = await removeSceneBackgroundAction(scene.id, table.id);
    setUploading(false);
    if (result.ok) setHasBackground(false);
    else setUploadError("Não foi possível remover a imagem.");
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Geral</h3>
        <Button
          type="button"
          variant="outline"
          disabled={clearing}
          onClick={() => clearChat(false)}
          className="w-full"
        >
          Limpar chat
        </Button>
        {chatMessage && <p className="text-xs text-muted-foreground">{chatMessage}</p>}
        <div className="flex items-center justify-between">
          <span className="text-sm">Tema</span>
          <ThemeToggle />
        </div>
      </section>

      {isMaster && (
        <section className="space-y-4 border-t border-border pt-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Mestre</h3>

          <Button
            type="button"
            variant="outline"
            disabled={clearing}
            onClick={() => clearChat(true)}
            className="w-full"
          >
            Limpar chat de todos
          </Button>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="grid-size">Tamanho dos quadrados</label>
              <span className="text-muted-foreground">
                {gridSize}px
                {savingGrid ? " · salvando…" : ""}
              </span>
            </div>
            <input
              id="grid-size"
              type="range"
              min={0}
              max={GRID_SIZES.length - 1}
              step={1}
              value={sizeIndex}
              onChange={(event) => setSizeIndex(Number(event.target.value))}
              onMouseUp={(event) => commitGridSize(Number((event.target as HTMLInputElement).value))}
              onTouchEnd={(event) => commitGridSize(Number((event.target as HTMLInputElement).value))}
              onBlur={(event) => commitGridSize(Number((event.target as HTMLInputElement).value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm">Imagem de fundo</span>
            <p className="text-xs text-muted-foreground">
              Aparece para todos, como o mapa da mesa, na proporção da própria imagem (o grid se ajusta a ela). Enviar outra substitui a atual. Só
              imagem PNG, JPEG ou WEBP, até {MAX_BACKGROUND_BYTES / 1024 / 1024} MB.
            </p>
            <label
              className={buttonVariants({
                variant: "outline",
                className: "w-full cursor-pointer justify-center",
              })}
            >
              {uploading ? "Enviando…" : hasBackground ? "Trocar imagem" : "Escolher imagem"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={handleBackgroundChange}
              />
            </label>
            {hasBackground && (
              <Button type="button" variant="ghost" className="w-full text-destructive" disabled={uploading} onClick={removeBackground}>
                Remover imagem
              </Button>
            )}
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          </div>
        </section>
      )}

      <section className="space-y-2 border-t border-border pt-4">
        <span className="text-sm font-medium">Código</span>
        <p className="rounded-md border border-input bg-muted px-3 py-2 text-center font-mono text-sm tracking-widest">
          {table.inviteCode}
        </p>
      </section>

      <section className="flex gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={() => copy("link", inviteLink)}>
          {copied === "link" ? "Link copiado" : "Copiar link"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => copy("code", table.inviteCode)}
        >
          {copied === "code" ? "Código copiado" : "Copiar código"}
        </Button>
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        {!isMaster && (
          <form action={leaveMesaAction}>
            <input type="hidden" name="tableId" value={table.id} />
            <ConfirmSubmitButton
              message={`Sair da mesa "${table.name}"?`}
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Sair da mesa
            </ConfirmSubmitButton>
          </form>
        )}
        <Link href="/mesas" className={buttonVariants({ className: "w-full" })}>
          Voltar para Minhas Mesas
        </Link>
      </section>
    </div>
  );
}
