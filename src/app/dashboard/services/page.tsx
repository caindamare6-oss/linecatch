"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, GripVertical, Trash2 } from "lucide-react";

type Service = {
  id: string;
  name: string;
  price: string;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
};

const PRESETS = [
  { name: "Lineup", duration: 20 },
  { name: "Taper", duration: 30 },
  { name: "Lineup & Taper", duration: 45 },
  { name: "Beard Trim", duration: 15 },
  { name: "Kids Cut", duration: 25 },
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [userId, setUserId] = useState("");
  const [hasServices, setHasServices] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (data && data.length > 0) {
      setServices(
        data.map((s) => ({ ...s, price: String(s.price) }))
      );
      setHasServices(true);
    }
    setLoading(false);
  }

  async function seedPresets() {
    setSaving(true);
    const supabase = createClient();

    const inserts = PRESETS.map((p, i) => ({
      user_id: userId,
      name: p.name,
      price: 0,
      duration_minutes: p.duration,
      is_active: true,
      sort_order: i,
    }));

    const { data } = await supabase
      .from("services")
      .insert(inserts)
      .select("*");

    if (data) {
      setServices(data.map((s) => ({ ...s, price: String(s.price) })));
      setHasServices(true);
    }
    setSaving(false);
  }

  async function updateService(id: string, field: string, value: string | boolean | number) {
    const supabase = createClient();

    const updateData: Record<string, unknown> = {};
    if (field === "price") {
      updateData.price = parseFloat(value as string) || 0;
    } else {
      updateData[field] = value;
    }

    await supabase.from("services").update(updateData).eq("id", id);

    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  async function addService() {
    if (!newName.trim()) return;
    setSaving(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("services")
      .insert({
        user_id: userId,
        name: newName.trim(),
        price: parseFloat(newPrice) || 0,
        duration_minutes: parseInt(newDuration) || 30,
        is_active: true,
        sort_order: services.length,
      })
      .select("*")
      .single();

    if (data) {
      setServices((prev) => [...prev, { ...data, price: String(data.price) }]);
    }
    setNewName("");
    setNewPrice("");
    setNewDuration("30");
    setShowAdd(false);
    setSaving(false);
  }

  async function deleteService(id: string) {
    const supabase = createClient();
    await supabase.from("services").delete().eq("id", id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 30%, transparent)', borderTopColor: 'var(--accent-color)' }} />
      </div>
    );
  }

  if (!hasServices) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-white/80 mb-2">
          Set up your services
        </h3>
        <p className="text-sm text-white/30 mb-6 max-w-xs mx-auto">
          Start with preset services and set your own prices, or add custom ones.
        </p>
        <button
          onClick={seedPresets}
          disabled={saving}
          className="bg-[var(--accent-color)] text-[#0d0d0d] font-semibold px-6 py-3 rounded-xl hover:brightness-90 disabled:opacity-50 transition text-sm"
        >
          {saving ? "Setting up..." : "Load preset services"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium">
          Your services
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-xs text-[var(--accent-color)] hover:brightness-90 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-white/[0.04] border rounded-2xl p-4 space-y-3" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 20%, transparent)' }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Service name"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)]"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-white/25 block mb-1">Price ($)</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)]"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-white/25 block mb-1">Duration (min)</label>
              <input
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="30"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addService}
              disabled={!newName.trim() || saving}
              className="flex-1 bg-[var(--accent-color)] text-[#0d0d0d] font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 transition"
            >
              {saving ? "Adding..." : "Add Service"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2.5 rounded-xl text-sm text-white/30 border border-white/[0.06] hover:bg-white/[0.04]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {services.map((service) => (
        <div
          key={service.id}
          className={`bg-white/[0.04] border rounded-2xl p-4 transition ${
            service.is_active ? "border-white/[0.06]" : "border-white/[0.03] opacity-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <GripVertical className="w-4 h-4 text-white/10 mt-1 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={service.name}
                  onChange={(e) =>
                    updateService(service.id, "name", e.target.value)
                  }
                  className="bg-transparent text-white/80 text-sm font-medium focus:outline-none border-b border-transparent focus:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)] w-full mr-2"
                />
                <button
                  onClick={() => deleteService(service.id)}
                  className="text-white/10 hover:text-red-400 transition shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-white/20 text-xs">$</span>
                  <input
                    type="number"
                    value={service.price}
                    onChange={(e) =>
                      updateService(service.id, "price", e.target.value)
                    }
                    className="w-16 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)]"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={service.duration_minutes}
                    onChange={(e) =>
                      updateService(
                        service.id,
                        "duration_minutes",
                        parseInt(e.target.value) || 30
                      )
                    }
                    className="w-14 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)]"
                  />
                  <span className="text-white/20 text-xs">min</span>
                </div>
                <button
                  onClick={() =>
                    updateService(service.id, "is_active", !service.is_active)
                  }
                  className={`ml-auto text-[10px] font-medium px-2.5 py-1 rounded-full transition ${
                    service.is_active
                      ? "text-[var(--accent-color)]"
                      : "bg-white/[0.04] text-white/20"
                  }`}
                  style={service.is_active ? { backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)' } : undefined}
                >
                  {service.is_active ? "Active" : "Off"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <p className="text-[11px] text-white/15 text-center pt-2">
        Set prices to $0 to hide the price on the booking page. Toggle services
        off to temporarily remove them.
      </p>
    </div>
  );
}
