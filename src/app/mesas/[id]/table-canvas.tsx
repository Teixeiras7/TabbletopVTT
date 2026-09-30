"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MAP_SIZE, cellAt, cellCenter, cellsPerSide } from "@/lib/mesas/map";
import { createTokenAction, deleteTokenAction, moveTokenAction } from "./actions";

// x/y são a casa do token (0 = primeira), não pixels: quando o Mestre muda o
// tamanho do quadrado, o token continua na casa e cresce/encolhe junto.
type Token = { id: string; label: string; color: string; x: number; y: number };

const TOKEN_COLORS = ["#6366f1", "#ef4444", "#22c55e", "#eab308", "#06b6d4", "#ec4899"];

function gridLines(size: number) {
  const lines = [];
  for (let i = 0; i <= cellsPerSide(size); i++) {
    lines.push({ key: `v${i}`, points: [i * size, 0, i * size, MAP_SIZE] });
    lines.push({ key: `h${i}`, points: [0, i * size, MAP_SIZE, i * size] });
  }
  return lines;
}

/** Carrega uma imagem para o Konva desenhar; não usa a lib `use-image` para não adicionar uma dependência a mais por algumas linhas. */
function useBackgroundImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  // Limpa a imagem já durante a renderização quando a URL vira null (em vez
  // de um efeito só para isso) — o efeito abaixo cuida só de carregar uma
  // URL de verdade, chamando setImage no callback assíncrono de onload.
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

export function TableCanvas({
  sceneId,
  gridSize: initialGridSize,
  backgroundUrl: initialBackgroundUrl,
  initialTokens,
  isMaster,
}: {
  sceneId: string;
  gridSize: number;
  backgroundUrl: string | null;
  initialTokens: Token[];
  isMaster: boolean;
}) {
  const [tokens, setTokens] = useState<Map<string, Token>>(
    () => new Map(initialTokens.map((t) => [t.id, t])),
  );
  const [gridSize, setGridSize] = useState(initialGridSize);
  const [backgroundUrl, setBackgroundUrl] = useState(initialBackgroundUrl);
  const backgroundImage = useBackgroundImage(backgroundUrl);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(TOKEN_COLORS[0]);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Persistência via Server Action; sincronização em tempo real via
  // postgres_changes do Supabase (a mudança já está no Postgres quando o
  // evento chega — não é a fonte da verdade, só notifica a UI).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`scene:${sceneId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tokens", filter: `scene_id=eq.${sceneId}` },
        (payload) => {
          setTokens((prev) => {
            const next = new Map(prev);
            if (payload.eventType === "DELETE") {
              next.delete((payload.old as { id: string }).id);
            } else {
              const row = payload.new as Token;
              next.set(row.id, row);
            }
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "scenes", filter: `id=eq.${sceneId}` },
        (payload) => {
          // O Realtime manda as colunas como estão no Postgres (snake_case), não os nomes do Drizzle.
          const row = payload.new as { grid_size: number; background_url: string | null };
          setGridSize(row.grid_size);
          setBackgroundUrl(row.background_url);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sceneId]);

  const handleAddToken = useCallback(async () => {
    const label = newLabel.trim();
    if (!label) return;
    setNewLabel("");
    const result = await createTokenAction(sceneId, {
      label,
      color: newColor,
      x: Math.floor(cellsPerSide(gridSize) / 2),
      y: Math.floor(cellsPerSide(gridSize) / 2),
    });
    if (!result.ok) console.error("Não foi possível criar o token.");
  }, [newLabel, newColor, sceneId, gridSize]);

  const handleDragEnd = useCallback(
    (token: Token, e: Konva.KonvaEventObject<DragEvent>) => {
      const x = cellAt(e.target.x(), gridSize);
      const y = cellAt(e.target.y(), gridSize);
      // Se soltar na mesma casa, o estado não muda e o React não reposiciona o círculo sozinho.
      e.target.position({ x: cellCenter(x, gridSize), y: cellCenter(y, gridSize) });
      setTokens((prev) => new Map(prev).set(token.id, { ...token, x, y }));
      moveTokenAction({ tokenId: token.id, x, y }).then((result) => {
        if (!result.ok) console.error("Não foi possível mover o token.");
      });
    },
    [gridSize],
  );

  const handleDelete = useCallback((tokenId: string) => {
    setTokens((prev) => {
      const next = new Map(prev);
      next.delete(tokenId);
      return next;
    });
    deleteTokenAction(tokenId).then((result) => {
      if (!result.ok) console.error("Não foi possível remover o token.");
    });
  }, []);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
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

  return (
    <div className="relative h-full w-full">
      {isMaster && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 p-2 shadow-lg backdrop-blur-sm">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddToken()}
            placeholder="Nome do token"
            maxLength={30}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <div className="flex gap-1">
            {TOKEN_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Cor ${color}`}
                onClick={() => setNewColor(color)}
                className="h-6 w-6 rounded-full border-2"
                style={{ backgroundColor: color, borderColor: color === newColor ? "var(--foreground)" : "transparent" }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddToken}
            className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Adicionar token
          </button>
        </div>
      )}

      <div ref={containerRef} className="h-full w-full touch-none bg-background">
        <Stage
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
          <Layer>
            <Rect x={0} y={0} width={MAP_SIZE} height={MAP_SIZE} fill="#171717" />
            {backgroundImage && (
              <KonvaImage
                image={backgroundImage}
                x={0}
                y={0}
                width={MAP_SIZE}
                height={MAP_SIZE}
                listening={false}
              />
            )}
            {gridLines(gridSize).map((line) => (
              <Line key={line.key} points={line.points} stroke="#2a2a2a" strokeWidth={1} opacity={0.6} />
            ))}
          </Layer>
          <Layer>
            {[...tokens.values()].map((token) => (
              <TokenShape
                key={token.id}
                token={token}
                gridSize={gridSize}
                draggable={isMaster}
                onDragEnd={handleDragEnd}
                onDelete={isMaster ? handleDelete : undefined}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

function TokenShape({
  token,
  gridSize,
  draggable,
  onDragEnd,
  onDelete,
}: {
  token: Token;
  gridSize: number;
  draggable: boolean;
  onDragEnd: (token: Token, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDelete?: (tokenId: string) => void;
}) {
  const cx = cellCenter(token.x, gridSize);
  const cy = cellCenter(token.y, gridSize);
  const radius = gridSize * 0.4;

  return (
    <>
      <Circle
        x={cx}
        y={cy}
        radius={radius}
        fill={token.color}
        stroke="#0a0a0a"
        strokeWidth={2}
        draggable={draggable}
        onDragEnd={(e) => onDragEnd(token, e)}
        onDblClick={() => onDelete?.(token.id)}
        onDblTap={() => onDelete?.(token.id)}
      />
      <Text
        x={cx - gridSize / 2}
        y={cy + radius + 2}
        width={gridSize}
        align="center"
        text={token.label}
        fontSize={11}
        fill="#e5e5e5"
        listening={false}
      />
    </>
  );
}
