import { describe, expect, it } from "vitest";
import { catalogFromFiles } from "@/lib/catalog/data";
import {
  baseAttributes,
  actionRows,
  benefitParamOptions,
  canSpend,
  clampMarks,
  spiralBranches,
  spiralStatus,
  validActionsUsed,
  careerBlockReason,
  chooseGroups,
  evaluateCharacter,
  extraAbilityOptions,
  indexCatalog,
  languageSlots,
  parsePrerequisites,
  pendingAdvances,
  nextAdvance,
  type CareerPick,
  type CharacterChoices,
  type CharacterDetails,
} from "./character";

const idx = indexCatalog(catalogFromFiles);
const details = (over: Partial<CharacterDetails> = {}): CharacterDetails => ({
  name: "Teste",
  age: "30",
  nationality: "Ordic",
  filiation: "",
  organization: "",
  crimes: "",
  height: "",
  weight: "",
  appearance: "",
  ...over,
});
const pick = (career: string, over: Partial<CareerPick> = {}): CareerPick => {
  const c = idx.careers.get(career)!;
  return {
    career,
    skillChoices: chooseGroups(c).map((g) => g.options.slice(0, g.count).map((o) => o.skill)),
    languages: Array.from({ length: languageSlots(c) }, () => "Cygnarano"),
    variant: c.variants?.[0]?.slug,
    ...over,
  };
};
const base = (over: Partial<CharacterChoices> = {}): CharacterChoices => ({
  race: "humano",
  raceAttributeChoice: "FIS",
  archetype: "poderoso",
  archetypeBenefit: "durao",
  careers: [pick("cavaleiro"), pick("soldado", { skillChoices: [["arma-de-mao", "fuzil"]] })],
  attributePoints: { FOR: 1, AGI: 1, MAE: 1 },
  ...over,
});

describe("criação de personagem: montagem da ficha", () => {
  it("humano Poderoso cavaleiro + soldado: atributos, derivados e perícias do livro", () => {
    const { errors, sheet } = evaluateCharacter(idx, base(), details());
    expect(errors).toEqual([]);
    // Humano FIS 5 (+1 Potencial Excepcional) = 6; FOR 4+1; AGI 3+1; MAE 4+1
    expect(sheet!.attributes).toMatchObject({ FIS: 6, VEL: 6, FOR: 5, AGI: 4, DES: 4, MAE: 5, INT: 3, PER: 3, ARC: null });
    expect(sheet!.derived).toEqual({
      defense: 6 + 4 + 3, // VEL + AGI + PER
      initiative: 6 + 5 + 3, // VEL + MAE + PER
      armor: 6, // FIS
      willpower: 6 + 3, // FIS + INT
      commandRange: 3 + 1, // INT + Comandar 1 (cavaleiro)
    });
    expect(sheet!.vitality).toEqual({ FIS: 6, AGI: 4, INT: 3 });
    expect(sheet!.gold).toBe(200);
    expect(sheet!.facadePoints).toBe(3);
    // Arma de Mão vem das duas carreiras: começa no nível 2 (p. 116)
    const armaDeMao = sheet!.skills.find((s) => s.slug === "arma-de-mao")!;
    expect(armaDeMao.level).toBe(2);
    expect(armaDeMao.total).toBe(5 + 2); // MAE 5 + nível 2
    expect(sheet!.skills.find((s) => s.slug === "arma-grande")!.level).toBe(1);
    expect(sheet!.abilities.map((a) => a.slug)).toEqual(expect.arrayContaining(["defensor", "trespassar", "encontrar-cobertura", "sentinela"]));
    expect(sheet!.benefits.map((b) => b.slug)).toEqual(["durao"]);
  });

  it("Gobber: +1 DEF, benefício Ágil de graça, sem arma grande nem fuzil", () => {
    const choices = base({
      race: "gobber",
      raceAttributeChoice: undefined,
      archetype: "habilidoso",
      archetypeBenefit: "ambidestro",
      careers: [pick("soldado", { skillChoices: [["arma-de-mao", "pistola"]] }), pick("ladrao")],
      attributePoints: { VEL: 1, DES: 1, PER: 1 },
    });
    const { errors, sheet } = evaluateCharacter(idx, choices, details());
    expect(errors).toEqual([]);
    expect(sheet!.derived.defense).toBe(sheet!.attributes.VEL! + sheet!.attributes.AGI! + sheet!.attributes.PER! + 1);
    expect(sheet!.benefits.map((b) => b.slug)).toEqual(expect.arrayContaining(["agil", "ambidestro"]));
    const bad = evaluateCharacter(idx, { ...choices, careers: [pick("soldado", { skillChoices: [["arma-grande", "fuzil"]] }), pick("ladrao")] }, details());
    expect(bad.errors.some((e) => e.step === 3)).toBe(true);
  });

  it("não aceita o benefício que a raça já dá (Gobber já tem Ágil)", () => {
    const { errors } = evaluateCharacter(idx, base({ race: "gobber", raceAttributeChoice: undefined, archetype: "habilidoso", archetypeBenefit: "agil" }), details());
    expect(errors.some((e) => e.step === 2)).toBe(true);
  });

  it("Dotado: ARC pela tradição (tecelão 3, focalizador 2) e limite de magias 2 × INT", () => {
    const tecelao = base({
      archetype: "dotado",
      archetypeBenefit: "leitura-de-runas",
      careers: [pick("arcanista"), pick("soldado", { skillChoices: [["arma-de-mao", "pistola"]] })],
      attributePoints: { ARC: 1, INT: 1, PER: 1 },
    });
    const a = evaluateCharacter(idx, tecelao, details());
    expect(a.errors).toEqual([]);
    expect(a.sheet!.tradition).toBe("tecelao");
    expect(a.sheet!.attributes.ARC).toBe(3 + 1);
    expect(a.sheet!.spells.map((s) => s.slug)).toEqual(["aura-de-protecao", "luz-nas-trevas", "raio-arcano"]);
    expect(a.sheet!.spellLimit).toBe((3 + 1) * 2);
    expect(a.sheet!.benefits.map((b) => b.slug)).toEqual(["leitura-de-runas"]); // dedupe do benefício dado pela carreira

    const foco = base({ archetype: "dotado", archetypeBenefit: "conjurador-rapido", careers: [pick("conjurador-de-guerra", { gear: [0] }), pick("soldado", { skillChoices: [["arma-de-mao", "pistola"]] })], attributePoints: { ARC: 1, INT: 1, PER: 1 } });
    const b = evaluateCharacter(idx, foco, details());
    expect(b.errors).toEqual([]);
    expect(b.sheet!.tradition).toBe("focalizador");
    expect(b.sheet!.attributes.ARC).toBe(2 + 1);
  });

  it("sem Dotado não há ARC; gastar ponto em ARC é erro", () => {
    expect(baseAttributes(idx, base()).ARC).toBeNull();
    const { errors } = evaluateCharacter(idx, base({ attributePoints: { ARC: 3 } }), details());
    expect(errors.some((e) => e.step === 4)).toBe(true);
  });

  it("Feiticeiro de Pedra: +1 FIS inicial e +1 no máximo; elemento é obrigatório", () => {
    const pedra = base({
      archetype: "dotado",
      archetypeBenefit: "conjurador-rapido",
      raceAttributeChoice: "AGI",
      careers: [pick("feiticeiro", { variant: "pedra" }), pick("soldado", { skillChoices: [["arma-de-mao", "pistola"]] })],
      attributePoints: { ARC: 1, INT: 1, FIS: 1 },
    });
    const { errors, sheet } = evaluateCharacter(idx, pedra, details());
    expect(errors).toEqual([]);
    expect(sheet!.attributes.FIS).toBe(5 + 1 + 1); // inicial + elemento + ponto
    expect(sheet!.limits.FIS).toBe(7 + 1);
    expect(sheet!.spells.map((s) => s.slug)).toEqual(expect.arrayContaining(["ariete", "postura-de-pedra", "terreno-solido"]));
    expect(evaluateCharacter(idx, { ...pedra, careers: [pick("feiticeiro", { variant: undefined }), pedra.careers[1]!] }, details()).errors.length).toBeGreaterThan(0);
  });

  it("Sacerdote: religião define habilidade, perícias e magias iniciais", () => {
    const sac = base({
      archetype: "dotado",
      archetypeBenefit: "conjurador-rapido",
      careers: [pick("sacerdote", { variant: "menoth" }), pick("cavaleiro")],
      attributePoints: { ARC: 1, INT: 1, PER: 1 },
    });
    const { errors, sheet } = evaluateCharacter(idx, sac, details());
    expect(errors).toEqual([]);
    expect(sheet!.abilities.map((a) => a.slug)).toContain("dissipar");
    expect(sheet!.spells.map((s) => s.slug)).toEqual(expect.arrayContaining(["ignicao", "imolacao", "lamina-guiada"]));
    expect(sheet!.skills.find((s) => s.slug === "oratoria")?.level).toBe(1);
  });

  it("raça e arquétipo restringem carreiras", () => {
    const r = (race: string, archetype: string, career: string, other?: string) =>
      careerBlockReason(idx, { race, archetype, otherCareer: other }, career);
    expect(r("humano", "poderoso", "arauto-da-matanca")).toMatch(/Trolloide/);
    expect(r("trolloide", "poderoso", "arauto-da-matanca")).toBeNull();
    expect(r("humano", "poderoso", "arcanista")).toMatch(/Dotado/);
    expect(r("nyss", "dotado", "arcanista")).toMatch(/não pode/);
    expect(r("iosano", "dotado", "arcanista")).toBeNull();
    expect(r("humano", "poderoso", "cacador-de-magos")).toMatch(/Iosano/);
    // segunda carreira obrigatória (nos dois sentidos)
    expect(r("humano", "poderoso", "lamina-tempestuosa", "ladrao")).toMatch(/só combina/i);
    expect(r("humano", "poderoso", "lamina-tempestuosa", "soldado")).toBeNull();
    expect(r("humano", "poderoso", "ladrao", "lamina-tempestuosa")).toMatch(/só combina/i);
  });

  it("carreiras com nação exigem a nacionalidade", () => {
    const lamina = base({ careers: [pick("lamina-tempestuosa"), pick("soldado", { skillChoices: [["arma-de-mao", "pistola"]] })] });
    expect(evaluateCharacter(idx, lamina, details({ nationality: "Khadorano" })).errors.some((e) => /nacionalidade/.test(e.message))).toBe(true);
    expect(evaluateCharacter(idx, lamina, details({ nationality: "Cygnarana" })).errors).toEqual([]);
  });

  it("valida pontos de atributo: exatamente 3, dentro do limite do estágio", () => {
    const ate = (attributePoints: CharacterChoices["attributePoints"]) => evaluateCharacter(idx, base({ attributePoints }), details()).errors.filter((e) => e.step === 4);
    expect(ate({ FOR: 1, AGI: 1 })).toHaveLength(1); // só 2
    expect(ate({ FOR: 2, AGI: 2 })).toHaveLength(1); // 4
    expect(ate({ VEL: 2, FOR: 1 })).toHaveLength(1); // VEL 6 + 2 passa do limite 7
    expect(ate({ FOR: 1, AGI: 1, MAE: 1 })).toHaveLength(0);
    expect(ate({ FOR: -1, AGI: 2, MAE: 2 }).length).toBeGreaterThan(0);
  });

  it("exige duas carreiras diferentes, com escolhas e idiomas completos", () => {
    const one = evaluateCharacter(idx, base({ careers: [pick("soldado")] }), details());
    expect(one.errors.some((e) => e.step === 3)).toBe(true);
    const same = evaluateCharacter(idx, base({ careers: [pick("soldado"), pick("soldado")] }), details());
    expect(same.errors.some((e) => e.step === 3)).toBe(true);
    const noPick = evaluateCharacter(idx, base({ careers: [pick("soldado", { skillChoices: [[]] }), pick("cavaleiro")] }), details());
    expect(noPick.errors.some((e) => /escolha 2/.test(e.message))).toBe(true);
    const noLang = evaluateCharacter(idx, base({ careers: [pick("explorador", { languages: [] }), pick("cavaleiro")] }), details());
    expect(noLang.errors.some((e) => /idioma/.test(e.message))).toBe(true);
    expect(evaluateCharacter(idx, base(), details({ name: " " })).errors.some((e) => e.step === 5)).toBe(true);
  });

  it("Iosano precisa escolher a habilidade adicional, de uma das carreiras e com pré-requisitos atendidos", () => {
    const choices = base({ race: "iosano", raceAttributeChoice: undefined });
    expect(evaluateCharacter(idx, choices, details()).errors.some((e) => /adicional/.test(e.message))).toBe(true);
    const options = extraAbilityOptions(idx, choices);
    expect(options).toContain("vontade-de-ferro");
    expect(options).not.toContain("defensor"); // já tem
    expect(options).not.toContain("golpe-com-escudo"); // exige FOR 6
    const ok = evaluateCharacter(idx, { ...choices, extraAbility: "vontade-de-ferro" }, details());
    expect(ok.errors).toEqual([]);
    expect(ok.sheet!.abilities.map((a) => a.slug)).toContain("vontade-de-ferro");
  });

  it("humano precisa escolher o Potencial Excepcional (FIS, AGI ou INT)", () => {
    expect(evaluateCharacter(idx, base({ raceAttributeChoice: undefined }), details()).errors.some((e) => e.step === 1)).toBe(true);
    expect(evaluateCharacter(idx, base({ raceAttributeChoice: "FOR" }), details()).errors.some((e) => e.step === 1)).toBe(true);
  });

  it("Virtuoso exige uma perícia militar que o personagem tem", () => {
    const hab = (param?: string) => base({ archetype: "habilidoso", archetypeBenefit: "virtuoso", archetypeBenefitParam: param });
    expect(evaluateCharacter(idx, hab(), details()).errors.some((e) => e.step === 2)).toBe(true);
    expect(evaluateCharacter(idx, hab("arco"), details()).errors.some((e) => e.step === 2)).toBe(true);
    expect(evaluateCharacter(idx, hab("escudo"), details()).errors).toEqual([]);
  });

  it("Estudo Adicional: magia nova, da lista de uma das carreiras (nunca uma que já tem)", () => {
    const choices = base({
      archetype: "dotado",
      archetypeBenefit: "estudo-adicional",
      careers: [pick("arcanista"), pick("soldado", { skillChoices: [["arma-de-mao", "pistola"]] })],
      attributePoints: { ARC: 1, INT: 1, PER: 1 },
    });
    const options = benefitParamOptions(idx, choices)!;
    expect(options.kind).toBe("spell");
    expect(options.options).toContain("raio-de-gelo".replace("raio-de-gelo", "golpe-arcano"));
    expect(options.options).not.toContain("aura-de-protecao"); // já é inicial do Arcanista
    expect(options.options).not.toContain("ariete"); // lista de outra carreira
    expect(evaluateCharacter(idx, choices, details()).errors.some((e) => e.step === 2)).toBe(true);
    const ok = evaluateCharacter(idx, { ...choices, archetypeBenefitParam: "golpe-arcano" }, details());
    expect(ok.errors).toEqual([]);
    expect(ok.sheet!.spells.map((s) => s.slug)).toContain("golpe-arcano");
  });

  it("todo pré-requisito de habilidade do livro é entendido pelo motor", () => {
    for (const a of idx.abilities.values()) {
      expect(parsePrerequisites(idx, a.prerequisites).unknown, a.slug).toEqual([]);
    }
  });
});

describe("espiral vital", () => {
  it("6 ramos numerados; atributo ímpar dá o círculo a mais ao ramo de número menor", () => {
    const b = spiralBranches({ FIS: 6, AGI: 4, INT: 3 });
    expect(b.map((x) => [x.number, x.aspect, x.capacity])).toEqual([
      [1, "FIS", 3], [2, "FIS", 3],
      [3, "AGI", 2], [4, "AGI", 2],
      [5, "INT", 2], [6, "INT", 1],
    ]);
  });

  it("não passa dos círculos desenhados no livro (Físico 10, Agilidade 8, Intelecto 8)", () => {
    const b = spiralBranches({ FIS: 12, AGI: 9, INT: 8 });
    expect(b.filter((x) => x.aspect === "FIS").map((x) => x.capacity)).toEqual([5, 5]);
    expect(b.filter((x) => x.aspect === "AGI").map((x) => x.capacity)).toEqual([4, 4]);
  });

  it("dano marcado é limitado ao que o ramo comporta; aspecto zerado fica enfraquecido, todos zerados = debilitado", () => {
    const b = spiralBranches({ FIS: 6, AGI: 4, INT: 3 });
    expect(clampMarks([9, 0, 0, 0, 0, 0], b)).toEqual([3, 0, 0, 0, 0, 0]);
    expect(clampMarks(undefined, b)).toEqual([0, 0, 0, 0, 0, 0]);
    const status = spiralStatus(b, [3, 3, 0, 0, 1, 0]);
    expect(status.aspects).toEqual([
      { aspect: "FIS", total: 6, remaining: 0, weakened: true },
      { aspect: "AGI", total: 4, remaining: 4, weakened: false },
      { aspect: "INT", total: 3, remaining: 2, weakened: false },
    ]);
    expect(status.debilitated).toBe(false);
    expect(spiralStatus(b, [3, 3, 2, 2, 2, 1]).debilitated).toBe(true);
  });
});

describe("ações do turno", () => {
  it("2 rápidas, ou 1 rápida + 1 de ataque, ou 1 completa", () => {
    expect(validActionsUsed([])).toBe(true);
    expect(validActionsUsed(["quick", "quick"])).toBe(true);
    expect(validActionsUsed(["attack", "quick"])).toBe(true);
    expect(validActionsUsed(["full"])).toBe(true);
    expect(validActionsUsed(["quick", "quick", "quick"])).toBe(false);
    expect(validActionsUsed(["attack", "attack"])).toBe(false);
    expect(validActionsUsed(["full", "quick"])).toBe(false);
  });

  it("depois da primeira ação só cabe o que completa um modo válido", () => {
    expect(canSpend([], "full")).toBe(true);
    expect(canSpend(["quick"], "attack")).toBe(true);
    expect(canSpend(["quick"], "full")).toBe(false);
    expect(canSpend(["attack"], "attack")).toBe(false);
    expect(canSpend(["quick", "attack"], "quick")).toBe(false);
    expect(canSpend(["full"], "quick")).toBe(false);
  });

  it("habilidade que dá ação extra específica deixa a ação sem custo; sem ela, gasta", () => {
    const rows = (abilities: string[], benefits: string[] = []) => Object.fromEntries(actionRows(idx, { abilities, benefits }).map((r) => [r.slug, r]));
    const none = rows([]);
    expect(none.recarregar).toMatchObject({ cost: "quick", effectiveCost: "quick", reason: null });
    const fast = rows(["recarga-rapida", "saque-rapido", "granadeiro"]);
    expect(fast.recarregar?.effectiveCost).toBe("free");
    expect(fast.recarregar?.reason).toMatch(/Recarga Rápida.*recarregar arma à distância/);
    expect(fast["pegar-item"]?.effectiveCost).toBe("free");
    expect(fast["puxar-pino"]?.effectiveCost).toBe("free");
    expect(fast["encontrar-cobertura"]?.effectiveCost).toBe("quick"); // não tem Avanço Cuidadoso
    // Conjurador Rápido é benefício do arquétipo Dotado
    expect(rows([], ["conjurador-rapido"])["conjurar-magia"]?.effectiveCost).toBe("free");
    // Besteiro: recarregar besta cai de ação completa para rápida (não vira grátis)
    expect(none["recarregar-besta"]?.effectiveCost).toBe("full");
    expect(rows(["besteiro"])["recarregar-besta"]?.effectiveCost).toBe("quick");
  });
});

describe("perícias que o personagem não tem", () => {
  it("lista as outras perícias do jogo, com o que mostrar sem treino", () => {
    const sheet = evaluateCharacter(idx, base(), details()).sheet!;
    const owned = new Set(sheet.skills.map((s) => s.slug));
    expect(sheet.otherSkills.length + owned.size).toBe(50);
    expect(sheet.otherSkills.some((s) => owned.has(s.slug))).toBe(false);
    const escalar = sheet.otherSkills.find((s) => s.slug === "escalar")!; // geral, AGI, pode sem treino
    expect(escalar).toMatchObject({ needsTraining: false, base: sheet.attributes.AGI });
    const alquimia = sheet.otherSkills.find((s) => s.slug === "alquimia")!; // exige treino
    expect(alquimia.needsTraining).toBe(true);
    expect(sheet.otherSkills.find((s) => s.slug === "comandar")).toBeUndefined(); // o cavaleiro tem
    expect(sheet.otherSkills.find((s) => s.slug === "seduzir")?.base).toBeNull(); // social: o jogador escolhe o atributo
    expect(sheet.otherSkills.find((s) => s.slug === "falsificar")?.base).toBe(Math.min(sheet.attributes.AGI!, sheet.attributes.INT!));
  });
});

describe("bens iniciais das carreiras", () => {
  it("monta o inventário com a opção escolhida e cobra a escolha", async () => {
    const { startingInventory } = await import("./inventory");
    let n = 0;
    const ok = startingInventory(idx.careers, [{ career: "pistoleiro", skillChoices: [], languages: [], gear: [1] }], () => `t${n++}`);
    expect(ok.errors).toEqual([]);
    expect(ok.inventory).toEqual([
      { id: "bandoleira-de-municao", qty: 1 },
      { id: "pistola-de-repeticao", qty: 2 },
      { id: "municao-leve-revestimento-de-papel-5-tiros", qty: 4 },
    ]);
    expect(startingInventory(idx.careers, [{ career: "pistoleiro", skillChoices: [], languages: [] }], () => "x").errors).toHaveLength(1);
    const spy = startingInventory(idx.careers, [{ career: "espiao", skillChoices: [], languages: [] }], () => "t");
    expect(spy.inventory).toEqual([{ custom: "t", name: "Documentos de identidade falsos", description: "", qty: 1 }]);
  });
});

describe("progressão por XP (pp. 151-152)", () => {
  const ok = (choices: CharacterChoices, xp: number) => evaluateCharacter(idx, choices, details(), { xp });

  it("libera as linhas da tabela pelo XP total e mostra as opções da próxima", () => {
    expect(pendingAdvances(idx, base(), { xp: 5 }).map((r) => r.xp)).toEqual([2, 4]);
    const next = nextAdvance(idx, base(), details(), { xp: 5 })!;
    expect(next.row).toMatchObject({ xp: 2, grant: "professional-points" });
    expect(next.options.professional.length).toBeGreaterThan(0);
    expect(next.options.professional.every((o) => o.level < o.cap && o.cap <= 2)).toBe(true); // Herói: perícia até 2
    expect(ok(base(), 49).sheet!.stage).toBe("hero");
    expect(ok(base(), 50).sheet!.stage).toBe("veteran");
    expect(ok(base(), 100).sheet!.stage).toBe("epic");
    // Épico continua de 5 em 5 depois do 95, na sequência do Veterano (decisão do usuário).
    expect(pendingAdvances(idx, base(), { xp: 145 }).slice(-10).map((r) => r.xp)).toEqual([100, 105, 110, 115, 120, 125, 130, 135, 140, 145]);
  });

  it("+2 perícias profissionais: só das carreiras e sem passar do nível máximo do estágio", () => {
    const opt = nextAdvance(idx, base(), details(), { xp: 2 })!.options.professional.find((o) => o.level === 0 && !o.freeSpecialty)!;
    const two = { xp: 2, grant: "professional-points" as const, skills: [{ skill: opt.skill }, { skill: opt.skill }] };
    const r = ok(base({ advances: [two] }), 2);
    expect(r.errors).toEqual([]);
    expect(r.sheet!.skills.find((s) => s.slug === opt.skill)?.level).toBe(2);
    // Fora das listas das carreiras: recusa
    expect(ok(base({ advances: [{ ...two, skills: [{ skill: "alquimia" }, { skill: "alquimia" }] }] }), 2).errors[0]?.step).toBe(6);
  });

  it("+1 atributo respeita o máximo racial; progressão ainda não liberada é recusada", () => {
    const fis = ok(base(), 0).sheet!.attributes.FIS!; // humano 5 + Potencial Excepcional
    const up = { xp: 6, grant: "attribute" as const, attribute: "FIS" as const };
    const r = ok(base({ advances: [up] }), 6);
    expect(r.errors).toEqual([]);
    expect(r.sheet!.attributes.FIS).toBe(fis + 1);
    const twice = base({ advances: [up, { xp: 15, grant: "attribute", attribute: "FIS" }] });
    expect(ok(twice, 15).errors.length).toBe(fis + 2 > 7 ? 1 : 0); // máximo de Herói do humano: FIS 7
    expect(ok(base({ advances: [up] }), 5).errors[0]?.message).toMatch(/não liberada/);
  });
});
