interface Props {
  word: string | null;
  hint?: string;
}

export function WordCard({ word, hint = 'מסבירים בלי להגיד את המילה (או חלק ממנה)' }: Props) {
  return (
    <div
      key={word ?? 'empty'}
      className="animate-pop rounded-[2rem] border-4 border-ink bg-sun px-5 py-9 text-center shadow-chunky sm:py-12"
    >
      <div className="mb-3 text-sm font-bold text-ink/60">{hint}</div>
      <div className="break-words font-display text-5xl leading-tight sm:text-7xl">{word ?? '…'}</div>
    </div>
  );
}
