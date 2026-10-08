"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, SectionLabel, Card } from "../../ui";
import { measure } from "@/lib/sms-segments";
import { fillExample, missingFillIns, unknownFillIns, STOP_LINE, MAX_TEXT_LENGTH, type CatalogText } from "@/lib/text-catalog";

type Text = CatalogText & { en: string; es: string; updatedAt: string | null };

/** Founder only: rewrite the default texts every barber's clients get. */
export default function TextsAdminPage() {
  const [texts, setTexts] = useState<Text[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/texts")
      .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error)))
      .then((d) => setTexts(d.texts))
      .catch((e) => setError(typeof e === "string" ? e : "Couldn't load the texts"));
  }, []);

  const groups = useMemo(() => {
    const all = texts || [];
    return [
      { label: "Texts to clients", items: all.filter((t) => t.to === "client") },
      { label: "Texts to the barber", items: all.filter((t) => t.to === "barber") },
    ];
  }, [texts]);

  return (
    <main className="mx-auto max-w-xl px-4 pt-6 pb-24">
      <PageHeader title="Texts" back="/dashboard/settings" />
      <p className="text-[13px] text-white/50 leading-relaxed mb-5">
        The default wording every barber&apos;s clients get. Saving changes it for everyone right away, except barbers who wrote their own missed-call text.
        Words in {"{curly brackets}"} are filled in by the app.
      </p>
      {error && <p className="mb-4 rounded-lg border border-[var(--app-danger)]/40 p-3 text-[13px] text-[var(--app-danger)]" role="alert">{error}</p>}
      {!texts && !error && <p className="text-white/50">Loading…</p>}
      {texts &&
        groups.map((g) => (
          <section key={g.label} className="mb-7">
            <SectionLabel>{g.label}</SectionLabel>
            <ul className="space-y-2">
              {g.items.map((item) => (
                <li key={item.key}>
                  {open === item.key ? (
                    <Editor
                      item={item}
                      onClose={() => setOpen(null)}
                      onSaved={(en, es) => setTexts((all) => all!.map((x) => (x.key === item.key ? { ...x, en, es } : x)))}
                    />
                  ) : (
                    <button onClick={() => setOpen(item.key)} className="w-full text-left">
                      <Card className="px-4 py-3 hover:border-white/15 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[14px] font-medium text-white/85">{item.title}</span>
                          <span className="text-[12px] text-[var(--accent-color)] shrink-0">Edit</span>
                        </div>
                        <p className="text-[13px] text-white/50 mt-1 line-clamp-2">{item.en}</p>
                      </Card>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
    </main>
  );
}

function Editor({ item, onClose, onSaved }: { item: Text; onClose: () => void; onSaved: (en: string, es: string) => void }) {
  const [en, setEn] = useState(item.en);
  const [es, setEs] = useState(item.es);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");
  const changed = en.trim() !== item.en || es.trim() !== item.es;
  const problems = [
    ...missingFillIns(en, item).map((k) => `English needs {${k}}`),
    ...(es.trim() ? missingFillIns(es, item).map((k) => `Spanish needs {${k}}`) : []),
    ...unknownFillIns(en, item).map((k) => `{${k}} can't be filled in here`),
    ...(es.trim() ? unknownFillIns(es, item).map((k) => `{${k}} can't be filled in here (Spanish)`) : []),
  ];

  async function save() {
    setState("saving");
    setErr("");
    const res = await fetch("/api/admin/texts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: item.key, en, es }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(d.error || "Couldn't save");
      setState("idle");
      return;
    }
    onSaved(en.trim(), es.trim());
    setState("saved");
    setTimeout(() => setState("idle"), 1500);
  }

  return (
    <Card className="p-4 space-y-4 border-[var(--accent-color)]/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold">{item.title}</p>
          <p className="text-[12px] text-white/45 mt-0.5 leading-relaxed">{item.when}</p>
        </div>
        <button onClick={onClose} className="text-[12px] text-white/50 shrink-0">Close</button>
      </div>
      <Lang id={`${item.key}-en`} label="English" value={en} onChange={setEn} item={item} lang="en" />
      <Lang id={`${item.key}-es`} label="Spanish (leave empty to send the English)" value={es} onChange={setEs} item={item} lang="es" />
      <p className="text-[12px] text-white/40 leading-relaxed">
        You can use: {item.can.map((k) => `{${k}}`).join(" ")}
        {item.stop === "always" && " · “Reply STOP to opt out” is added to every one of these."}
        {item.stop === "first" && " · “Reply STOP to opt out” is added on a client's first text."}
      </p>
      {problems.length > 0 && <p className="text-[12px] text-[var(--app-warn)]">{problems.join(" · ")}</p>}
      {err && <p className="text-[12px] text-[var(--app-danger)]" role="alert">{err}</p>}
      <button
        onClick={save}
        disabled={!changed || problems.length > 0 || !en.trim() || state === "saving"}
        className="w-full h-11 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold disabled:opacity-35"
      >
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
      </button>
    </Card>
  );
}

function Lang({ id, label, value, onChange, item, lang }: { id: string; label: string; value: string; onChange: (v: string) => void; item: Text; lang: "en" | "es" }) {
  const preview = fillExample(value);
  const plain = measure(preview);
  const withStop = item.stop === "never" ? null : measure(preview + STOP_LINE[lang]);
  const line = (m: ReturnType<typeof measure>) => `${m.chars} characters · ${m.segments} ${m.segments === 1 ? "text" : "texts"} · $${m.cost.toFixed(4)}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold text-white/60">{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_TEXT_LENGTH))}
        rows={3}
        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-3.5 py-3 text-[14px] outline-none focus:border-[var(--accent-color)]/50 resize-y"
      />
      {value.trim() && (
        <div className="rounded-xl bg-white/[0.03] px-3.5 py-2.5 space-y-1">
          <p className="text-[13px] text-white/70 whitespace-pre-line">{preview}</p>
          <p className="text-[11px] text-white/40 tabular-nums">
            {line(plain)}
            {withStop && ` · with STOP line: ${line(withStop)}`}
          </p>
          {!plain.gsm && <p className="text-[11px] text-[var(--app-warn)]">{plain.nonGsm.join(" ")} makes this a special-character text: 70 characters per text instead of 160.</p>}
        </div>
      )}
    </div>
  );
}
