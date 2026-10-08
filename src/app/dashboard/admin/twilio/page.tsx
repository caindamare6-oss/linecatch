"use client";

import { useCallback, useEffect, useState } from "react";
import type { TwilioStatus } from "@/lib/twilio-setup";
import type { PoolRow } from "@/lib/phone-numbers";

/** Founder only: check the Twilio connection and wire every barber's number to this app. */
export default function TwilioAdminPage() {
  const [status, setStatus] = useState<TwilioStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/twilio");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Couldn't load");
    else setStatus(data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state updates after the request resolves
    load();
  }, [load]);

  async function fix() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/admin/twilio", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Couldn't update Twilio");
    setStatus(data.status);
    const failed = (data.failed || []).map((f: { phone: string; error: string }) => `${f.phone}: ${f.error}`);
    setNote(failed.length ? `Couldn't update ${failed.join("; ")}` : data.fixed?.length ? `Updated ${data.fixed.length} number(s).` : "Nothing needed changing.");
  }

  const ok = (b: boolean) => (b ? "✓" : "✗");

  return (
    <main className="mx-auto max-w-xl px-4 py-6 text-[15px]">
      <h1 className="mb-1 text-2xl font-semibold">Twilio</h1>
      <p className="mb-5 text-[13px] opacity-70">Calls and texts for every barber go through Twilio. This checks the connection.</p>

      {error && <p className="mb-4 rounded-lg border border-red-500/40 p-3 text-red-400">{error}</p>}
      {!status && !error && <p className="opacity-70">Checking…</p>}

      {status && (
        <>
          <section className="mb-5 rounded-xl border border-white/10 p-4">
            <Row label="Credentials in Vercel" value={ok(status.credentials)} />
            <Row label="Twilio account" value={status.account.ok ? `✓ ${status.account.name} (${status.account.status})` : `✗ ${status.account.error}`} />
            <Row label="Texts really send" value={ok(!status.devMode && status.enabled)} />
            <Row label="App address" value={status.appUrl} />
          </section>

          {status.problems.length > 0 ? (
            <section className="mb-5 rounded-xl border border-amber-500/40 p-4">
              <h2 className="mb-2 font-semibold">To fix</h2>
              <ul className="list-disc space-y-1 pl-5">
                {status.problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </section>
          ) : (
            <p className="mb-5 rounded-xl border border-emerald-500/40 p-4">Everything is connected.</p>
          )}

          <section className="mb-5 rounded-xl border border-white/10 p-4">
            <h2 className="mb-2 font-semibold">Barber numbers</h2>
            {status.numbers.length === 0 && <p className="opacity-70">No barber has a LineCatch number yet.</p>}
            {status.numbers.map((n) => (
              <div key={n.phone} className="flex justify-between gap-3 border-t border-white/5 py-2 first:border-0">
                <span>{n.owner}<br /><span className="text-[13px] opacity-70">{n.phone}</span></span>
                <span className="text-right text-[13px]">
                  {n.inTwilio ? <>Calls {ok(n.voiceOk)} · Texts {ok(n.smsOk)}</> : "Not in Twilio account"}
                </span>
              </div>
            ))}
            {status.unlinked.length > 0 && (
              <p className="mt-3 text-[13px] opacity-70">In Twilio but not on any barber: {status.unlinked.join(", ")}</p>
            )}
          </section>

          <button
            onClick={fix}
            disabled={busy || !status.account.ok}
            className="w-full rounded-xl bg-[var(--accent-color)] py-3 font-semibold text-[var(--accent-fg)] disabled:opacity-40"
          >
            {busy ? "Updating…" : "Point every number at this app"}
          </button>
          {note && <p className="mt-3 text-[13px]">{note}</p>}
        </>
      )}

      <NumberPool />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="opacity-70">{label}</span>
      <span className="text-right break-all">{value}</span>
    </div>
  );
}

/** Every number we own. Numbers are never sold back to Twilio: a freed one goes to the next barber after 30 days. */
function NumberPool() {
  const [pool, setPool] = useState<PoolRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/numbers");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPool(data.pool);
    else setError(data.error || "Couldn't load numbers");
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state updates after the request resolves
    load();
  }, [load]);

  async function release(userId: string) {
    setError(null);
    const res = await fetch("/api/admin/numbers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "release", userId }) });
    const data = await res.json().catch(() => ({}));
    setConfirm(null);
    if (!res.ok) return setError(data.error || "Couldn't release");
    setPool(data.pool);
  }

  const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <section className="mt-6 rounded-xl border border-white/10 p-4">
      <h2 className="mb-1 font-semibold">Number pool</h2>
      <p className="mb-3 text-[13px] opacity-70">Barbers get a number when their setup, services, hours and portfolio are done. Freed numbers are reused after 30 days, never sold back.</p>
      {error && <p className="mb-2 text-[13px] text-red-400">{error}</p>}
      {!pool && !error && <p className="opacity-70">Loading…</p>}
      {pool && pool.length === 0 && <p className="opacity-70">No numbers yet.</p>}
      {pool?.map((n) => (
        <div key={n.phone} className="flex items-center justify-between gap-3 border-t border-white/5 py-2 first:border-0">
          <span>
            {n.phone}
            <br />
            <span className="text-[13px] opacity-70">
              {n.owner ? n.owner : n.waiting && n.reusableAt ? `Free · reusable ${day(n.reusableAt)}` : "Free · ready for the next barber"}
            </span>
          </span>
          {n.ownerId &&
            (confirm === n.ownerId ? (
              <span className="flex gap-2">
                <button onClick={() => release(n.ownerId!)} className="rounded-lg bg-red-500/80 px-3 py-1.5 text-[13px] font-semibold">Release</button>
                <button onClick={() => setConfirm(null)} className="rounded-lg border border-white/15 px-3 py-1.5 text-[13px]">Keep</button>
              </span>
            ) : (
              <button onClick={() => setConfirm(n.ownerId)} className="rounded-lg border border-white/15 px-3 py-1.5 text-[13px]">Take back</button>
            ))}
        </div>
      ))}
    </section>
  );
}
