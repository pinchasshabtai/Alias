export function LoadingState({ label = 'טוענים…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16" role="status" aria-live="polite">
      <div className="flex gap-2">
        {['bg-tomato', 'bg-sun', 'bg-sky', 'bg-mint'].map((c, i) => (
          <span key={c} className={`h-4 w-4 animate-pulseFast rounded-full ${c}`} style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <p className="font-bold text-ink/70">{label}</p>
    </div>
  );
}
