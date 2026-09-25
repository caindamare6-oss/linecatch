"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function ClaimSticker({ code }: { code: string }) {
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
        throw new Error(data.error || "Failed to claim");
      }

      setClaimed(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setClaiming(false);
    }
  }

  if (claimed) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a] text-center">
          <CheckCircle2 className="w-16 h-16 text-[var(--accent-color)] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Sticker Claimed!</h2>
          <p className="text-gray-400 mb-2">
            Code <span className="font-mono text-white">{code}</span> is now linked to your account.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Clients who scan this sticker will be sent to your VIP sign-up page.
          </p>
          <a
            href="/dashboard/settings"
            className="inline-block bg-[var(--accent-color)] text-black font-semibold px-6 py-3 rounded-lg hover:brightness-90 transition"
          >
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a] text-center">
        <div className="text-3xl font-bold mb-4 text-white">
          Line<span className="text-[var(--accent-color)]">Catch</span>
        </div>
        <p className="text-white text-lg mb-2">Claim this sticker?</p>
        <p className="text-gray-400 mb-6">
          Link code <span className="font-mono text-white text-lg">{code}</span> to
          your account. Clients who scan it will go to your VIP sign-up page.
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
          {claiming ? "Claiming..." : "Yes, Claim This Sticker"}
        </button>
      </div>
    </div>
  );
}
