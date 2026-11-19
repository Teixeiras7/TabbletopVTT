# Extrai do PDF do manual (manual/, fora do git) o texto de magias e habilidades e grava manual/textos-livro.json,
# também fora do git: o texto do livro tem direitos autorais e o repositório é público. O `npm run db:seed` usa esse
# arquivo, se existir, no lugar dos resumos de data/catalog (textos longos demais continuam com o resumo).
# Uso: uv run --with pymupdf python scripts/textos-livro.py
import glob, json, re, sys
import pymupdf

LIMITE = 900  # caracteres; acima disso fica o resumo do catálogo
CABECALHO = ("MAGIA", "CST", "ALC ADE POD MAN OFE")  # cabeçalho da tabela de magias, em cada coluna

pdf = pymupdf.open(glob.glob("manual/*.pdf")[0])
saida = "manual/textos-livro.json"


def limpa(s):
    return s.replace("ﬁ ", "fi").replace("ﬂ ", "fl").replace("ﬁ", "fi").replace("ﬂ", "fl").replace(" ", " ")


def linhas(pagina):  # índice do PyMuPDF = página impressa (PDF = impressa + 1)
    return [limpa(l).strip() for l in pdf[pagina].get_text().split("\n")]


def titulo(l):  # nome de magia/habilidade ou cabeçalho: tudo em maiúsculas
    letras = re.sub(r"[^A-Za-zÀ-ÿ]", "", l)
    return len(letras) >= 3 and letras == letras.upper() and not re.fullmatch(r"(CJR|CTR|RJ|S|N|CST)( \w+)*", l)


def junta(partes):
    texto = ""
    for p in partes:
        if not texto:
            texto = p
        elif texto.endswith("-") and p[:1].islower():
            palavra = texto.split(" ")[-1]
            texto = texto + p if palavra.count("-") > 1 else texto[:-1] + p  # corpo-a-corpo fica; conju-rador junta
        else:
            texto += " " + p
    return re.sub(r"\s+", " ", texto).strip()


def procura(nome, pagina, faixa):
    """(página, índice da linha seguinte ao nome) ou None. O nome pode estar quebrado em duas linhas."""
    alvo = re.sub(r"\s+", " ", nome.upper())
    for p in ((pagina, pagina + 1, pagina - 1) if pagina else faixa):
        if not 0 <= p < len(pdf):
            continue
        ls = linhas(p)
        for i, l in enumerate(ls):
            um = re.sub(r"\s+", " ", l)
            dois = re.sub(r"\s+", " ", f"{l} {ls[i + 1]}") if i + 1 < len(ls) else ""
            for cand, fim in ((um, i + 1), (dois, i + 2)):
                # nome sozinho ou seguido do custo na mesma linha ("CAMINHO VERDADEIRO 3")
                if cand == alvo or re.fullmatch(re.escape(alvo) + r"( \d+| \*)?", cand):
                    return p, fim
    return None


def corpo(p, i):
    """Linhas de texto a partir de (p, i) até o próximo título; segue para a página seguinte se preciso."""
    partes, comecou, em_pre = [], False, False
    while p < len(pdf):
        ls = linhas(p)
        while i < len(ls):
            l = ls[i]
            i += 1
            if not l or re.fullmatch(r"\d{1,3}", l):
                continue
            tem_texto = len(re.findall(r"[a-zà-ÿ]", l)) >= 3
            if not comecou:
                # linha de pré-requisito (pode quebrar em mais de uma): a ficha já mostra à parte
                if l.startswith("Pré-requisito") or em_pre:
                    em_pre = not re.search(r"\.$", l)
                    continue
                if not tem_texto:
                    continue
                comecou = True
            elif titulo(l) or l in CABECALHO:
                return partes
            partes.append(l)
        p, i = p + 1, 0
        # continuação na próxima página: pula o cabeçalho da tabela de magias
        ls = linhas(p) if p < len(pdf) else []
        while i < len(ls) and (ls[i] in CABECALHO or not ls[i]):
            i += 1
    return partes


resultado = {"spells": {}, "abilities": {}}
faltando = []
for tipo, arquivo, faixa in (("spells", "spells.json", range(228, 250)), ("abilities", "abilities.json", range(152, 168))):
    for item in json.load(open(f"data/catalog/{arquivo}", encoding="utf-8")):
        achado = procura(item["name"], item.get("sourcePage"), faixa)
        if not achado:
            faltando.append(f"{tipo}: {item['name']} (p. {item['sourcePage']})")
            continue
        texto = junta(corpo(*achado))
        if texto and len(texto) <= LIMITE:
            resultado[tipo][item["slug"]] = texto

# Detalhes de equipamento já extraídos antes (mantidos aqui, fora do git)
try:
    antigo = json.load(open(saida, encoding="utf-8"))
    resultado["equipment"] = antigo.get("equipment", {})
except FileNotFoundError:
    resultado["equipment"] = {}

json.dump(resultado, open(saida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("magias", len(resultado["spells"]), "· habilidades", len(resultado["abilities"]), "· equipamentos", len(resultado["equipment"]))
print("não achados:", len(faltando), *faltando[:30], sep="\n  ")
