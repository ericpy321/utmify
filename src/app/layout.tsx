import type { Metadata } from "next";
import "./globals.css";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Sales Tracker",
  description: "Ventas, gasto y lucro por campaña, conjunto y anuncio.",
  robots: { index: false, follow: false },
};

// Aplica el tema guardado antes de pintar, para evitar el destello claro/oscuro.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { lang } = await getDict();
  return (
    <html lang={lang} suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
