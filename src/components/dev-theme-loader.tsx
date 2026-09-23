"use client";

import { lazy, Suspense } from "react";

const DevThemeEditor = lazy(() => import("./dev-theme-editor"));

export function DevThemeEditorLoader() {
  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") return null;
  return (
    <Suspense fallback={null}>
      <DevThemeEditor />
    </Suspense>
  );
}
