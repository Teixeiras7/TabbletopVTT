"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EQUIPMENT_CATEGORIES } from "@/lib/catalog/schemas";
import type { EquipmentRow } from "@/lib/mesas/characters";
import { cn } from "@/lib/utils";
import { editInventoryAction, listEquipmentNamesAction } from "./character-actions";
import { ItemDetails } from "./loja-panel";
import { Section } from "./sheet-ficha";

const coins = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
type Op = Parameters<typeof editInventoryAction>[1];

/**
 * Equipamentos do personagem: o que veio da carreira, o que foi comprado e o que se achou na aventura. O dono e o
 * Mestre ajustam aqui o dinheiro, as quantidades e os itens (da Lista de Preços ou de texto, com nome e descrição).
 * Comprar e vender pelo preço do livro: aba Loja.
 */
export function EquipmentTab({ characterId, money, equipment, onChanged }: { characterId: string; money: number; equipment: EquipmentRow[]; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; name: string; description: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [moneyDraft, setMoneyDraft] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(op: Op) {
    setBusy(true);
    const result = await editInventoryAction(characterId, op);
    setBusy(false);
    setErrors(result.ok ? [] : result.errors);
    if (result.ok) onChanged(); // a ficha recarrega com o inventário novo
    return result.ok;
  }

  async function setQty(item: EquipmentRow, qty: number) {
    if (qty === 0 && !(await confirm(`Tirar "${item.name}" do inventário?`, { confirmLabel: "Tirar" }))) return;
    await run({ type: "qty", key: item.key, qty });
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Dinheiro</span>
        {moneyDraft === null ? (
          <button
            type="button"
            onClick={() => setMoneyDraft(String(money))}
            title="Alterar o dinheiro"
            className="flex items-center gap-2 font-serif text-2xl font-semibold text-primary tabular-nums hover:underline hover:underline-offset-4"
          >
            {coins.format(money)} CO <Pencil className="size-3.5 text-muted-foreground" />
          </button>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run({ type: "money", money: Number(moneyDraft.replace(",", ".")) })) setMoneyDraft(null);
            }}
          >
            <Input autoFocus inputMode="decimal" aria-label="Dinheiro em CO" value={moneyDraft} onChange={(e) => setMoneyDraft(e.target.value)} className="h-9 w-28 text-right tabular-nums" />
            <Button type="button" size="sm" variant="outline" onClick={() => setMoneyDraft(null)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              Salvar
            </Button>
          </form>
        )}
      </div>

      <Section title="Itens" count={equipment.length}>
        {errors.length > 0 && (
          <p role="alert" className="text-sm text-destructive">
            {errors.join(" ")}
          </p>
        )}
        {adding ? (
          <AddItemForm busy={busy} onCancel={() => setAdding(false)} onAdd={async (op) => (await run(op)) && setAdding(false)} />
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Adicionar item
          </Button>
        )}

        {equipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum equipamento.</p>
        ) : (
          <ul>
            {equipment.map((item) => {
              const expanded = open === item.key;
              const hasMore = item.custom || !!item.details;
              return (
                <li key={item.key} className="border-b border-border">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!hasMore}
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : item.key)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-0.5 py-2.5 text-left enabled:hover:text-primary"
                    >
                      <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90", !hasMore && "invisible")} />
                      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{item.category ? EQUIPMENT_CATEGORIES[item.category] : "Texto"}</span>
                    </button>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button type="button" size="icon" variant="ghost" className="size-7" disabled={busy} aria-label={`Tirar um ${item.name}`} onClick={() => setQty(item, item.qty - 1)}>
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm tabular-nums">{item.qty}</span>
                      <Button type="button" size="icon" variant="ghost" className="size-7" disabled={busy} aria-label={`Mais um ${item.name}`} onClick={() => setQty(item, item.qty + 1)}>
                        <Plus className="size-3.5" />
                      </Button>
                    </span>
                  </div>
                  {expanded && !item.custom && item.details && <ItemDetails item={item} />}
                  {expanded && item.custom && editing?.key !== item.key && (
                    <div className="space-y-3 pr-0.5 pb-4 pl-6">
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.description || "Sem descrição."}</p>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditing({ key: item.key, name: item.name, description: item.description })}>
                          <Pencil className="size-3.5" /> Editar
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setQty(item, 0)}>
                          <Trash2 className="size-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  )}
                  {expanded && editing?.key === item.key && (
                    <form
                      className="space-y-2 pr-0.5 pb-4 pl-6"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await run({ type: "edit", ...editing })) setEditing(null);
                      }}
                    >
                      <Input aria-label="Nome do item" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={80} autoFocus />
                      <Textarea aria-label="Descrição do item" placeholder="Descrição" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} maxLength={2000} rows={4} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>
                          Cancelar
                        </Button>
                        <Button type="submit" size="sm" disabled={busy}>
                          Salvar
                        </Button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** Item achado: da Lista de Preços (busca pelo nome) ou de texto (nome e descrição livres). */
function AddItemForm({ busy, onAdd, onCancel }: { busy: boolean; onAdd: (op: Op) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<"catalog" | "custom">("catalog");
  const [names, setNames] = useState<{ slug: string; name: string }[] | null>(null);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");

  useEffect(() => {
    void listEquipmentNamesAction().then(setNames);
  }, []);
  const match = names?.find((n) => n.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <form
      className="space-y-3 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(qty);
        if (kind === "catalog" && match) onAdd({ type: "add-catalog", id: match.slug, qty: n });
        if (kind === "custom") onAdd({ type: "add-custom", name, description, qty: n });
      }}
    >
      <div className="flex gap-1 text-sm">
        {(["catalog", "custom"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn("rounded-md px-2.5 py-1", kind === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {k === "catalog" ? "Da Lista de Preços" : "Item de texto"}
          </button>
        ))}
      </div>
      {kind === "catalog" ? (
        <>
          <Input list="equipment-names" placeholder={names ? "Nome do item (ex.: Adaga)" : "Carregando a lista…"} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Item da Lista de Preços" />
          <datalist id="equipment-names">{names?.map((n) => <option key={n.slug} value={n.name} />)}</datalist>
          {query && !match && <p className="text-xs text-muted-foreground">Escolha um nome da lista.</p>}
        </>
      ) : (
        <>
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Nome do item" />
          <Textarea placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} aria-label="Descrição do item" />
        </>
      )}
      <div className="flex items-center justify-end gap-2">
        <label className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
          Quantidade
          <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="h-8 w-16 text-right tabular-nums" />
        </label>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy || (kind === "catalog" ? !match : !name.trim())}>
          Adicionar
        </Button>
      </div>
    </form>
  );
}
