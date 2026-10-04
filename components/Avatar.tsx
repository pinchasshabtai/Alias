import { cn } from '@/lib/utils';

const BG = ['bg-sun', 'bg-sky/30', 'bg-mint/30', 'bg-bubble/25', 'bg-grape/25', 'bg-tangerine/30'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SIZES = { sm: 'h-8 w-8 text-lg', md: 'h-11 w-11 text-2xl', lg: 'h-16 w-16 text-4xl', xl: 'h-24 w-24 text-6xl' } as const;

interface Props {
  emoji?: string | null;
  seed?: string;
  size?: keyof typeof SIZES;
  online?: boolean;
  className?: string;
}

export function Avatar({ emoji, seed = '', size = 'md', online, className }: Props) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink/15',
        BG[hash(seed || emoji || '') % BG.length],
        SIZES[size],
        className,
      )}
      aria-hidden="true"
    >
      {emoji || '🙂'}
      {online !== undefined && (
        <span
          className={cn(
            'absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-white',
            online ? 'bg-mint' : 'bg-ink/30',
          )}
        />
      )}
    </span>
  );
}
