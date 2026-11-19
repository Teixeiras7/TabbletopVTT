"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Dices, Gift, Minus, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EQUIPMENT_CATEGORIES, type Equipment, type EquipmentCategory } from "@/lib/catalog/schemas";
import { priceWith } from "@/lib/engine/shop";
import type { CharacterResult } from "@/lib/mesas/characters";
import type { ShopCharacter, ShopView } from "@/lib/mesas/shop";
import { cn } from "@/lib/utils";
import {
  buyAction,
  endNegotiationAction,
  getShopAction,
  giveItemAction,
  negotiateAction,
  sellAction,
  setMoneyAction,
  takeItemAction,
} from "./shop-actions";

const CATEGORIES = Object.entries(EQUIPMENT_CATEGORIES) as [EquipmentCategory, string][];
const coins = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const co = (value: number) => `${coins.format(value)} CO`;
const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const fieldClass =
  "h-9 rounded-md border border-input bg-card px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Aba Loja do painel: o catálogo e a compra/venda abrem num modal, que precisa de espaço. */
export function LojaPanel({ tableId }: { tableId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Equipamentos do livro com preço de compra e venda. Compre e venda para os seus personagens.
      </p>
      <Button type="button" className="w-full" onClick={() => setOpen(true)}>
        <Store className="size-4" /> Abrir loja
      </Button>
      {open && <ShopDialog tableId={tableId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ShopDialog({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const [view, setView] = useState<ShopView | null | undefined>(undefined);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [tab, setTab] = useState<"buy" | "inventory">("buy");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const reload = useCallback(() => getShopAction(tableId).then(setView), [tableId]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const character = view?.characters.find((c) => c.id === characterId) ?? view?.characters[0] ?? null;

  // A rolagem de Negociação vale enquanto a Loja está aberta; ao fechar, a próxima é outra rolagem.
  function close() {
    for (const c of view?.characters ?? []) if (c.negotiated.buy || c.negotiated.sell) void endNegotiationAction(c.id);
    onClose();
  }

  async function act(key: string, run: () => Promise<CharacterResult>, success: string) {
    setBusy(key);
    const result = await run();
    await reload();
    setBusy(null);
    setMessage(result.ok ? { text: success, error: false } : { text: result.errors.join(" "), error: true });
  }

  return (
    <Dialog modal={false} open onOpenChange={(o) => !o && close()}>
      <DialogContent floating className="flex h-[min(52rem,92dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogTitle className="sr-only">Loja</DialogTitle>
        <DialogDescription className="sr-only">Comprar e vender equipamentos.</DialogDescription>

        {view === undefined && <p className="p-6 text-sm text-muted-foreground">Abrindo a loja…</p>}
        {view === null && (
          <div className="space-y-3 p-6">
            <p role="alert" className="text-sm text-destructive">
              Não foi possível abrir a loja.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => (setView(undefined), void reload())}>
              Tentar de novo
            </Button>
          </div>
        )}
        {view && (
          <>
            <ShopHeader
              view={view}
              character={character}
              onCharacter={(id) => (setCharacterId(id), setMessage(null))}
              tab={tab}
              onTab={setTab}
              busy={busy}
              act={act}
            />
            <div className="min-h-0 flex-1">
              {tab === "buy" ? (
                <BuyList items={view.items} character={character} isMaster={view.isMaster} busy={busy} act={act} />
              ) : (
                <Inventory items={view.items} character={character} isMaster={view.isMaster} busy={busy} act={act} />
              )}
            </div>
            <p
              role="status"
              className={cn(
                "min-h-10 shrink-0 border-t border-border px-6 py-2.5 text-sm",
                message?.error ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {message?.text ?? (character ? "" : "Crie um personagem na aba Fichas para comprar.")}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Act = (key: string, run: () => Promise<CharacterResult>, success: string) => Promise<void>;

function ShopHeader({
  view,
  character,
  onCharacter,
  tab,
  onTab,
  busy,
  act,
}: {
  view: ShopView;
  character: ShopCharacter | null;
  onCharacter: (id: string) => void;
  tab: "buy" | "inventory";
  onTab: (tab: "buy" | "inventory") => void;
  busy: string | null;
  act: Act;
}) {
  const [attribute, setAttribute] = useState("");
  const [editingMoney, setEditingMoney] = useState<string | null>(null);
  const attr = character?.negotiationAttributes.includes(attribute as never)
    ? attribute
    : (character?.negotiationAttributes[0] ?? "");
  const owned = character?.inventory.reduce((n, i) => n + i.qty, 0) ?? 0;

  return (
    <header className="shrink-0 space-y-4 border-b border-border px-6 pt-5 pb-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pr-8">
        <h2 className="text-xl font-semibold tracking-tight">Loja</h2>
        {character && (
          <>
            {view.characters.length > 1 ? (
              <select
                aria-label="Personagem"
                value={character.id}
                onChange={(e) => onCharacter(e.target.value)}
                className={fieldClass}
              >
                {view.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="pb-1 text-sm text-muted-foreground">{character.name}</span>
            )}
            <div className="ml-auto text-right">
              <div className="text-xs text-muted-foreground">Dinheiro</div>
              {editingMoney === null ? (
                <button
                  type="button"
                  disabled={!view.isMaster}
                  onClick={() => setEditingMoney(String(character.money))}
                  title={view.isMaster ? "Alterar o dinheiro" : undefined}
                  className="text-2xl leading-none font-semibold text-primary tabular-nums enabled:hover:underline enabled:hover:underline-offset-4"
                >
                  {co(character.money)}
                </button>
              ) : (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = Number(editingMoney.replace(",", "."));
                    setEditingMoney(null);
                    void act("money", () => setMoneyAction(character.id, value), `Dinheiro de ${character.name}: ${co(value)}.`);
                  }}
                >
                  <Input
                    autoFocus
                    inputMode="decimal"
                    aria-label="Dinheiro em CO"
                    value={editingMoney}
                    onChange={(e) => setEditingMoney(e.target.value)}
                    className="h-9 w-28 text-right tabular-nums"
                  />
                  <Button type="submit" size="sm">
                    Salvar
                  </Button>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-lg bg-muted p-1">
          {(["buy", "inventory"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => onTab(t)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "buy" ? "Comprar" : `Inventário${owned ? ` (${owned})` : ""}`}
            </button>
          ))}
        </div>

        {character && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Paga <strong className="font-semibold text-foreground tabular-nums">{character.rates.buy}%</strong> · recebe{" "}
              <strong className="font-semibold text-foreground tabular-nums">{character.rates.sell}%</strong>
            </span>
            {character.negotiationAttributes.length > 0 && (
              <>
                <select
                  aria-label="Atributo da Negociação"
                  value={attr}
                  onChange={(e) => setAttribute(e.target.value)}
                  className={fieldClass}
                >
                  {character.negotiationAttributes.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                {(["buy", "sell"] as const).map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={character.negotiated[kind] || busy !== null}
                    title={character.negotiated[kind] ? "Já negociado (o livro não permite repetir o teste)" : undefined}
                    onClick={() =>
                      act(
                        `neg-${kind}`,
                        () => negotiateAction(character.id, kind, attr),
                        "Negociação rolada; o resultado está no chat.",
                      )
                    }
                  >
                    <Dices className="size-4" /> Negociar {kind === "buy" ? "compra" : "venda"}
                  </Button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function BuyList({
  items,
  character,
  isMaster,
  busy,
  act,
}: {
  items: Equipment[];
  character: ShopCharacter | null;
  isMaster: boolean;
  busy: string | null;
  act: Act;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [category, setCategory] = useState<EquipmentCategory | "">("");
  const rate = character?.rates.buy ?? 100;

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    return CATEGORIES.filter(([slug]) => !category || slug === category)
      .map(([slug, label]) => ({
        slug,
        label,
        items: items.filter((i) => i.category === slug && normalize(i.name).includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [items, query, category]);

  return (
    <div className="grid h-full md:grid-cols-[14rem_1fr]">
      <nav aria-label="Categorias" className="hidden overflow-y-auto border-r border-border py-3 md:block">
        {[["", "Todas"] as const, ...CATEGORIES].map(([slug, label]) => (
          <button
            key={slug}
            type="button"
            onClick={() => setCategory(slug)}
            aria-current={category === slug}
            className={cn(
              "block w-full px-5 py-1.5 text-left text-sm transition-colors",
              category === slug ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-col">
        <div className="flex shrink-0 gap-2 px-6 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pelo nome"
              aria-label="Buscar item pelo nome"
              className="h-9 pl-9"
            />
          </div>
          <select
            aria-label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value as EquipmentCategory | "")}
            className={cn(fieldClass, "max-w-40 md:hidden")}
          >
            <option value="">Todas</option>
            {CATEGORIES.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {groups.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">Nenhum item com esse nome.</p>}
          {groups.map((group) => (
            <section key={group.slug} aria-label={group.label}>
              <h3 className="sticky top-0 z-10 bg-background/95 px-6 pt-4 pb-1.5 text-sm font-semibold backdrop-blur-sm">
                {group.label}
              </h3>
              <ul>
                {group.items.map((item) => {
                  const price = priceWith(item.price, 1, rate);
                  const short = character !== null && price > character.money;
                  return (
                    <li key={item.slug}>
                      <div className="flex items-center gap-3 px-6 py-1.5 transition-colors hover:bg-accent/40">
                        <button
                          type="button"
                          onClick={() => setExpanded(expanded === item.slug ? null : item.slug)}
                          aria-expanded={expanded === item.slug}
                          disabled={!item.details}
                          title={item.details ? undefined : "O livro só traz o preço deste item."}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm"
                        >
                          <span className="min-w-0">
                            {item.name}
                            {item.armorType && <span className="ml-2 text-xs text-muted-foreground">{item.armorType}</span>}
                          </span>
                          {item.details && (
                            <ChevronDown
                              className={cn(
                                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                                expanded === item.slug && "rotate-180",
                              )}
                            />
                          )}
                        </button>
                        <span className="text-right text-sm tabular-nums">
                          {rate !== 100 && <s className="mr-1.5 text-xs text-muted-foreground">{coins.format(item.price)}</s>}
                          {item.addOn && "+"}
                          {co(price)}
                          {item.minimum && "+"}
                        </span>
                        {character && (
                          <span className="flex w-24 justify-end gap-1">
                            {isMaster && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={`Dar ${item.name}`}
                                title="Dar (de graça)"
                                disabled={busy !== null}
                                onClick={() =>
                                  act(
                                    `give-${item.slug}`,
                                    () => giveItemAction(character.id, item.slug),
                                    `${item.name} dado a ${character.name}.`,
                                  )
                                }
                              >
                                <Gift className="size-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy !== null || short}
                              title={short ? "Dinheiro insuficiente" : undefined}
                              onClick={() =>
                                act(
                                  `buy-${item.slug}`,
                                  () => buyAction(character.id, item.slug),
                                  `Comprou ${item.name} por ${co(price)}.`,
                                )
                              }
                            >
                              {busy === `buy-${item.slug}` ? "…" : "Comprar"}
                            </Button>
                          </span>
                        )}
                      </div>
                      {expanded === item.slug && item.details && <ItemDetails item={item} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Inventory({
  items,
  character,
  isMaster,
  busy,
  act,
}: {
  items: Equipment[];
  character: ShopCharacter | null;
  isMaster: boolean;
  busy: string | null;
  act: Act;
}) {
  if (!character || character.inventory.length === 0) {
    return (
      <p className="px-6 py-6 text-sm text-muted-foreground">Nenhum item ainda. O que for comprado aparece aqui para vender.</p>
    );
  }
  const prices = new Map(items.map((i) => [i.slug, i.price]));
  return (
    <ul className="h-full overflow-y-auto py-3">
      {character.inventory.map((entry) => {
        const value = priceWith(prices.get(entry.id) ?? 0, 1, character.rates.sell);
        return (
          <li key={entry.id} className="flex items-center gap-3 px-6 py-1.5 transition-colors hover:bg-accent/40">
            <span className="min-w-0 flex-1 text-sm">
              {entry.name}
              {entry.qty > 1 && <span className="ml-2 text-muted-foreground tabular-nums">×{entry.qty}</span>}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">vende por {co(value)}</span>
            <span className="flex w-24 justify-end gap-1">
              {isMaster && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={`Tirar ${entry.name}`}
                  title="Tirar (sem pagar)"
                  disabled={busy !== null}
                  onClick={() =>
                    act(
                      `take-${entry.id}`,
                      () => takeItemAction(character.id, entry.id),
                      `${entry.name} retirado de ${character.name}.`,
                    )
                  }
                >
                  <Minus className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  act(`sell-${entry.id}`, () => sellAction(character.id, entry.id), `Vendeu ${entry.name} por ${co(value)}.`)
                }
              >
                {busy === `sell-${entry.id}` ? "…" : "Vender"}
              </Button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** O que o livro diz do item: campos curtos (Perícia, POD, ARM…) em grade; descrição e regras em texto. */
export function ItemDetails({ item }: { item: Pick<Equipment, "details" | "sourcePage"> }) {
  const fields = (item.details ?? []).map((d) => ({
    ...d,
    text: d.text.replace(/\.$/, ""),
  }));
  const short = fields.filter((d) => d.text.length <= 40);
  const long = fields.filter((d) => d.text.length > 40);
  return (
    <div className="space-y-3 px-6 pt-1 pb-4">
      {short.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {short.map((d) => (
            <div key={d.label}>
              <dt className="text-[11px] text-muted-foreground">{d.label}</dt>
              <dd className="text-sm">{d.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {long.map((d) => (
        <div key={d.label} className="max-w-prose">
          <h4 className="text-[11px] text-muted-foreground">{d.label}</h4>
          <p className="text-sm leading-relaxed first-letter:uppercase">{d.text}.</p>
        </div>
      ))}
      {item.sourcePage && <p className="text-xs text-muted-foreground">Livro, p. {item.sourcePage}</p>}
    </div>
  );
}
