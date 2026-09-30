"use client";

import dynamic from "next/dynamic";

// Konva usa o DOM (canvas) e não roda em SSR; carregado só no navegador.
export const TableCanvas = dynamic(
  () => import("./table-canvas").then((mod) => mod.TableCanvas),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-card" />,
  },
);
