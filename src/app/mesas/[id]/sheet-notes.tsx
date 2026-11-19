"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CharacterNote } from "@/lib/db/schema";
import { createCharacterNoteAction, deleteCharacterNoteAction, updateCharacterNoteAction } from "./character-actions";

type Draft = { id: string | null; title: string; content: string };

/** Notas do personagem: criar, editar e excluir. Só o dono e o Mestre veem esta aba. */
export function NotesTab({ characterId, notes, onChanged }: { characterId: string; notes: CharacterNote[]; onChanged: () => void }) {
  const [list, setList] = useState(notes);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setErrors([]);
    const payload = { title: draft.title, content: draft.content };
    const result = draft.id ? await updateCharacterNoteAction(characterId, draft.id, payload) : await createCharacterNoteAction(characterId, payload);
    setSaving(false);
    if (!result.ok) return setErrors(result.errors);
    const note = { id: draft.id ?? result.id, title: draft.title.trim(), content: draft.content.trim() };
    setList((prev) => (draft.id ? prev.map((n) => (n.id === draft.id ? note : n)) : [note, ...prev]));
    setDraft(null);
    onChanged();
  }

  async function remove(note: CharacterNote) {
    if (!(await confirm(`Excluir a nota "${note.title}"?`))) return;
    const result = await deleteCharacterNoteAction(characterId, note.id);
    if (result.ok) {
      setList((prev) => prev.filter((n) => n.id !== note.id));
      onChanged();
    } else setErrors(result.errors);
  }

  return (
    <div className="space-y-4">
      {!draft && (
        <Button type="button" onClick={() => { setErrors([]); setDraft({ id: null, title: "", content: "" }); }}>
          <Plus className="size-4" /> Nova nota
        </Button>
      )}

      {draft && (
        <form onSubmit={save} className="space-y-3 rounded-lg border border-border p-4">
          {errors.map((e) => (
            <p key={e} role="alert" className="text-sm text-destructive">
              {e}
            </p>
          ))}
          <Field>
            <FieldLabel htmlFor="note-title">Título</FieldLabel>
            <Input id="note-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={80} autoFocus />
          </Field>
          <Field>
            <FieldLabel htmlFor="note-content">Nota</FieldLabel>
            <Textarea id="note-content" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} maxLength={5000} rows={6} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      )}

      {!draft && errors.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {errors.join(" ")}
        </p>
      )}

      {list.length === 0 && !draft ? (
        <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <h4 className="min-w-0 text-sm font-semibold break-words">{n.title}</h4>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Editar ${n.title}`} onClick={() => { setErrors([]); setDraft({ id: n.id, title: n.title, content: n.content }); }}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" aria-label={`Excluir ${n.title}`} onClick={() => remove(n)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap text-muted-foreground">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
