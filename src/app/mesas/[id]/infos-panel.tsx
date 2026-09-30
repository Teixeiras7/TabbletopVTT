"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, EyeOff, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canCreateInfo, canEditInfo, canHideInfo, type InfoKind, type InfoView } from "@/lib/mesas/info-rules";
import { BACKGROUND_TOO_BIG_MESSAGE, MAX_BACKGROUND_BYTES } from "@/lib/mesas/map";
import { cn } from "@/lib/utils";
import type { InfoActions } from "./use-infos";

const SECTIONS: { kind: InfoKind; label: string; empty: string; add: string }[] = [
  { kind: "image", label: "Imagens", empty: "Nenhuma imagem.", add: "Nova imagem" },
  { kind: "note", label: "Notas", empty: "Nenhuma nota.", add: "Nova nota" },
];

type MenuItem = { label: string; destructive?: boolean; onSelect: () => void };

export function InfosPanel({
  infos,
  actions,
  currentUserId,
  ownerId,
}: {
  infos: InfoView[];
  actions: InfoActions;
  currentUserId: string;
  ownerId: string;
}) {
  const [expanded, setExpanded] = useState<Record<InfoKind, boolean>>({ image: false, note: false });
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ kind: InfoKind; info: InfoView | null } | null>(null);
  const [menu, setMenu] = useState<{ info: InfoView; x: number; y: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Alfabética (pt-BR): fica fácil achar um NPC numa lista grande.
  const byKind = useMemo(() => {
    const sorted = [...infos].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { image: sorted.filter((i) => i.kind === "image"), note: sorted.filter((i) => i.kind === "note") };
  }, [infos]);

  const viewing = infos.find((info) => info.id === viewingId) ?? null;

  async function run(action: Promise<{ ok: true } | { ok: false; message: string }>) {
    setActionError(null);
    const result = await action;
    if (!result.ok) setActionError(result.message);
  }

  function menuItemsFor(info: InfoView): MenuItem[] {
    const items: MenuItem[] = [];
    const editable = canEditInfo(info, currentUserId, ownerId);
    if (editable) items.push({ label: "Editar", onSelect: () => setForm({ kind: info.kind, info }) });
    if (canHideInfo(info, currentUserId, ownerId)) {
      items.push({
        label: info.hidden ? "Mostrar aos jogadores" : "Ocultar dos jogadores",
        onSelect: () => run(actions.setHidden(info.id, !info.hidden)),
      });
    }
    if (editable) {
      items.push({
        label: "Excluir",
        destructive: true,
        onSelect: () => {
          if (window.confirm(`Excluir "${info.name}"? Isso não pode ser desfeito.`)) run(actions.remove(info.id));
        },
      });
    }
    return items;
  }

  return (
    <div className="space-y-2">
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}

      {SECTIONS.map((section) => {
        const items = byKind[section.kind];
        const isOpen = expanded[section.kind];
        return (
          <section key={section.kind}>
            <div className="flex items-center">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpanded((prev) => ({ ...prev, [section.kind]: !prev[section.kind] }))}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-accent"
              >
                <ChevronRight className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-90")} />
                {section.label}
                <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
              </button>
              {canCreateInfo(section.kind, currentUserId, ownerId) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={section.add}
                  title={section.add}
                  onClick={() => setForm({ kind: section.kind, info: null })}
                >
                  <Plus className="size-4" />
                </Button>
              )}
            </div>

            {isOpen &&
              (items.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">{section.empty}</p>
              ) : (
                <ul className="ml-3 border-l border-border pl-1">
                  {items.map((info) => {
                    const menuItems = menuItemsFor(info);
                    return (
                      <li
                        key={info.id}
                        className="flex items-center gap-1"
                        onContextMenu={(event) => {
                          // Sem ação para este usuário (ex.: jogador numa info do Mestre): deixa o menu do navegador.
                          if (menuItems.length === 0) return;
                          event.preventDefault();
                          setMenu({ info, x: event.clientX, y: event.clientY });
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setViewingId(info.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                        >
                          <span className="truncate">{info.name}</span>
                          {info.hidden && (
                            <span title="Oculta para os jogadores" className="shrink-0 text-muted-foreground">
                              <EyeOff className="size-3.5" />
                            </span>
                          )}
                        </button>
                        {menuItems.length > 0 && (
                          <button
                            type="button"
                            aria-label={`Opções de ${info.name}`}
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setMenu({ info, x: rect.left, y: rect.bottom });
                            }}
                            // No computador só o botão direito; o ⋯ existe para telas de toque.
                            className="hidden size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent pointer-coarse:inline-flex"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))}
          </section>
        );
      })}

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItemsFor(menu.info)} onClose={() => setMenu(null)} />}

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewingId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-6 break-words">{viewing?.name}</DialogTitle>
            <DialogDescription className="sr-only">
              {viewing?.kind === "image" ? "Imagem" : "Nota"}
            </DialogDescription>
          </DialogHeader>
          {viewing?.kind === "image" && viewing.imageUrl && (
            // <img> simples: a imagem já vem do Storage e o otimizador do Next não agrega aqui.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewing.imageUrl} alt={viewing.name} className="max-h-[70dvh] w-full rounded-md object-contain" />
          )}
          {viewing?.kind === "note" && (
            <p className="text-sm break-words whitespace-pre-wrap">{viewing.description}</p>
          )}
        </DialogContent>
      </Dialog>

      {form && (
        <InfoFormDialog
          key={`${form.kind}:${form.info?.id ?? "new"}`}
          kind={form.kind}
          info={form.info}
          actions={actions}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}

function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(x, window.innerWidth - 208));
  const top = Math.max(8, Math.min(y, window.innerHeight - items.length * 36 - 16));

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left, top }}
      className="fixed z-50 min-w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg shadow-black/30"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={cn(
            "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
            item.destructive && "text-destructive",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function InfoFormDialog({
  kind,
  info,
  actions,
  onClose,
}: {
  kind: InfoKind;
  info: InfoView | null;
  actions: InfoActions;
  onClose: () => void;
}) {
  const editing = info !== null;
  const [name, setName] = useState(info?.name ?? "");
  const [description, setDescription] = useState(info?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    if (chosen && chosen.size > MAX_BACKGROUND_BYTES) {
      event.target.value = "";
      setFile(null);
      setError(BACKGROUND_TOO_BIG_MESSAGE);
      return;
    }
    setError(null);
    setFile(chosen);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    let request;
    if (kind === "note") {
      request = info ? actions.updateNote(info.id, { name, description }) : actions.createNote({ name, description });
    } else {
      if (!info && !file) {
        setError("Escolha uma imagem.");
        return;
      }
      const data = new FormData();
      data.set("name", name);
      if (file) data.set("file", file);
      request = info ? actions.updateImage(info.id, data) : actions.createImage(data);
    }
    setPending(true);
    const result = await request;
    setPending(false);
    if (result.ok) onClose();
    else setError(result.message);
  }

  const title = `${editing ? "Editar" : "Nova"} ${kind === "image" ? "imagem" : "nota"}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Field>
              <FieldLabel htmlFor="info-name">Nome</FieldLabel>
              <Input
                id="info-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={60}
                autoFocus
              />
            </Field>

            {kind === "note" ? (
              <Field>
                <FieldLabel htmlFor="info-description">Descrição</FieldLabel>
                <Textarea
                  id="info-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  maxLength={5000}
                  rows={6}
                />
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="info-file">{editing ? "Trocar imagem (opcional)" : "Imagem"}</FieldLabel>
                <Input id="info-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} />
                <p className="text-xs text-muted-foreground">
                  PNG, JPEG ou WEBP, até {MAX_BACKGROUND_BYTES / 1024 / 1024} MB.
                </p>
              </Field>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
