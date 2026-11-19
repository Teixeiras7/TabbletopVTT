import { describe, expect, it } from "vitest";
import { catalogFromFiles as c } from "./data";
import { ATTRIBUTES } from "./schemas";

const slugs = (list: { slug: string }[]) => new Set(list.map((x) => x.slug));
const unique = (list: { slug: string }[]) => expect(slugs(list).size).toBe(list.length);

describe("catálogo do manual (data/catalog)", () => {
  it("tem o tamanho que o livro tem", () => {
    expect(c.races).toHaveLength(7);
    expect(c.archetypes).toHaveLength(4);
    expect(c.careers).toHaveLength(30);
    expect(c.spells).toHaveLength(160);
    expect(c.spellLists).toHaveLength(10);
    expect(c.skills.filter((s) => s.category === "military")).toHaveLength(11);
    expect(c.skills.filter((s) => s.category === "professional")).toHaveLength(29);
    expect(c.skills.filter((s) => s.category === "general")).toHaveLength(10);
    for (const a of c.archetypes) expect(a.benefits).toHaveLength(10);
  });

  it("não repete identificador dentro de cada tipo", () => {
    [c.races, c.archetypes, c.skills, c.abilities, c.spells, c.spellLists, c.careers, c.connections].forEach(unique);
  });

  it("raças: valor inicial e limites crescem, e todos os atributos existem", () => {
    for (const race of c.races) {
      for (const attr of ATTRIBUTES) {
        expect(race.attributes, `${race.slug} ${attr}`).toHaveProperty(attr);
        const v = race.attributes[attr];
        if (!v) continue;
        if (v.start !== null) expect(v.start).toBeLessThanOrEqual(v.hero);
        expect(v.hero).toBeLessThanOrEqual(v.veteran);
        expect(v.veteran).toBeLessThanOrEqual(v.epic);
      }
    }
    // Conferido contra a imagem do livro (etapa 6): humano FIS 5 | 7/8/8; só Gobber e Ogrun não têm ARC.
    expect(c.races[0]?.attributes.FIS).toEqual({ start: 5, hero: 7, veteran: 8, epic: 8 });
    expect(c.races.filter((r) => r.attributes.ARC === null).map((r) => r.slug)).toEqual(["gobber", "ogrun"]);
  });

  it("raças só citam arquétipos, benefícios, habilidades, perícias e carreiras que existem", () => {
    const archetypes = slugs(c.archetypes);
    const benefits = new Set(c.archetypes.flatMap((a) => a.benefits.map((b) => b.slug)));
    const abilities = slugs(c.abilities);
    const skills = slugs(c.skills);
    const careers = slugs(c.careers);
    for (const r of c.races) {
      r.archetypes.forEach((a) => expect(archetypes.has(a), `${r.slug} arquétipo ${a}`).toBe(true));
      r.grants.archetypeBenefits?.forEach((b) => expect(benefits.has(b), `${r.slug} benefício ${b}`).toBe(true));
      r.grants.abilities?.forEach((a) => expect(abilities.has(a), `${r.slug} habilidade ${a}`).toBe(true));
      r.restrictions.forbiddenMilitarySkills?.forEach((s) => expect(skills.has(s)).toBe(true));
      r.restrictions.dotadoCareerBans?.forEach((s) => expect(careers.has(s)).toBe(true));
    }
  });

  it("listas de magias só têm magias do catálogo", () => {
    const spells = slugs(c.spells);
    for (const l of c.spellLists) l.entries.forEach((e) => expect(spells.has(e), `${l.slug} ${e}`).toBe(true));
  });

  it("carreiras só citam habilidades, perícias, magias, listas, raças e arquétipos que existem", () => {
    const abilities = slugs(c.abilities);
    const skills = slugs(c.skills);
    const spells = slugs(c.spells);
    const lists = slugs(c.spellLists);
    const races = slugs(c.races);
    const archetypes = slugs(c.archetypes);
    const careers = slugs(c.careers);
    const benefitSlugs = new Set(c.archetypes.flatMap((a) => a.benefits.map((b) => b.slug)));
    for (const k of c.careers) {
      const where = k.slug;
      k.grantsBenefits?.forEach((b) => expect(benefitSlugs.has(b), `${where} benefício ${b}`).toBe(true));
      k.prerequisites.races.forEach((r) => expect(races.has(r), `${where} raça ${r}`).toBe(true));
      k.prerequisites.archetypes.forEach((a) => expect(archetypes.has(a), `${where} arquétipo ${a}`).toBe(true));
      k.secondCareerOneOf?.forEach((s) => expect(careers.has(s), `${where} segunda carreira ${s}`).toBe(true));
      [...k.initial.abilities, ...k.progression.abilities].forEach((a) =>
        expect(abilities.has(a.ability), `${where} habilidade ${a.ability}`).toBe(true),
      );
      k.initial.spells.forEach((s) => expect(spells.has(s), `${where} magia ${s}`).toBe(true));
      k.progression.spellLists.forEach((l) => expect(lists.has(l), `${where} lista ${l}`).toBe(true));
      for (const s of [...k.initial.militarySkills, ...k.initial.professionalSkills]) {
        const refs = s.type === "fixed" ? [s] : s.options;
        refs.forEach((r) => {
          expect(skills.has(r.skill), `${where} perícia ${r.skill}`).toBe(true);
          expect(r.level, `${where} nível de ${r.skill}`).not.toBeNull();
        });
        if (s.type === "choose") expect(s.options.length).toBeGreaterThanOrEqual(s.count);
      }
      [...k.progression.militarySkills, ...k.progression.professionalSkills].forEach((s) => {
        expect(skills.has(s.skill), `${where} perícia (prog) ${s.skill}`).toBe(true);
        expect(s.maxLevel, `${where} nível máximo de ${s.skill}`).not.toBeNull();
      });
      k.variants?.forEach((v) => {
        v.abilities.forEach((a) => expect(abilities.has(a.ability), `${where}/${v.slug} habilidade`).toBe(true));
        v.spells.forEach((s) => expect(spells.has(s), `${where}/${v.slug} magia ${s}`).toBe(true));
        expect(lists.has(v.spellList), `${where}/${v.slug} lista ${v.spellList}`).toBe(true);
      });
      expect(k.initial.gear?.co, `${where} CO inicial`).toBeTypeOf("number");
      expect(k.progression.abilities.length + k.progression.professionalSkills.length).toBeGreaterThan(0);
    }
  });

  it("carreiras só de criação (apenas inicial) e restritas, como na tabela do livro (p. 117)", () => {
    const only = c.careers.filter((k) => k.initialOnly).map((k) => k.slug).sort();
    expect(only).toEqual(
      ["aristocrata", "conjurador-de-guerra", "feiticeiro", "lamina-tempestuosa", "presa-de-ferro", "soldado-de-trincheira"].sort(),
    );
    const find = (s: string) => c.careers.find((k) => k.slug === s)!;
    expect(find("arauto-da-matanca").prerequisites.races).toEqual(["trolloide"]);
    expect(find("arcanista").prerequisites.archetypes).toEqual(["dotado"]);
    expect(find("lamina-tempestuosa").prerequisites.nation).toBe("cygnarano");
    expect(find("presa-de-ferro").prerequisites.nation).toBe("khadorano");
    expect(find("lamina-tempestuosa").secondCareerOneOf).toContain("cavaleiro");
    expect(find("conjurador-de-guerra").focalizer).toBe(true);
  });

  it("Feiticeiro tem 4 elementos e Sacerdote 2 religiões, com as magias iniciais do livro", () => {
    const f = c.careers.find((k) => k.slug === "feiticeiro")!;
    expect(f.variants?.map((v) => v.slug)).toEqual(["fogo", "gelo", "pedra", "tempestade"]);
    expect(f.variants?.find((v) => v.slug === "pedra")?.bonus).toMatchObject({ attribute: "FIS", initial: 1 });
    const s = c.careers.find((k) => k.slug === "sacerdote")!;
    expect(s.variants?.map((v) => v.slug)).toEqual(["morrow", "menoth"]);
    s.variants?.forEach((v) => expect(v.spells).toHaveLength(3));
  });

  it("inconsistências do livro resolvidas por decisão do usuário, e registradas na carreira", () => {
    // p. 130: "Esfriar" (Feiticeiro de Gelo) não existe nas 160 magias; o usuário decidiu que é Calafrio.
    const feiticeiro = c.careers.find((k) => k.slug === "feiticeiro")!;
    const gelo = feiticeiro.variants!.find((v) => v.slug === "gelo")!;
    expect(gelo.spells).toEqual(["calafrio", "nevasca", "raio-de-gelo"]);
    expect(feiticeiro.notes.join(" ")).toMatch(/Esfriar/);
    // p. 129: "Senso de Direção" (Explorador) não existe na lista de perícias; o usuário decidiu que fica em Sobrevivência.
    const explorador = c.careers.find((k) => k.slug === "explorador")!;
    const prof = explorador.initial.professionalSkills.flatMap((s) => (s.type === "fixed" ? [s.skill] : []));
    expect(prof).toEqual(["detectar", "medicina", "sobrevivencia"]);
    expect(explorador.notes.join(" ")).toMatch(/Senso de Direção/);
  });

  it("só 5 habilidades se repetem, como no livro", () => {
    expect(c.abilities.filter((a) => a.repeatable).map((a) => a.slug).sort()).toEqual(
      ["especializacao", "identidade-falsa", "idioma", "rearme-rapido", "vinculo"].sort(),
    );
  });

  it("tabela de progressão: XP crescente e Épico idêntico a Veterano (como impresso)", () => {
    const { hero, veteran, epic } = c.progression.table;
    for (const rows of [hero, veteran, epic]) {
      expect(rows.map((r) => r.xp)).toEqual([...rows.map((r) => r.xp)].sort((a, b) => a - b));
    }
    expect(epic).toEqual(veteran);
    expect(c.progression.creationAttributePoints).toBe(3);
  });
});

describe("ações do turno (data/catalog/actions.json)", () => {
  it("só citam habilidades e benefícios que existem", () => {
    const abilities = slugs(c.abilities);
    const benefits = new Set(c.archetypes.flatMap((a) => a.benefits.map((b) => b.slug)));
    expect(c.actions.length).toBeGreaterThan(0);
    unique(c.actions);
    for (const a of c.actions) {
      for (const r of [...a.freeWith, ...(a.altCost ?? [])]) {
        expect((r.kind === "ability" ? abilities : benefits).has(r.slug), `${a.slug} -> ${r.kind} ${r.slug}`).toBe(true);
      }
    }
  });
});

describe("Loja (data/catalog/equipment.json)", () => {
  it("tem a Lista de Preços inteira, sem repetir item", () => {
    unique(c.equipment);
    expect(c.equipment).toHaveLength(294);
    const count = (cat: string) => c.equipment.filter((e) => e.category === cat).length;
    expect(count("armaduras")).toBe(9);
    expect(count("armas-corpo-a-corpo")).toBe(37); // a Baioneta aparece duas vezes no livro; entra uma
    expect(count("armas-a-distancia")).toBe(38);
    expect(count("runas-mekanicas")).toBe(25);
  });

  it("preços conferidos no livro (pp. 241-245)", () => {
    const price = (slug: string) => c.equipment.find((e) => e.slug === slug);
    expect(price("armadura-completa")).toMatchObject({ price: 100, armorType: "Pesada" });
    expect(price("disco-de-municao")?.price).toBe(15);
    expect(price("armadura-de-conjurador-de-guerra-pesada")?.price).toBe(2760);
    expect(price("livro")).toMatchObject({ price: 5, minimum: true });
    expect(price("granada-alquimica-em-versao-para-fuzil")).toMatchObject({ price: 10, addOn: true });
  });
});
