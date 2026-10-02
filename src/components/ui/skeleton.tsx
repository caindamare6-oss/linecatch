const bar = "animate-pulse rounded-md bg-white/[0.06]";

/** Grey page-shaped placeholder shown while content loads. */
export function PageSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto space-y-3" aria-busy="true" aria-label="Loading">
      <div className={`${bar} h-6 w-1/3`} />
      <div className={`${bar} h-4 w-2/3`} />
      <div className={`${bar} h-20 mt-4`} />
      <div className={`${bar} h-20`} />
      <div className={`${bar} h-20`} />
    </div>
  );
}
