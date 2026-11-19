import type { Metadata } from "next";
import { ConfirmHost } from "@/components/confirm";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reinos de Ferro VTT",
  description: "Mesa virtual para Reinos de Ferro",
};

// Aplica o tema salvo antes do React hidratar — sem isso a tela pisca no
// tema errado (escuro, o padrão do CSS) por um instante em quem escolheu
// claro. `suppressHydrationWarning` porque o atributo é escrito fora do
// React de propósito (ver ThemeToggle).
const themeScript = `
try {
  if (localStorage.getItem("theme") === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ConfirmHost />
      </body>
    </html>
  );
}
