import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bebas_Neue } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import Landing from "./landing";
import { createAdminClient } from "@/lib/supabase/admin";
import { findReferrer, normalizeCode, referrerName } from "@/lib/referrals";

const poster = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-poster", display: "swap" });

export const metadata: Metadata = {
  title: "LineCatch: You're cutting. LineCatch is booking.",
  description: "When you miss a call, LineCatch texts the caller a link to book with you. Built for barbers. 14 days free, no card needed.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  // Barbers who are signed in go straight to their dashboard; everyone else sees the landing page.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  // Arrived from a barber's referral link (/join/CODE): show who sent them and the discount.
  const code = normalizeCode((await searchParams).ref);
  const referrer = code ? await findReferrer(createAdminClient(), code) : null;

  return (
    <div className={poster.variable}>
      <Landing referredBy={referrer ? referrerName(referrer) || "A barber" : null} />
    </div>
  );
}
