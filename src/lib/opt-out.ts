type Row = Record<string, unknown> | null;
type Filter = {
  eq(col: string, val: string): Filter;
  maybeSingle(): PromiseLike<{ data: Row }>;
};
type Db = { from(table: string): { select(cols: string): Filter } };

export async function isOptedOut(db: Db, userId: string, phone: string): Promise<boolean> {
  const [{ data: vip }, { data: optOut }] = await Promise.all([
    db.from("vip_clients").select("opted_out_at").eq("user_id", userId).eq("phone_number", phone).maybeSingle(),
    db.from("opt_outs").select("caller_phone").eq("user_id", userId).eq("caller_phone", phone).maybeSingle(),
  ]);
  return !!vip?.opted_out_at || !!optOut;
}
