"use client";

import { useCallback, useEffect, useState } from "react";

export type KnownClient = {
  firstName: string | null;
  phoneLast4: string;
  smsOptedIn: boolean;
  stampCount: number | null;
  lastServiceId: string | null;
};

/**
 * checking   → looking up a saved or URL token
 * recognized → returning client; book with the token, no phone needed
 * anonymous  → first visit, shared device after "Not you?", or token expired
 */
export type ClientSession =
  | { status: "checking" }
  | { status: "anonymous" }
  | { status: "recognized"; token: string; client: KnownClient; greeting: string };

const storageKey = (barberId: string) => `linecatch:session:${barberId}`;

// Storage can throw (private mode, blocked site data); recognition is a nicety, never a blocker.
function readToken(barberId: string): string | null {
  try {
    return localStorage.getItem(storageKey(barberId));
  } catch {
    return null;
  }
}

export function saveToken(barberId: string, token: string) {
  try {
    localStorage.setItem(storageKey(barberId), token);
  } catch {}
}

function clearToken(barberId: string) {
  try {
    localStorage.removeItem(storageKey(barberId));
  } catch {}
}

export function useClientSession(barberId: string, linkToken: string | null) {
  const [session, setSession] = useState<ClientSession>({ status: "checking" });
  // Read once: stripping ?t= below updates useSearchParams, which must not restart the lookup.
  const [urlToken] = useState(linkToken);

  useEffect(() => {
    // Strip ?t= so the token isn't left in history, bookmarks, or a shared screenshot.
    if (urlToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete("t");
      window.history.replaceState(null, "", url.toString());
    }

    // Try the link first, then a saved session — a stale link shouldn't wipe a good one.
    const stored = readToken(barberId);
    const candidates = [...new Set([urlToken, stored].filter((t): t is string => !!t))];
    let cancelled = false;

    (async () => {
      for (const token of candidates) {
        const data = await fetch("/api/client-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barberId, token }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (cancelled) return;
        if (data?.recognized) {
          // A missed-call link comes back exchanged for a long-lived session token.
          const keep: string = data.sessionToken || token;
          saveToken(barberId, keep);
          setSession({ status: "recognized", token: keep, client: data.client, greeting: data.uiGreeting });
          return;
        }
      }
      if (stored) clearToken(barberId);
      setSession({ status: "anonymous" });
    })();

    return () => {
      cancelled = true;
    };
  }, [barberId, urlToken]);

  const forget = useCallback(() => {
    const token = readToken(barberId);
    clearToken(barberId);
    setSession({ status: "anonymous" });
    if (token) {
      fetch("/api/client-session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberId, token }),
      }).catch(() => {});
    }
  }, [barberId]);

  return { session, forget };
}
