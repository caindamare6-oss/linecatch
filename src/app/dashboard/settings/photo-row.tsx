"use client";

import { useRef, useState } from "react";
import { Card } from "../ui";
import { useT } from "@/lib/i18n";

/** Shrinks a phone photo to at most `maxEdge` px on its long edge as a JPEG, so uploads stay small. */
async function shrink(file: File, maxEdge: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("unreadable");
  return blob;
}

/** Settings → Shop: an optional photo for their story image. No photo is the default. */
export function PhotoRow({ url, onChange }: { url: string | null; onChange: (url: string | null) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const form = new FormData();
      form.append("cover", await shrink(file, 1600, 0.84), "cover.jpg");
      const res = await fetch("/api/cover", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.coverUrl);
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : t("portfolio.err_upload"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/cover", { method: "DELETE" });
    if (res.ok) onChange(null);
    else setErr(t("portfolio.err_save_photo"));
    setBusy(false);
  }

  return (
    <Card className="px-4 py-3.5 flex items-center gap-3">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-11 h-11 rounded-[10px] object-cover shrink-0" />
      ) : (
        <span className="w-11 h-11 rounded-[10px] bg-white/[0.05] shrink-0" aria-hidden />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-white/85">{t("settings.photo")}</p>
        <p className="text-[12px] text-white/40 leading-snug">{err || t("settings.photo_hint")}</p>
      </div>
      {url && (
        <button onClick={remove} disabled={busy} className="h-9 px-3 rounded-[10px] text-[13px] text-white/50 hover:text-white disabled:opacity-40">
          {t("settings.photo_remove")}
        </button>
      )}
      <button
        onClick={() => input.current?.click()}
        disabled={busy}
        className="h-9 px-3 rounded-[10px] border border-[var(--accent-color)]/35 text-[var(--accent-color)] text-[13px] font-semibold disabled:opacity-40"
      >
        {busy ? "…" : url ? t("settings.photo_change") : t("settings.photo_add")}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
    </Card>
  );
}
