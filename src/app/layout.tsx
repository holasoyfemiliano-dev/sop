import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOP — Sistema Operativo Personal",
  description: "Tu sistema inteligente de ejecución diaria",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
