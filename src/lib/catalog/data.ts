// Catálogo do manual lido direto dos JSON em data/catalog/ e validado.
// É a fonte do seed do banco (scripts/seed-catalog.mjs) e dos testes; em
// execução o app lê o mesmo conteúdo do banco (uma tabela por tipo: racas, carreiras, magias, equipamentos…).
import { z } from "zod";
import racesJson from "../../../data/catalog/races.json";
import archetypesJson from "../../../data/catalog/archetypes.json";
import skillsJson from "../../../data/catalog/skills.json";
import abilitiesJson from "../../../data/catalog/abilities.json";
import spellsJson from "../../../data/catalog/spells.json";
import spellListsJson from "../../../data/catalog/spell-lists.json";
import careersJson from "../../../data/catalog/careers.json";
import connectionsJson from "../../../data/catalog/connections.json";
import actionsJson from "../../../data/catalog/actions.json";
import progressionJson from "../../../data/catalog/progression.json";
import equipmentJson from "../../../data/catalog/equipment.json";
import {
  abilitySchema,
  actionSchema,
  archetypeSchema,
  careerSchema,
  connectionSchema,
  equipmentSchema,
  progressionSchema,
  raceSchema,
  skillSchema,
  spellListSchema,
  spellSchema,
  type Catalog,
} from "./schemas";

export const catalogFromFiles: Catalog = {
  races: z.array(raceSchema).parse(racesJson),
  archetypes: z.array(archetypeSchema).parse(archetypesJson),
  skills: z.array(skillSchema).parse(skillsJson),
  abilities: z.array(abilitySchema).parse(abilitiesJson),
  spells: z.array(spellSchema).parse(spellsJson),
  spellLists: z.array(spellListSchema).parse(spellListsJson),
  careers: z.array(careerSchema).parse(careersJson),
  connections: z.array(connectionSchema).parse(connectionsJson),
  actions: z.array(actionSchema).parse(actionsJson),
  progression: progressionSchema.parse(progressionJson),
  equipment: z.array(equipmentSchema).parse(equipmentJson),
};
