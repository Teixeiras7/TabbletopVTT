"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import { confirm } from "@/components/confirm";
import { createAuthedRealtimeClient } from "@/lib/supabase/client";
import { CHARACTER_DRAG_TYPE, MAP_SIZE, SHEETS_CHANGED_EVENT, SHEETS_CHANNEL } from "@/lib/mesas/map";
import type { CombatState } from "@/lib/engine/combat";
import type { TokenView } from "@/lib/mesas/tokens";
import { listTokensAction, placeTokenAction, removeTokenAction } from "./actions";
import { CombatTracker } from "./combat-tracker";

/** Carrega uma imagem para o Konva desenhar (sem a lib `use-image`: são poucas linhas). */
function useImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  // Limpa já na renderização quando a URL vira null; o efeito só carrega URLs de verdade.
  const [prevUrl, setPrevUrl] = useState(url);
  if (url !== prevUrl) {
    setPrevUrl(url);
    if (!url) setImage(null);
  }
  useEffect(() => {
    if (!url) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [url]);
  return image;
}

/**
 * Tamanho do mapa: sem imagem, um quadrado de MAP_SIZE; com imagem, a proporção dela (o lado maior = MAP_SIZE),
 * cortado em casas inteiras para o grid fechar na borda. A imagem nunca é esticada.
 */
function mapArea(image: HTMLImageElement | null, cell: number) {
  if (!image) return { width: MAP_SIZE, height: MAP_SIZE, imageWidth: 0, imageHeight: 0 };
  const scale = MAP_SIZE / Math.max(image.width, image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  const fit = (px: number) => Math.max(cell, Math.floor(px / cell) * cell);
  return { width: fit(imageWidth), height: fit(imageHeight), imageWidth, imageHeight };
}

function gridLines(width: number, height: number, cell: number) {
  const lines = [];
  for (let x = 0; x <= width; x += cell) lines.push({ key: `v${x}`, points: [x, 0, x, height] });
  for (let y = 0; y <= height; y += cell) lines.push({ key: `h${y}`, points: [0, y, width, y] });
  return lines;
}

export function TableCanvas({
  sceneId,
  gridSize: initialGridSize,
  backgroundUrl: initialBackgroundUrl,
  currentUserId,
  isMaster,
  combat: initialCombat,
}: {
  sceneId: string;
  gridSize: number;
  backgroundUrl: string | null;
  currentUserId: string;
  isMaster: boolean;
  combat: CombatState | null;
}) {
  const [combat, setCombat] = useState(initialCombat);
  const [gridSize, setGridSize] = useState(initialGridSize);
  const [backgroundUrl, setBackgroundUrl] = useState(initialBackgroundUrl);
  const [tokens, setTokens] = useState<TokenView[]>([]);
  const backgroundImage = useImage(backgroundUrl);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const area = mapArea(backgroundImage, gridSize);
  const cols = Math.round(area.width / gridSize);
  const rows = Math.round(area.height / gridSize);

  const loadTokens = useCallback(() => listTokensAction(sceneId).then((list) => list && setTokens(list)), [sceneId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Cena (grid/fundo, mudados pelo Mestre) e tokens chegam pelo Realtime; filtrados aqui, não no servidor
  // (o filtro do servidor parou de casar depois da renomeação das colunas). Um token mudou: busca a lista de novo
  // (nome e imagem vêm do personagem; o DELETE com RLS só traz o id).
  useEffect(() => {
    void loadTokens();
    let cleanup = () => {};
    let cancelled = false;
    void createAuthedRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(`scene:${sceneId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cenas" }, (payload) => {
          const row = payload.new as { id: string; tamanho_grid: number; fundo_url: string | null; combate: CombatState | null };
          if (row.id !== sceneId) return;
          setGridSize(row.tamanho_grid);
          setBackgroundUrl(row.fundo_url);
          setCombat(row.combate);
          // A vez mudou: as ações do personagem da vez zeraram no servidor; as fichas abertas buscam de novo.
          window.dispatchEvent(new Event(SHEETS_CHANGED_EVENT));
          const others = new BroadcastChannel(SHEETS_CHANNEL); // e as janelas separadas da ficha
          others.postMessage("changed");
          others.close();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "tokens" }, (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as { cena_id?: string };
          if (!row.cena_id || row.cena_id === sceneId) void loadTokens();
        })
        .subscribe();
      cleanup = () => void supabase.removeChannel(channel);
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [sceneId, loadTokens]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    setScale((prevScale) => {
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const nextScale = Math.max(0.4, Math.min(2.5, prevScale * (1 + direction * 0.08)));
      setPos((prevPos) => ({
        x: pointer.x - ((pointer.x - prevPos.x) / prevScale) * nextScale,
        y: pointer.y - ((pointer.y - prevPos.y) / prevScale) * nextScale,
      }));
      return nextScale;
    });
  }, []);

  /** Casa sob um ponto do mapa (null fora do grid). */
  const cellAt = (p: { x: number; y: number }) => {
    const x = Math.floor(p.x / gridSize);
    const y = Math.floor(p.y / gridSize);
    return x >= 0 && y >= 0 && x < cols && y < rows ? { x, y } : null;
  };

  async function place(characterId: string, cell: { x: number; y: number }) {
    setTokens((prev) => prev.map((t) => (t.characterId === characterId ? { ...t, ...cell } : t))); // move na hora
    if (await placeTokenAction(sceneId, characterId, cell.x, cell.y)) void loadTokens();
  }

  // Personagem arrastado da lista de Fichas e solto no mapa: entra na casa onde foi solto.
  function handleDrop(event: React.DragEvent) {
    const characterId = event.dataTransfer.getData(CHARACTER_DRAG_TYPE);
    const stage = stageRef.current;
    if (!characterId || !stage) return;
    event.preventDefault();
    stage.setPointersPositions(event.nativeEvent);
    const p = stage.getRelativePointerPosition();
    const cell = p && cellAt(p);
    if (cell) void place(characterId, cell);
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none bg-background"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(CHARACTER_DRAG_TYPE)) e.preventDefault();
      }}
      onDrop={handleDrop}
    >
      <CombatTracker sceneId={sceneId} combat={combat} tokens={tokens} currentUserId={currentUserId} isMaster={isMaster} />
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() });
        }}
        onWheel={handleWheel}
      >
        <Layer listening={false}>
          <Group clipX={0} clipY={0} clipWidth={area.width} clipHeight={area.height}>
            <Rect width={area.width} height={area.height} fill="#171717" />
            {backgroundImage && <KonvaImage image={backgroundImage} width={area.imageWidth} height={area.imageHeight} />}
            {gridLines(area.width, area.height, gridSize).map((line) => (
              <Line key={line.key} points={line.points} stroke="#2a2a2a" strokeWidth={1} opacity={0.6} />
            ))}
          </Group>
        </Layer>
        <Layer>
          {tokens.map((t) => (
            <TokenNode
              key={t.characterId}
              token={t}
              cell={gridSize}
              canMove={isMaster || t.ownerId === currentUserId}
              onMove={(node) => {
                const cell = cellAt({ x: node.x() + gridSize / 2, y: node.y() + gridSize / 2 });
                node.position({ x: (cell?.x ?? t.x) * gridSize, y: (cell?.y ?? t.y) * gridSize }); // encaixa na casa
                if (cell) void place(t.characterId, cell);
              }}
              onRemove={async () => {
                if (!(await confirm(`Tirar ${t.name} do mapa?`, { confirmLabel: "Tirar" }))) return;
                setTokens((prev) => prev.filter((x) => x.characterId !== t.characterId));
                await removeTokenAction(sceneId, t.characterId);
              }}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

/** Personagem no mapa: a imagem dele num círculo do tamanho da casa (sem imagem: a inicial) e o nome embaixo. */
function TokenNode({
  token,
  cell,
  canMove,
  onMove,
  onRemove,
}: {
  token: TokenView;
  cell: number;
  canMove: boolean;
  onMove: (node: Konva.Group) => void;
  onRemove: () => void;
}) {
  const image = useImage(token.imageUrl);
  // Recorte central quadrado da imagem (como object-fit: cover), para não esticar.
  const side = image ? Math.min(image.width, image.height) : 0;
  const crop = image ? { x: (image.width - side) / 2, y: (image.height - side) / 2, width: side, height: side } : undefined;
  const c = cell / 2;
  const r = cell * 0.46;
  return (
    <Group
      x={token.x * cell}
      y={token.y * cell}
      draggable={canMove}
      onDragEnd={(e) => {
        e.cancelBubble = true; // não move o mapa junto
        onMove(e.target as unknown as Konva.Group);
      }}
      onDblClick={canMove ? onRemove : undefined}
      onDblTap={canMove ? onRemove : undefined}
      onMouseEnter={(e) => canMove && (e.target.getStage()!.container().style.cursor = "grab")}
      onMouseLeave={(e) => (e.target.getStage()!.container().style.cursor = "")}
    >
      <Group clipFunc={(ctx) => ctx.arc(c, c, r, 0, Math.PI * 2)}>
        <Rect width={cell} height={cell} fill="#262626" />
        {image ? (
          <KonvaImage image={image} crop={crop} x={c - r} y={c - r} width={r * 2} height={r * 2} />
        ) : (
          <Text y={cell * 0.3} width={cell} align="center" text={token.name.trim().charAt(0).toUpperCase()} fontSize={cell * 0.4} fontStyle="bold" fill="#e5e5e5" />
        )}
      </Group>
      <Circle x={c} y={c} radius={r} stroke="#d6a04a" strokeWidth={Math.max(1, cell * 0.04)} listening={false} />
      <Text x={-cell / 2} y={cell} width={cell * 2} align="center" text={token.name} fontSize={Math.max(8, cell * 0.22)} fill="#e5e5e5" shadowColor="#000" shadowBlur={3} listening={false} />
    </Group>
  );
}
