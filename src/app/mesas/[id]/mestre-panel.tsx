"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, Skull, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { XpCharacter } from "@/lib/mesas/xp";
import { cn } from "@/lib/utils";
import { giveXpAction, listXpAction } from "./mestre-actions";
import { combatAction } from "./actions";

/** Prêmios de XP do livro (p. 151), dados no fim de cada sessão. */
const AWARDS = [
  { id: "jogo", name: "Prêmio do Jogo", note: "por sessão em que o personagem participou", xp: 1 },
  {
    id: "equipe",
    name: "Prêmio por Trabalho de Equipe",
    note: "um plano que usou as forças de vários personagens, com raciocínio e coordenação",
    xp: 1,
  },
  { id: "marco", name: "Bônus de Marco", note: "um avanço importante na história", xp: 1 },
] as const;
const STORY_NOTE = "conclusão de uma história principal, conforme o tamanho e a dificuldade (+1 a +3)";

/** Aba do Mestre: XP e, quando a ficha estiver estável, o Bestiário. */
export function MestrePanel({
  tableId,
  sceneId,
  onCharactersChanged,
}: {
  tableId: string;
  sceneId: string | null;
  onCharactersChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [combatError, setCombatError] = useState<string | null>(null);

  // Todos no mapa rolam iniciativa; a lista de turnos aparece no mapa para todos.
  async function startCombat() {
    if (!sceneId) return;
    setStarting(true);
    const result = await combatAction(sceneId, "start");
    setStarting(false);
    setCombatError(result.ok ? null : result.error);
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Ferramentas que só o Mestre vê.</p>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        disabled={!sceneId || starting}
        onClick={startCombat}
      >
        <Swords className="size-4" /> {starting ? "Rolando iniciativa…" : "Iniciar combate"}
      </Button>
      {combatError && <p className="text-xs text-destructive">{combatError}</p>}
      <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setOpen(true)}>
        <Award className="size-4" /> XP
      </Button>
      <Button type="button" variant="outline" className="w-full justify-start" disabled title="Depende da ficha estar pronta">
        <Skull className="size-4" /> Bestiário <span className="ml-auto text-xs">em breve</span>
      </Button>
      {open && <XpDialog tableId={tableId} onClose={() => setOpen(false)} onGiven={onCharactersChanged} />}
    </div>
  );
}

function XpDialog({ tableId, onClose, onGiven }: { tableId: string; onClose: () => void; onGiven: () => void }) {
  const [list, setList] = useState<XpCharacter[] | null | undefined>(undefined);
  const [awards, setAwards] = useState<Set<string>>(() => new Set(["jogo"]));
  const [story, setStory] = useState(0);
  const [manualTotal, setManualTotal] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, { on: boolean; amount: string | null }>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const reload = useCallback(() => listXpAction(tableId).then(setList, () => setList(null)), [tableId]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const fromAwards = AWARDS.filter((a) => awards.has(a.id)).reduce((n, a) => n + a.xp, 0) + story;
  const total = manualTotal ?? String(fromAwards);
  const amountOf = (id: string) => picked[id]?.amount ?? total;
  const isOn = (id: string) => picked[id]?.on ?? true;

  function toggleAward(id: string) {
    setManualTotal(null);
    setAwards((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function give() {
    if (!list) return;
    const chosen = list.filter((c) => isOn(c.id)).map((c) => ({ characterId: c.id, amount: Number(amountOf(c.id)) }));
    if (chosen.some((c) => !Number.isInteger(c.amount) || c.amount < 1 || c.amount > 50)) {
      return setMessage({ text: "Cada valor precisa ser um número inteiro de 1 a 50.", error: true });
    }
    setSaving(true);
    const result = await giveXpAction(tableId, chosen);
    setSaving(false);
    if (!result.ok) return setMessage({ text: result.message ?? "Não foi possível dar o XP.", error: true });
    setMessage({
      text: `XP entregue: ${chosen.map((c) => `${list.find((x) => x.id === c.characterId)?.name} +${c.amount}`).join(", ")}.`,
      error: false,
    });
    setPicked({});
    await reload();
    onGiven();
  }

  return (
    <Dialog modal={false} open onOpenChange={(o) => !o && onClose()}>
      <DialogContent floating className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <header className="shrink-0 border-b border-border px-6 pt-5 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">XP</DialogTitle>
          <DialogDescription className="mt-1">
            Dado no fim da sessão; cada personagem pode receber um valor diferente, ou nada.
          </DialogDescription>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Prêmios do livro (p. 151)</h3>
            <ul className="space-y-1">
              {AWARDS.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-accent/40">
                    <input
                      type="checkbox"
                      checked={awards.has(a.id)}
                      onChange={() => toggleAward(a.id)}
                      className="mt-1 accent-primary"
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      {a.name} <span className="text-muted-foreground">— {a.note}</span>
                    </span>
                    <span className="text-sm text-primary tabular-nums">+{a.xp}</span>
                  </label>
                </li>
              ))}
              <li className="flex items-start gap-3 px-2 py-1.5">
                <span className="min-w-0 flex-1 pl-7 text-sm">
                  Conclusão de história <span className="text-muted-foreground">— {STORY_NOTE}</span>
                </span>
                <select
                  aria-label="XP da conclusão de história"
                  value={story}
                  onChange={(e) => (setManualTotal(null), setStory(Number(e.target.value)))}
                  className="h-8 rounded-md border border-input bg-card px-2 text-sm"
                >
                  <option value={0}>não</option>
                  <option value={1}>+1</option>
                  <option value={2}>+2</option>
                  <option value={3}>+3</option>
                </select>
              </li>
            </ul>
            <label className="flex items-center justify-end gap-3 pt-1 text-sm">
              XP para cada um
              <Input
                inputMode="numeric"
                value={total}
                onChange={(e) => setManualTotal(e.target.value)}
                className="h-9 w-20 text-right tabular-nums"
                aria-label="XP para cada um"
              />
            </label>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Quem recebe</h3>
            {list === undefined && <p className="text-sm text-muted-foreground">Carregando os personagens…</p>}
            {list === null && (
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar os personagens.
              </p>
            )}
            {list?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum personagem na mesa ainda.</p>}
            <ul className="divide-y divide-border">
              {list?.map((c) => (
                <li key={c.id} className={cn("flex items-center gap-3 py-2", !isOn(c.id) && "opacity-60")}>
                  <input
                    type="checkbox"
                    aria-label={`Dar XP a ${c.name}`}
                    checked={isOn(c.id)}
                    onChange={(e) =>
                      setPicked((p) => ({ ...p, [c.id]: { on: e.target.checked, amount: p[c.id]?.amount ?? null } }))
                    }
                    className="accent-primary"
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    {c.name} <span className="text-muted-foreground">· {c.ownerName}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{c.xp} XP</span>
                  <Input
                    inputMode="numeric"
                    aria-label={`XP para ${c.name}`}
                    disabled={!isOn(c.id)}
                    value={amountOf(c.id)}
                    onChange={(e) => setPicked((p) => ({ ...p, [c.id]: { on: true, amount: e.target.value } }))}
                    className="h-9 w-20 text-right tabular-nums"
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-border px-6 py-3">
          <p
            role="status"
            className={cn("min-w-0 flex-1 text-sm", message?.error ? "text-destructive" : "text-muted-foreground")}
          >
            {message?.text}
          </p>
          <Button type="button" onClick={give} disabled={saving || !list?.length}>
            {saving ? "Dando…" : "Dar XP"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
