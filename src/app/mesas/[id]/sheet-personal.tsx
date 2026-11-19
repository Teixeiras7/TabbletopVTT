"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CharacterDetails } from "@/lib/engine/character";
import { BACKGROUND_TOO_BIG_MESSAGE, MAX_BACKGROUND_BYTES } from "@/lib/mesas/map";
import { deleteCharacterAction, removeCharacterImageAction, updateCharacterDetailsAction, uploadCharacterImageAction } from "./character-actions";
import { Avatar } from "./sheet-ficha";

const FIELDS: { key: keyof CharacterDetails; label: string }[] = [
  { key: "age", label: "Idade" },
  { key: "nationality", label: "Nacionalidade" },
  { key: "filiation", label: "Filiação" },
  { key: "organization", label: "Organização" },
  { key: "height", label: "Altura" },
  { key: "weight", label: "Peso" },
  { key: "crimes", label: "Crimes" },
];

/** Dados pessoais e imagem do personagem. O dono e o Mestre editam; imagem pode ser incluída, trocada ou removida. */
export function PersonalTab({
  characterId,
  details,
  onDetails,
  imageUrl,
  onImageUrl,
  onChanged,
  onDeleted,
}: {
  characterId: string;
  details: CharacterDetails;
  onDetails: (d: CharacterDetails) => void;
  imageUrl: string | null;
  onImageUrl: (url: string | null) => void;
  onChanged: () => void;
  /** Depois de excluir: fecha a ficha. */
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<CharacterDetails | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [imageMessage, setImageMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setErrors([]);
    const result = await updateCharacterDetailsAction(characterId, draft);
    setBusy(false);
    if (!result.ok) return setErrors(result.errors);
    onDetails({ ...draft, name: draft.name.trim() });
    setDraft(null);
    onChanged();
  }

  async function remove() {
    if (!(await confirm(`Excluir ${details.name}?`, { message: "A ficha, as notas, o dinheiro e o inventário somem e isso não pode ser desfeito." }))) return;
    setBusy(true);
    const result = await deleteCharacterAction(characterId);
    setBusy(false);
    if (!result.ok) return setErrors(result.errors);
    onChanged();
    onDeleted();
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BACKGROUND_BYTES) return setImageMessage(BACKGROUND_TOO_BIG_MESSAGE);
    setBusy(true);
    setImageMessage(null);
    const data = new FormData();
    data.set("file", file);
    const result = await uploadCharacterImageAction(characterId, data);
    setBusy(false);
    if (result.ok) {
      onImageUrl(result.imageUrl);
      onChanged();
    } else setImageMessage(result.message);
  }

  async function removeImage() {
    setBusy(true);
    setImageMessage(null);
    const result = await removeCharacterImageAction(characterId);
    setBusy(false);
    if (result.ok) {
      onImageUrl(null);
      onChanged();
    } else setImageMessage(result.message);
  }

  const set = (key: keyof CharacterDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => draft && setDraft({ ...draft, [key]: e.target.value });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="space-y-2 sm:w-48 sm:shrink-0">
          <Avatar name={details.name} imageUrl={imageUrl} className="aspect-square w-full rounded-xl object-cover" />
          {draft && (
            <div className="flex flex-col gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input px-3 text-sm hover:bg-accent">
                {imageUrl ? "Trocar imagem" : "Anexar imagem"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={upload} />
              </label>
              {imageUrl && (
                <Button type="button" variant="outline" disabled={busy} onClick={removeImage}>
                  Remover imagem
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPEG ou WEBP, até {MAX_BACKGROUND_BYTES / 1024 / 1024} MB.</p>
              <Button type="button" variant="ghost" className="mt-2 text-destructive hover:text-destructive" disabled={busy} onClick={remove}>
                <Trash2 className="size-4" /> Excluir personagem
              </Button>
            </div>
          )}
          {imageMessage && <p role="alert" className="text-xs text-destructive">{imageMessage}</p>}
        </div>

        <div className="min-w-0 flex-1">
          {draft ? (
            <form onSubmit={save} className="space-y-4">
              {errors.map((e) => (
                <p key={e} role="alert" className="text-sm text-destructive">
                  {e}
                </p>
              ))}
              <Field>
                <FieldLabel htmlFor="p-name">Nome</FieldLabel>
                <Input id="p-name" value={draft.name} onChange={set("name")} maxLength={60} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.filter((f) => f.key !== "crimes").map((f) => (
                  <Field key={f.key}>
                    <FieldLabel htmlFor={`p-${f.key}`}>{f.label}</FieldLabel>
                    <Input id={`p-${f.key}`} value={draft[f.key]} onChange={set(f.key)} maxLength={f.key === "filiation" || f.key === "organization" ? 120 : 60} />
                  </Field>
                ))}
              </div>
              <Field>
                <FieldLabel htmlFor="p-crimes">Crimes</FieldLabel>
                <Textarea id="p-crimes" value={draft.crimes} onChange={set("crimes")} maxLength={500} rows={2} />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-appearance">Aparência</FieldLabel>
                <Textarea id="p-appearance" value={draft.appearance} onChange={set("appearance")} maxLength={1000} rows={4} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setDraft(null); setErrors([]); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold break-words">{details.name}</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => { setErrors([]); setDraft(details); }}>
                  <Pencil className="size-3.5" /> Editar
                </Button>
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className={f.key === "crimes" ? "sm:col-span-2" : ""}>
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="break-words whitespace-pre-wrap">{details[f.key] || <span className="text-muted-foreground">—</span>}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <div className="text-xs text-muted-foreground">Aparência</div>
                <p className="text-sm break-words whitespace-pre-wrap">{details.appearance || <span className="text-muted-foreground">—</span>}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
