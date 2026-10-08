import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bebas_Neue } from "next/font/google";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/config";
import Landing from "./landing";

const poster = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-poster", display: "swap" });

export const metadata: Metadata = {
  title: "LineCatch: You're cutting. LineCatch is booking.",
  description: "When you miss a call, LineCatch texts the caller a link to book with you. Built for barbers. 30 days free, no card needed.",
};

export default async function Home() {
  // Barbers who are signed in go straight to their dashboard; everyone else sees the landing page.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const qr = await QRCode.toString(appUrl(), { type: "svg", margin: 0, color: { dark: "#121110", light: "#0000" } });
  return (
    <div className={poster.variable}>
      <Landing qr={qr} />
    </div>
  );
}
