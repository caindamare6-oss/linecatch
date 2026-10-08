"use client";

import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useT, useFormat } from "@/lib/i18n";
import { translate } from "@/lib/i18n-shared";
import { appUrl } from "@/lib/config";

type StickerCode = {
  code: string;
  owner_user_id: string | null;
  status: string;
  claimed_at: string | null;
  created_at: string;
  batch_label: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  handed_out_at: string | null;
  handed_to: string | null;
};

/** Group key for codes without a batch label (shown translated). */
const NO_BATCH = "\u0000none";
const PNG_W = 1800;
const PNG_H = 2400;

type StickerText = { tagline: string; scan: string; hint1: string; hint2: string };

const stickerText = (l: "en" | "es"): StickerText => ({
  tagline: translate(l, "admin.sticker_tagline"),
  scan: translate(l, "admin.sticker_scan"),
  hint1: translate(l, "admin.sticker_hint_1"),
  hint2: translate(l, "admin.sticker_hint_2"),
});

/** Print artwork for one sticker, in English and Spanish so one print run works in any shop. */
async function renderStickerPNG(code: string): Promise<Blob> {
  const text = stickerText("en");
  const es = stickerText("es");
  const site = appUrl();
  const canvas = document.createElement("canvas");
  canvas.width = PNG_W;
  canvas.height = PNG_H;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#121110";
  ctx.fillRect(0, 0, PNG_W, PNG_H);

  // Outer border with accent
  const borderInset = 60;
  ctx.strokeStyle = "#B8914F";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(borderInset, borderInset, PNG_W - borderInset * 2, PNG_H - borderInset * 2, 40);
  ctx.stroke();

  // LineCatch logo text at top
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 120px sans-serif";
  ctx.fillText("Line", PNG_W / 2 - 135, 280);
  ctx.fillStyle = "#B8914F";
  ctx.fillText("Catch", PNG_W / 2 + 145, 280);

  // Tagline
  ctx.fillStyle = "#948C80";
  ctx.font = "44px sans-serif";
  ctx.fillText(text.tagline, PNG_W / 2, 350);
  ctx.font = "38px sans-serif";
  ctx.fillText(es.tagline, PNG_W / 2, 400);

  // QR code — render to a temporary canvas then draw centered
  const qrUrl = `${site}/s/${code}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 900,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  const qrImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = qrDataUrl;
  });

  const qrSize = 900;
  const qrX = (PNG_W - qrSize) / 2;
  const qrY = 490;

  // White background behind QR
  ctx.fillStyle = "#ffffff";
  const qrPad = 40;
  // A fresh path: without it the fill also floods the outer border shape and whites out the card.
  ctx.beginPath();
  ctx.roundRect(qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 24);
  ctx.fill();

  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Call to action
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px sans-serif";
  ctx.fillText(text.scan, PNG_W / 2, 1540);
  ctx.fillStyle = "#D8D2C8";
  ctx.font = "bold 56px sans-serif";
  ctx.fillText(es.scan, PNG_W / 2, 1620);

  // Code display
  ctx.fillStyle = "#B8914F";
  ctx.font = "bold 64px monospace";
  ctx.fillText(code, PNG_W / 2, 1740);

  // Instructions at bottom
  ctx.fillStyle = "#777777";
  ctx.font = "36px sans-serif";
  ctx.fillText(text.hint1, PNG_W / 2, 1860);
  ctx.fillText(text.hint2, PNG_W / 2, 1906);
  ctx.fillText(es.hint1, PNG_W / 2, 1980);
  ctx.fillText(es.hint2, PNG_W / 2, 2026);

  // LineCatch small mark at very bottom
  ctx.fillStyle = "#333333";
  ctx.font = "28px sans-serif";
  ctx.fillText(site.replace(/^https?:\/\/(www\.)?/, ""), PNG_W / 2, 2260);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

type ShipRequest = {
  user_id: string;
  business_name: string | null;
  first_name: string | null;
  email: string | null;
  sticker_requested_at: string;
  shipping_address: { name: string; line1: string; line2: string | null; city: string; state: string; zip: string } | null;
};

export default function AdminStickersPage() {
  const t = useT();
  const f = useFormat();
  const [codes, setCodes] = useState<StickerCode[]>([]);
  const [barbers, setBarbers] = useState<Record<string, string>>({});
  const [toShip, setToShip] = useState<ShipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // Generate form
  const [genCount, setGenCount] = useState("10");
  const [genLabel, setGenLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState("");

  // ZIP download
  const [downloadingBatch, setDownloadingBatch] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState("");

  // Filter
  const [statusFilter, setStatusFilter] = useState("");

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/stickers?${params}`);
      if (res.status === 403) {
        setAuthorized(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error && t(data.error));
      setCodes(data.codes);
      setBarbers(data.barbers);
      setToShip(data.toShip || []);
    } catch (err: unknown) {
      setError((err instanceof Error && err.message) || t("admin.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    fetch("/api/admin/check")
      .then((r) => r.json())
      .then((d) => setAuthorized(!!d.isAdmin))
      .catch(() => setAuthorized(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-change; state updates after the request resolves
    if (authorized) loadCodes();
  }, [authorized, loadCodes]);

  async function handleGenerate() {
    setGenerating(true);
    setGenResult("");
    try {
      const res = await fetch("/api/admin/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          count: parseInt(genCount),
          batchLabel: genLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error && t(data.error));

      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stickers-${genLabel || "batch"}-${data.codes.length}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setGenResult(t("admin.generated", { n: data.codes.length }));
      setGenLabel("");
      loadCodes();
    } catch (err: unknown) {
      setGenResult((err instanceof Error && err.message) || t("admin.failed"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadBatchZip(batchLabel: string) {
    const batchCodes = codes.filter((c) => c.batch_label === batchLabel);
    if (batchCodes.length === 0) return;

    setDownloadingBatch(batchLabel);
    setDownloadProgress(`0 / ${batchCodes.length}`);

    try {
      const zip = new JSZip();

      for (let i = 0; i < batchCodes.length; i++) {
        const c = batchCodes[i];
        setDownloadProgress(`${i + 1} / ${batchCodes.length}`);
        const pngBlob = await renderStickerPNG(c.code);
        zip.file(`${c.code}.png`, pngBlob);
      }

      setDownloadProgress(t("admin.zipping"));
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stickers-${batchLabel}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert((err instanceof Error && err.message) || t("admin.zip_failed"));
    } finally {
      setDownloadingBatch(null);
      setDownloadProgress("");
    }
  }

  async function handleAction(code: string, action: "retire" | "reassign", newOwner?: string) {
    try {
      const body: Record<string, unknown> = { action, code };
      if (action === "reassign") body.newOwnerUserId = newOwner || null;

      const res = await fetch("/api/admin/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error && t(data.error));
      loadCodes();
    } catch (err: unknown) {
      alert((err instanceof Error && err.message) || t("admin.failed"));
    }
  }

  // Group codes by batch label
  const batches = codes.reduce<Record<string, StickerCode[]>>((acc, c) => {
    const label = c.batch_label || NO_BATCH;
    if (!acc[label]) acc[label] = [];
    acc[label].push(c);
    return acc;
  }, {});

  const batchLabels = Object.keys(batches).sort((a, b) => {
    if (a === NO_BATCH) return 1;
    if (b === NO_BATCH) return -1;
    return a.localeCompare(b);
  });

  if (authorized === false) {
    return (
      <div className="text-center py-16 text-white/40">
        <p>{t("admin.denied")}</p>
      </div>
    );
  }

  if (authorized === null) {
    return (
      <div className="flex items-center justify-center py-16 px-4">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <h2 className="text-lg font-bold text-white">{t("admin.title")}</h2>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <FieldCard codes={codes} barbers={barbers} onSaved={loadCodes} />

      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">{t("admin.to_ship", { n: toShip.length })}</h3>
        {toShip.length === 0 ? (
          <p className="text-sm text-white/40">{t("admin.none_waiting")}</p>
        ) : (
          <ul className="space-y-3">
            {toShip.map((r) => (
              <li key={r.user_id} className="text-sm">
                <p className="text-white/85 font-medium">{r.business_name || r.first_name || r.email}</p>
                {r.shipping_address && (
                  <p className="text-white/50 text-xs leading-relaxed">
                    {r.shipping_address.name}, {r.shipping_address.line1}
                    {r.shipping_address.line2 ? `, ${r.shipping_address.line2}` : ""}, {r.shipping_address.city}, {r.shipping_address.state} {r.shipping_address.zip}
                  </p>
                )}
                <p className="text-white/30 text-[11px]">{t("admin.requested", { date: f.date(r.sticker_requested_at, { month: "short", day: "numeric", year: "numeric" }) })}{r.email ? ` · ${r.email}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Generate Batch */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-3">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium">
          {t("admin.generate_batch")}
        </h3>
        <p className="text-[12px] text-white/45 leading-relaxed">
          {t("admin.points_to", { url: appUrl() })} {t("admin.print_bilingual")}
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            value={genCount}
            onChange={(e) => setGenCount(e.target.value)}
            min={1}
            max={500}
            aria-label={t("admin.count_aria")}
            className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-[var(--accent-color)]"
          />
          <input
            type="text"
            value={genLabel}
            onChange={(e) => setGenLabel(e.target.value)}
            placeholder={t("admin.label_placeholder")}
            className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--accent-color)]"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !genLabel.trim()}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--accent-color)] text-[var(--accent-fg)] hover:brightness-90 disabled:opacity-30 transition-all"
          >
            {generating ? "…" : t("admin.generate")}
          </button>
        </div>
        {genResult && (
          <p className="text-xs text-[var(--accent-color)]">{genResult}</p>
        )}
      </div>

      {/* Codes by Batch */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium">
            {t("admin.all_codes", { n: codes.length })}
          </h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t("admin.status_filter")}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white/60 focus:outline-none"
          >
            <option value="">{t("admin.all_statuses")}</option>
            <option value="unclaimed">{t("admin.status_unclaimed")}</option>
            <option value="active">{t("admin.status_active")}</option>
            <option value="retired">{t("admin.status_retired")}</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <PageSkeleton />
          </div>
        ) : (
          <div className="space-y-5 max-h-[600px] overflow-y-auto">
            {batchLabels.map((label) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white/50">{label === NO_BATCH ? t("admin.no_batch") : label}</span>
                    <span className="text-[10px] text-white/20">{t("admin.n_codes", { n: batches[label].length })}</span>
                  </div>
                  {label !== NO_BATCH && (
                    <button
                      onClick={() => handleDownloadBatchZip(label)}
                      disabled={downloadingBatch !== null}
                      className="flex items-center gap-1.5 text-[11px] text-[var(--accent-color)] hover:brightness-90 disabled:opacity-30 px-2.5 py-1 rounded-lg bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/15 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      {downloadingBatch === label ? downloadProgress : t("admin.download_zip")}
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {batches[label].map((c) => (
                    <div
                      key={c.code}
                      className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2.5"
                    >
                      <span className="font-mono text-sm text-white/80 w-20 shrink-0">{c.code}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                        c.status === "active"
                          ? "text-[var(--accent-color)] bg-[var(--accent-color)]/10"
                          : c.status === "unclaimed"
                          ? "text-yellow-400 bg-yellow-400/10"
                          : "text-white/30 bg-white/5"
                      }`}>
                        {t(`admin.status_${c.status}`)}
                      </span>
                      <span className="text-xs text-white/30 truncate flex-1">
                        {c.owner_user_id
                          ? barbers[c.owner_user_id] || c.owner_user_id.slice(0, 8)
                          : "—"}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        {c.status === "active" && (
                          <button
                            onClick={() => handleAction(c.code, "reassign")}
                            className="text-[10px] text-white/30 hover:text-white/60 px-1.5 py-0.5 rounded bg-white/[0.03] hover:bg-white/[0.06]"
                          >
                            {t("admin.clear")}
                          </button>
                        )}
                        {c.status !== "retired" && (
                          <button
                            onClick={() => handleAction(c.code, "retire")}
                            className="text-[10px] text-red-400/50 hover:text-red-400 px-1.5 py-0.5 rounded bg-white/[0.03] hover:bg-red-400/10"
                          >
                            {t("admin.retire")}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {codes.length === 0 && (
              <p className="text-center text-xs text-white/20 py-4">{t("admin.no_codes")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Handing stickers out in person: record the shop, then watch who finishes setup. */
function FieldCard({ codes, barbers, onSaved }: { codes: StickerCode[]; barbers: Record<string, string>; onSaved: () => void }) {
  const t = useT();
  const f = useFormat();
  const [code, setCode] = useState("");
  const [shop, setShop] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const handed = codes.filter((c) => c.handed_out_at).sort((a, b) => (b.handed_out_at! > a.handed_out_at! ? 1 : -1));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    const res = await fetch("/api/admin/stickers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "hand_out", code: code.trim().toUpperCase(), shop }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(t(d.error || "common.try_again"));
    setMsg(t("admin.field_saved", { code: code.trim().toUpperCase(), shop: shop.trim() }));
    setCode("");
    setShop("");
    onSaved();
  }

  const field = "h-11 rounded-xl bg-white/[0.06] border border-white/[0.1] px-3 text-sm text-white placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50";
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-3">
      <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium">{t("admin.field_title")}</h3>
      <p className="text-[13px] text-white/50 leading-relaxed">{t("admin.field_how")}</p>
      <form onSubmit={save} className="grid grid-cols-[110px_1fr] gap-2">
        <input aria-label={t("admin.field_code")} placeholder={t("admin.field_code")} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 12))} className={`${field} font-mono`} required />
        <input aria-label={t("admin.field_shop")} placeholder={t("admin.field_shop")} value={shop} onChange={(e) => setShop(e.target.value.slice(0, 60))} className={field} required />
        <button type="submit" disabled={busy} className="col-span-2 h-11 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-sm font-semibold disabled:opacity-50">{t("admin.field_save")}</button>
      </form>
      {msg && <p className="text-[13px] text-[var(--app-ok)]">{msg}</p>}
      {err && <p className="text-[13px] text-red-400" role="alert">{err}</p>}
      {handed.length === 0 ? (
        <p className="text-sm text-white/40">{t("admin.field_none")}</p>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {handed.map((c) => (
            <li key={c.code} className="py-2.5 flex items-center gap-3 text-sm">
              <span className="font-mono text-white/70 w-[72px] shrink-0">{c.code}</span>
              <span className="flex-1 min-w-0 truncate text-white/85">{c.status === "active" && c.owner_user_id ? barbers[c.owner_user_id] || c.handed_to : c.handed_to}</span>
              <span className="text-[11px] text-white/35 shrink-0">{f.date(c.handed_out_at!, { month: "short", day: "numeric" })}</span>
              <span className={`text-[11px] font-semibold shrink-0 ${c.status === "active" ? "text-[var(--app-ok)]" : "text-[var(--app-warn)]"}`}>{c.status === "active" ? t("admin.field_live") : t("admin.field_waiting")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
