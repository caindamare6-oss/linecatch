"use client";

import { useState } from "react";

export function ClaimSticker({
  code,
  existingCode,
}: {
  code: string;
  existingCode: string | null;
}) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState("");

  async function handleClaim() {
    setClaiming(true);
    setError("");

    try {
      const res = await fetch("/api/stickers/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to activate");
      }

      setClaimed(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setClaiming(false);
    }
  }

  // Barber already has an active sticker
  if (existingCode) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a] text-center">
          <div className="text-3xl font-bold mb-6 text-white">
            Line<span className="text-[var(--accent-color)]">Catch</span>
          </div>
          <div className="w-14 h-14 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">You already have a sticker</h2>
          <p className="text-gray-400 text-sm mb-2">
            Your active code is <span className="font-mono text-white">{existingCode}</span>.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Each barber gets one code — all your stickers point clients to the same place. Need more copies of your sticker? Request them from your dashboard.
          </p>
          <a
            href="/dashboard"
            className="inline-block bg-[var(--accent-color)] text-black font-semibold px-6 py-3 rounded-lg hover:brightness-90 transition"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Successfully activated
  if (claimed) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a] text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Sticker Activated!</h2>
          <p className="text-gray-400 mb-1">
            Code <span className="font-mono text-white">{code}</span> is yours.
          </p>
          <p className="text-gray-400 text-sm mb-6">
            SMS is now live — missed-call auto-replies, booking confirmations, reminders, and review requests are all turned on.
          </p>
          <a
            href="/dashboard"
            className="inline-block bg-[var(--accent-color)] text-black font-semibold px-6 py-3 rounded-lg hover:brightness-90 transition"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Activate screen
  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a] text-center">
        <div className="text-3xl font-bold mb-6 text-white">
          Line<span className="text-[var(--accent-color)]">Catch</span>
        </div>
        <div className="w-14 h-14 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625v6.75h6.75v-6.75h-6.75z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Activate your sticker</h2>
        <p className="text-gray-400 mb-3">
          Code <span className="font-mono text-white text-lg">{code}</span>
        </p>
        <p className="text-gray-500 text-sm mb-6">
          This turns on all SMS features: missed-call auto-replies, booking confirmations, reminders, and review requests. Clients who scan your sticker will go to your VIP sign-up page.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded-lg">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full bg-[var(--accent-color)] text-black font-semibold py-3 rounded-lg hover:brightness-90 transition disabled:opacity-50"
        >
          {claiming ? "Activating..." : "Activate"}
        </button>
      </div>
    </div>
  );
}
