import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Цифровой улей — ИИ-помощник пчеловода",
  description:
    "Приложение пчеловода: телеметрия ульев с датчиков, графики веса и температуры, карта пасеки, чат с ИИ-агентом, погода и кочёвка.",
  keywords: ["Цифровой улей", "пчеловодство", "ИИ-агент", "пасека", "телеметрия"],
};

export const viewport: Viewport = {
  themeColor: "#E93A2D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Безмигательная инициализация темы: класс .dark ставим до первой отрисовки
  // из сохранённых настроек в localStorage (ключ zustand-persist 'uley-app').
  const themeScript = `
    try {
      var raw = localStorage.getItem('uley-app');
      var theme = raw ? (JSON.parse(raw).state || {}).theme : 'light';
      var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (dark) document.documentElement.classList.add('dark');
    } catch (e) {}
  `
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${manrope.variable} antialiased bg-background text-foreground font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
