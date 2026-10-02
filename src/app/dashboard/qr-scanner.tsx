"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { useT } from "@/lib/i18n";
import { appUrl } from "@/lib/config";

type ScanState =
  | { type: "scanning" }
  | { type: "error"; message: string; fallback?: boolean }
  | { type: "success"; code: string }
  | { type: "existing"; code: string };

function extractStickerCode(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("linecatch.app") && parsed.host !== new URL(appUrl()).host) return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 2 && segments[0] === "s") return segments[1];
    return null;
  } catch {
    return null;
  }
}

/** Renders a translated sentence with the sticker code set in monospace where {code} sits. */
function Coded({ text, code }: { text: string; code: string }) {
  const [before, after = ""] = text.split("{code}");
  return (
    <>
      {before}
      <span className="font-mono text-white">{code}</span>
      {after}
    </>
  );
}

export function QRScanner({
  onClose,
  onActivated,
}: {
  onClose: () => void;
  onActivated: (code: string) => void;
}) {
  const t = useT();
  const [state, setState] = useState<ScanState>({ type: "scanning" });
  const [claiming, setClaiming] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef<number>(0);
  const claimedRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  async function claimCode(code: string) {
    if (claimedRef.current || claiming) return;
    claimedRef.current = true;
    setClaiming(true);
    stopCamera();

    try {
      const res = await fetch("/api/stickers/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (res.ok) {
        setState({ type: "success", code });
        onActivated(code);
        return;
      }

      if (res.status === 409) {
        if (data.existingCode) {
          setState({ type: "existing", code: data.existingCode });
        } else {
          setState({ type: "error", message: data.error || t("qr.already_claimed") });
        }
        return;
      }

      setState({ type: "error", message: data.error || t("qr.failed") });
    } catch {
      setState({ type: "error", message: t("qr.network") });
    } finally {
      setClaiming(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const scanW = Math.min(video.videoWidth, 640);
        const scale = scanW / video.videoWidth;
        const scanH = Math.round(video.videoHeight * scale);
        canvas.width = scanW;
        canvas.height = scanH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

        function scanFrame() {
          if (cancelled || claimedRef.current) return;

          const now = performance.now();
          if (now - lastScanRef.current < 100) {
            rafRef.current = requestAnimationFrame(scanFrame);
            return;
          }
          lastScanRef.current = now;

          ctx.drawImage(video!, 0, 0, scanW, scanH);
          const imageData = ctx.getImageData(0, 0, scanW, scanH);
          const qr = jsQR(imageData.data, scanW, scanH, { inversionAttempts: "dontInvert" });

          if (qr?.data) {
            const code = extractStickerCode(qr.data);
            if (code) {
              claimCode(code);
              return;
            }
            setState({ type: "error", message: t("qr.not_linecatch") });
            setTimeout(() => {
              if (!claimedRef.current) setState({ type: "scanning" });
            }, 2000);
          }

          rafRef.current = requestAnimationFrame(scanFrame);
        }

        rafRef.current = requestAnimationFrame(scanFrame);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError") {
          setState({
            type: "error",
            message: t("qr.denied"),
            fallback: true,
          });
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setState({
            type: "error",
            message: t("qr.no_camera"),
            fallback: true,
          });
        } else {
          setState({
            type: "error",
            message: t("qr.start_failed"),
            fallback: true,
          });
        }
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // Start the camera once per open; restarting it on every render (claimCode, t) would flicker the video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={handleClose}
        aria-label={t("qr.close")}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {state.type === "scanning" && (
        <>
          <div className="relative w-full max-w-sm aspect-square mx-auto">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover rounded-2xl"
            />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-8 border-2 border-[var(--accent-color)]/50 rounded-xl" />
              <div className="absolute top-8 left-8 w-8 h-8 border-t-3 border-l-3 border-[var(--accent-color)] rounded-tl-xl" />
              <div className="absolute top-8 right-8 w-8 h-8 border-t-3 border-r-3 border-[var(--accent-color)] rounded-tr-xl" />
              <div className="absolute bottom-8 left-8 w-8 h-8 border-b-3 border-l-3 border-[var(--accent-color)] rounded-bl-xl" />
              <div className="absolute bottom-8 right-8 w-8 h-8 border-b-3 border-r-3 border-[var(--accent-color)] rounded-br-xl" />
            </div>
          </div>
          <p className="text-white/60 text-sm mt-4 text-center px-6">
            {t("qr.point")}
          </p>
          {claiming && (
            <div className="mt-3 flex items-center gap-2 text-[var(--accent-color)] text-sm">
              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'transparent', borderTopColor: 'var(--accent-color)' }} />
              {t("qr.activating")}
            </div>
          )}
        </>
      )}

      {state.type === "error" && (
        <div className="max-w-sm mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-white text-lg font-semibold mb-2">{t("qr.cant_scan")}</p>
          <p className="text-white/60 text-sm mb-4">{state.message}</p>
          {state.fallback && (
            <p className="text-white/40 text-xs mb-6">{t("qr.fallback")}</p>
          )}
          <button
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/15 transition-colors"
          >
            {t("qr.close_btn")}
          </button>
        </div>
      )}

      {state.type === "existing" && (
        <div className="max-w-sm mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white text-lg font-semibold mb-2">{t("qr.existing_title")}</p>
          <p className="text-white/60 text-sm mb-2">
            <Coded text={t("qr.existing_code")} code={state.code} />
          </p>
          <p className="text-white/40 text-xs mb-6">
            {t("qr.existing_note")}
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent-color)] text-[var(--accent-fg)] hover:brightness-90 transition-colors"
          >
            {t("qr.got_it")}
          </button>
        </div>
      )}

      {state.type === "success" && (
        <div className="max-w-sm mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white text-xl font-bold mb-2">{t("qr.success_title")}</p>
          <p className="text-white/60 text-sm mb-1">
            <Coded text={t("qr.success_code")} code={state.code} />
          </p>
          <p className="text-white/50 text-sm mb-4">
            {t("qr.success_body")}
          </p>
          <div className="bg-white/[0.06] border border-white/[0.1] rounded-xl p-4 mb-6">
            <p className="text-[var(--accent-color)] text-sm font-semibold mb-1">{t("qr.next_title")}</p>
            <p className="text-white/50 text-xs leading-relaxed">
              {t("qr.next_body")}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent-color)] text-[var(--accent-fg)] hover:brightness-90 transition-colors"
          >
            {t("qr.go_dashboard")}
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
