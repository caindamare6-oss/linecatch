"use client";

import { useState, useEffect } from "react";

type StickerCode = {
  code: string;
  owner_user_id: string | null;
  status: string;
  claimed_at: string | null;
  created_at: string;
  batch_label: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
};

export default function AdminStickersPage() {
  const [codes, setCodes] = useState<StickerCode[]>([]);
  const [barbers, setBarbers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Generate form
  const [genCount, setGenCount] = useState("10");
  const [genLabel, setGenLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState("");

  // Assign & Ship form
  const [shipCode, setShipCode] = useState("");
  const [shipBarber, setShipBarber] = useState("");
  const [shipTracking, setShipTracking] = useState("");
  const [shipping, setShipping] = useState(false);
  const [shipResult, setShipResult] = useState("");

  // Filter
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    loadCodes();
  }, [statusFilter]);

  async function loadCodes() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/stickers?${params}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Forbidden");
      }
      const data = await res.json();
      setCodes(data.codes);
      setBarbers(data.barbers);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

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
      if (!res.ok) throw new Error(data.error);

      // Download CSV
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stickers-${genLabel || "batch"}-${data.codes.length}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setGenResult(`Generated ${data.codes.length} codes. CSV downloaded.`);
      setGenLabel("");
      loadCodes();
    } catch (err: unknown) {
      setGenResult(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAssignAndShip() {
    setShipping(true);
    setShipResult("");
    try {
      const res = await fetch("/api/admin/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_and_ship",
          code: shipCode.trim().toUpperCase(),
          ownerUserId: shipBarber.trim(),
          trackingNumber: shipTracking.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShipResult("Assigned and shipped!");
      setShipCode("");
      setShipBarber("");
      setShipTracking("");
      loadCodes();
    } catch (err: unknown) {
      setShipResult(err instanceof Error ? err.message : "Failed");
    } finally {
      setShipping(false);
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
      if (!res.ok) throw new Error(data.error);
      loadCodes();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  }

  if (error === "Forbidden") {
    return (
      <div className="text-center py-16 text-white/40">
        <p>Access denied.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <h2 className="text-lg font-bold text-white">Sticker Admin</h2>

      {/* Generate Batch */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-3">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium">
          Generate batch
        </h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={genCount}
            onChange={(e) => setGenCount(e.target.value)}
            min={1}
            max={500}
            className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-[var(--accent-color)]"
          />
          <input
            type="text"
            value={genLabel}
            onChange={(e) => setGenLabel(e.target.value)}
            placeholder="Batch label (e.g. sept-2026)"
            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--accent-color)]"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !genLabel.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--accent-color)] text-[#0d0d0d] hover:brightness-90 disabled:opacity-30 transition-all"
          >
            {generating ? "..." : "Generate"}
          </button>
        </div>
        {genResult && (
          <p className="text-xs text-[var(--accent-color)]">{genResult}</p>
        )}
      </div>

      {/* Assign & Ship */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-3">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium">
          Assign &amp; ship
        </h3>
        <div className="grid grid-cols-1 gap-2">
          <input
            type="text"
            value={shipCode}
            onChange={(e) => setShipCode(e.target.value.toUpperCase())}
            placeholder="Sticker code"
            className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--accent-color)] font-mono"
          />
          <input
            type="text"
            value={shipBarber}
            onChange={(e) => setShipBarber(e.target.value)}
            placeholder="Barber user ID (UUID)"
            className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--accent-color)] font-mono"
          />
          <input
            type="text"
            value={shipTracking}
            onChange={(e) => setShipTracking(e.target.value)}
            placeholder="USPS tracking number (optional)"
            className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--accent-color)]"
          />
          <button
            onClick={handleAssignAndShip}
            disabled={shipping || !shipCode.trim() || !shipBarber.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--accent-color)] text-[#0d0d0d] hover:brightness-90 disabled:opacity-30 transition-all"
          >
            {shipping ? "..." : "Assign & Ship"}
          </button>
        </div>
        {shipResult && (
          <p className={`text-xs ${shipResult.includes("!") ? "text-[var(--accent-color)]" : "text-red-400"}`}>
            {shipResult}
          </p>
        )}
      </div>

      {/* Codes Table */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium">
            All codes ({codes.length})
          </h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white/60 focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="unclaimed">Unclaimed</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 30%, transparent)', borderTopColor: 'var(--accent-color)' }} />
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {codes.map((c) => (
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
                  {c.status}
                </span>
                <span className="text-xs text-white/30 truncate flex-1">
                  {c.owner_user_id
                    ? barbers[c.owner_user_id] || c.owner_user_id.slice(0, 8)
                    : "—"}
                </span>
                {c.tracking_number && (
                  <span className="text-[10px] text-white/20 truncate max-w-[80px]">
                    {c.tracking_number}
                  </span>
                )}
                <span className="text-[10px] text-white/15 shrink-0">
                  {c.batch_label || ""}
                </span>
                <div className="flex gap-1 shrink-0">
                  {c.status === "active" && (
                    <button
                      onClick={() => handleAction(c.code, "reassign")}
                      className="text-[10px] text-white/30 hover:text-white/60 px-1.5 py-0.5 rounded bg-white/[0.03] hover:bg-white/[0.06]"
                    >
                      Clear
                    </button>
                  )}
                  {c.status !== "retired" && (
                    <button
                      onClick={() => handleAction(c.code, "retire")}
                      className="text-[10px] text-red-400/50 hover:text-red-400 px-1.5 py-0.5 rounded bg-white/[0.03] hover:bg-red-400/10"
                    >
                      Retire
                    </button>
                  )}
                </div>
              </div>
            ))}
            {codes.length === 0 && (
              <p className="text-center text-xs text-white/20 py-4">No codes found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
