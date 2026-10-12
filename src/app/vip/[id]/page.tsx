import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The separate VIP sign-up page is retired: clients join a barber's texts by ticking the box when
 * they book. Old VIP links (in bios, texts, saved bookmarks) open the barber's page instead.
 */
export default async function OldVipLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const { data: barber } = await createAdminClient().from("users").select("slug").eq("user_id", id).maybeSingle();
    if (barber?.slug) redirect(`/${barber.slug}`);
    redirect(`/book/${id}`);
  }
  redirect("/");
}
