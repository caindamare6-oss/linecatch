import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import { DevThemeEditorLoader } from "@/components/dev-theme-loader";
import { cookies, headers } from "next/headers";
import { I18nProvider } from "@/lib/i18n";
import { LANG_COOKIE, isLocale, fromAcceptLanguage } from "@/lib/i18n-shared";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LineCatch",
  description: "Never lose a customer to a missed call",
  // iPhone "Add to Home Screen": open full screen with the app's name under the icon.
  appleWebApp: { capable: true, title: "LineCatch", statusBarStyle: "black" },
};

export const viewport: Viewport = { themeColor: "#121110" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Saved choice wins; otherwise follow the browser (Spanish phones open in Spanish).
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : fromAcceptLanguage((await headers()).get("accept-language"));
  return (
    <html
      lang={locale}
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#121110]">
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <DevThemeEditorLoader />
      </body>
    </html>
  );
}
