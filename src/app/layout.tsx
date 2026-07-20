import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import { themeScript } from "@/shared/theme";

export const metadata: Metadata = {
  title: "Tairos OS — Collaborative AI Software Factory",
  description:
    "Plataforma colaborativa de desarrollo de software de ciclo cerrado, asistida por agentes de IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
