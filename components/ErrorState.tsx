import type { ReactNode } from 'react';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export function ErrorState({ title = 'משהו השתבש', message, onRetry, action }: Props) {
  return (
    <div className="card mx-auto my-10 max-w-md text-center">
      <div className="mb-2 text-5xl">😵</div>
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-2 text-ink/70">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button type="button" className="btn-sun" onClick={onRetry}>
            ניסיון נוסף
          </button>
        )}
        {action}
      </div>
    </div>
  );
}
