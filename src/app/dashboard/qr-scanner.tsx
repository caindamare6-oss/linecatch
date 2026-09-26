"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";

type ScanState =
  | { type: "scanning" }
  | { type: "error"; message: string; fallback?: boolean }
  | { type: "success"; code: string }
  | { type: "existing"; code: string };

function extractStickerCode(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("linecatch.app")) return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 2 && segments[0] === "s") return segments[1];
    return null;
  } catch {
    return null;
  }
}

const CAMERA_FALLBACK = "Or use your phone’s Camera app to scan the sticker directly — it’ll open the activation page.";

export function QRScanner({
  onClose,
  onActivated,
}: {
  onClose: () => void;
  onActivated: (code: string) => void;
}) {
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
          setState({ type: "error", message: data.error || "This code has already been claimed." });
        }
        return;
      }

      setState({ type: "error", message: data.error || "Failed to activate." });
    } catch {
      setState({ type: "error", message: "Network error. Check your connection and try again." });
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
            setState({ type: "error", message: "That’s not a LineCatch sticker code." });
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
            message: "Camera access was denied. On iPhone, go to Settings → Safari → Camera and set it to “Allow.” Then reload this page.",
            fallback: true,
          });
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setState({
            type: "error",
            message: "No camera found on this device.",
            fallback: true,
          });
        } else {
          setState({
            type: "error",
            message: "Could not start the camera. Make sure you’re on HTTPS and camera access is enabled.",
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
  }, [stopCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={handleClose}
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
            Point your camera at the QR code on your LineCatch sticker
          </p>
          {claiming && (
            <div className="mt-3 flex items-center gap-2 text-[var(--accent-color)] text-sm">
              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'transparent', borderTopColor: 'var(--accent-color)' }} />
              Activating...
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
          <p className="text-white text-lg font-semibold mb-2">Can&apos;t scan</p>
          <p className="text-white/60 text-sm mb-4">{state.message}</p>
          {state.fallback && (
            <p className="text-white/40 text-xs mb-6">{CAMERA_FALLBACK}</p>
          )}
          <button
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/15 transition-colors"
          >
            Close
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
          <p className="text-white text-lg font-semibold mb-2">You already have a sticker</p>
          <p className="text-white/60 text-sm mb-2">
            Your active code is <span className="font-mono text-white">{state.code}</span>.
          </p>
          <p className="text-white/40 text-xs mb-6">
            Each barber gets one code. Need more copies? Request them from Settings.
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent-color)] text-[#0d0d0d] hover:brightness-90 transition-colors"
          >
            Got it
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
          <p className="text-white text-xl font-bold mb-2">Sticker Activated!</p>
          <p className="text-white/60 text-sm mb-1">
            Code <span className="font-mono text-white">{state.code}</span> is yours.
          </p>
          <p className="text-white/50 text-sm mb-4">
            SMS is now live &mdash; missed-call auto-replies, booking confirmations, reminders, and review requests are all turned on.
          </p>
          <div className="bg-white/[0.06] border border-white/[0.1] rounded-xl p-4 mb-6">
            <p className="text-[var(--accent-color)] text-sm font-semibold mb-1">What&apos;s next?</p>
            <p className="text-white/50 text-xs leading-relaxed">
              Place the sticker on your mirror where clients can see it from the chair. When they scan it, they&apos;ll sign up as a VIP and start getting booking reminders and review requests automatically.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent-color)] text-[#0d0d0d] hover:brightness-90 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
