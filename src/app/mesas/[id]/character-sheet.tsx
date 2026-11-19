"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActionCost } from "@/lib/catalog/schemas";
import type { CharacterDetails } from "@/lib/engine/character";
import type { CharacterView } from "@/lib/mesas/characters";
import { updateCharacterStateAction } from "./character-actions";
import { AbilitiesTab } from "./sheet-abilities";
import { AdvanceBadge } from "./sheet-advance";
import { CombatTab } from "./sheet-combat";
import { EquipmentTab } from "./sheet-equipment";
import { SpellsTab } from "./sheet-spells";
import { FichaTab } from "./sheet-ficha";
import { NotesTab } from "./sheet-notes";
import { PersonalTab } from "./sheet-personal";
import { SkillsTab } from "./sheet-skills";

export const SHEET_TABS = [
  ["ficha", "Ficha"],
  ["combate", "Combate"],
  ["pericias", "Perícias"],
  ["habilidades", "Habilidades e benefícios"],
  ["equipamentos", "Equipamentos"],
  ["magias", "Magias"],
  ["notas", "Notas"],
  ["pessoal", "Pessoal"],
] as const;

/**
 * Ficha completa, em abas. Só o dono do personagem e o Mestre chegam aqui (o backend não entrega a ficha a
 * mais ninguém) e os dois podem editar. Cada mudança é salva na hora e `onChanged` avisa os outros.
 */
export function CharacterSheetView({
  view,
  tab,
  onTabChange,
  onChanged,
  onDeleted,
}: {
  view: CharacterView;
  tab: string;
  onTabChange: (tab: string) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const sheet = view.sheet;
  // Aba Magias só para quem conjura (Dotado/ARC, ou com magias de carreira).
  const casts = !!sheet && (sheet.spellLimit !== null || sheet.spells.length > 0);
  const [marks, setMarks] = useState(view.marks);
  const [actionsUsed, setActionsUsed] = useState(view.actionsUsed);
  const [imageUrl, setImageUrl] = useState(view.imageUrl);
  const [details, setDetails] = useState<CharacterDetails | undefined>(sheet?.details);
  const [saveError, setSaveError] = useState(false);

  if (!sheet || !details) {
    return (
      <p className="text-sm text-muted-foreground">
        Não foi possível montar a ficha de {view.name}: as escolhas guardadas não batem mais com o catálogo do livro.
      </p>
    );
  }

  function persist(patch: { marks?: number[]; actionsUsed?: ActionCost[] }) {
    updateCharacterStateAction(view.id, patch).then((r) => {
      setSaveError(!r.ok);
      if (r.ok) onChanged();
    });
  }
  const changeMarks = (next: number[]) => {
    setMarks(next);
    persist({ marks: next });
  };
  const changeActions = (next: ActionCost[]) => {
    setActionsUsed(next);
    persist({ actionsUsed: next });
  };

  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList aria-label="Seções da ficha" className="sticky top-0 z-10 bg-card">
        {SHEET_TABS.filter(([id]) => id !== "magias" || casts).map(([id, label]) => (
          <TabsTrigger key={id} value={id}>
            {label}
          </TabsTrigger>
        ))}
        <AdvanceBadge characterId={view.id} next={view.advance} onChanged={onChanged} />
      </TabsList>
      {saveError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível salvar a última mudança.
        </p>
      )}
      <TabsContent value="ficha">
        <FichaTab view={view} name={details.name} sheet={sheet} imageUrl={imageUrl} marks={marks} onMarks={changeMarks} />
      </TabsContent>
      <TabsContent value="combate">
        <CombatTab sheet={sheet} actions={view.actions} marks={marks} onMarks={changeMarks} actionsUsed={actionsUsed} onActionsUsed={changeActions} />
      </TabsContent>
      <TabsContent value="equipamentos">
        <EquipmentTab characterId={view.id} money={view.money} equipment={view.equipment} onChanged={onChanged} />
      </TabsContent>
      <TabsContent value="pericias">
        <SkillsTab sheet={sheet} />
      </TabsContent>
      <TabsContent value="habilidades">
        <AbilitiesTab sheet={sheet} />
      </TabsContent>
      <TabsContent value="magias">
        <SpellsTab sheet={sheet} />
      </TabsContent>
      <TabsContent value="notas">
        <NotesTab characterId={view.id} notes={view.notes} onChanged={onChanged} />
      </TabsContent>
      <TabsContent value="pessoal">
        <PersonalTab characterId={view.id} details={details} onDetails={setDetails} imageUrl={imageUrl} onImageUrl={setImageUrl} onChanged={onChanged} onDeleted={onDeleted} />
      </TabsContent>
    </Tabs>
  );
}
