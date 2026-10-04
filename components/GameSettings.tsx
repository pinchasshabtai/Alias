'use client';

import { useCategories } from '@/hooks/useCategories';
import { DIFFICULTY_LABELS, type SettingsValues } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FieldsProps {
  values: SettingsValues;
  onChange: (patch: Partial<SettingsValues>) => void;
  disabled?: boolean;
}

function Chips({
  options,
  value,
  onPick,
  render,
  disabled,
  label,
}: {
  options: readonly number[];
  value: number;
  onPick: (v: number) => void;
  render: (v: number) => string;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          disabled={disabled}
          onClick={() => onPick(o)}
          className={cn('chip', o === value && 'chip-on', disabled && 'opacity-60')}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function SettingsFields({ values, onChange, disabled }: FieldsProps) {
  const { categories, loading } = useCategories();

  const toggleCategory = (id: number) => {
    const has = values.categoryIds.includes(id);
    onChange({ categoryIds: has ? values.categoryIds.filter((c) => c !== id) : [...values.categoryIds, id] });
  };

  return (
    <div className="space-y-5">
      <div>
        <span className="label">מספר קבוצות</span>
        <Chips label="מספר קבוצות" options={[2, 3, 4] as const} value={values.numTeams} disabled={disabled} onPick={(v) => onChange({ numTeams: v })} render={(v) => `${v} קבוצות`} />
      </div>
      <div>
        <span className="label">מקסימום שחקנים</span>
        <Chips label="מקסימום שחקנים" options={[4, 6, 8, 12, 16, 24] as const} value={values.maxPlayers} disabled={disabled} onPick={(v) => onChange({ maxPlayers: v })} render={(v) => String(v)} />
      </div>
      <div>
        <span className="label">זמן לתור</span>
        <Chips label="זמן לתור" options={[30, 60, 90] as const} value={values.turnSeconds} disabled={disabled} onPick={(v) => onChange({ turnSeconds: v })} render={(v) => `${v} שניות`} />
      </div>
      <div>
        <span className="label">נקודות לניצחון</span>
        <Chips label="נקודות לניצחון" options={[10, 20, 30, 50] as const} value={values.winPoints} disabled={disabled} onPick={(v) => onChange({ winPoints: v })} render={(v) => String(v)} />
      </div>
      <div>
        <span className="label">רמת קושי</span>
        <Chips label="רמת קושי" options={[0, 1, 2, 3] as const} value={values.difficulty} disabled={disabled} onPick={(v) => onChange({ difficulty: v })} render={(v) => DIFFICULTY_LABELS[v]} />
      </div>
      <div>
        <span className="label">קטגוריות {values.categoryIds.length === 0 && <span className="font-normal">(לא נבחרו = כולן)</span>}</span>
        {loading ? (
          <p className="text-sm text-ink/50">טוענים קטגוריות…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={disabled}
                aria-pressed={values.categoryIds.includes(c.id)}
                onClick={() => toggleCategory(c.id)}
                className={cn('chip', values.categoryIds.includes(c.id) && 'chip-on', disabled && 'opacity-60')}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Host sees editable settings + save; everyone else sees a read-only summary. */
interface GameSettingsProps {
  values: SettingsValues;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  onChange: (patch: Partial<SettingsValues>) => void;
  onSave: () => void;
}

export function GameSettings({ values, editable, dirty, saving, onChange, onSave }: GameSettingsProps) {
  const { categories } = useCategories();

  if (!editable) {
    const cats = values.categoryIds.length
      ? categories.filter((c) => values.categoryIds.includes(c.id)).map((c) => `${c.emoji} ${c.name}`).join('، ')
      : 'כל הקטגוריות';
    return (
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-cream p-3"><dt className="text-ink/60">קבוצות</dt><dd className="text-lg font-bold">{values.numTeams}</dd></div>
        <div className="rounded-2xl bg-cream p-3"><dt className="text-ink/60">זמן לתור</dt><dd className="text-lg font-bold">{values.turnSeconds} שניות</dd></div>
        <div className="rounded-2xl bg-cream p-3"><dt className="text-ink/60">נקודות לניצחון</dt><dd className="text-lg font-bold">{values.winPoints}</dd></div>
        <div className="rounded-2xl bg-cream p-3"><dt className="text-ink/60">קושי</dt><dd className="text-lg font-bold">{DIFFICULTY_LABELS[values.difficulty]}</dd></div>
        <div className="col-span-2 rounded-2xl bg-cream p-3"><dt className="text-ink/60">קטגוריות</dt><dd className="font-bold">{cats}</dd></div>
      </dl>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsFields values={values} onChange={onChange} disabled={saving} />
      <button type="button" className="btn-sky w-full" disabled={!dirty || saving} onClick={onSave}>
        {saving ? 'שומרים…' : 'שמירת הגדרות'}
      </button>
    </div>
  );
}
