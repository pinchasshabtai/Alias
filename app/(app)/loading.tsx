export default function Loading() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-4 py-16" role="status" aria-live="polite">
      <span className="h-9 w-9 animate-spin rounded-full border-4 border-sky border-t-transparent" aria-hidden="true" />
      <p className="font-bold text-ink/70">טוענים את העמוד...</p>
    </div>
  );
}