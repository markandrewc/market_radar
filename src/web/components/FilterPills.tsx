import { cn } from '@/lib/utils';

/** "Pick one" chips as real buttons: pressed state is announced, and the row scrolls sideways on small screens. */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex max-w-full items-center gap-2 overflow-x-auto px-1 pb-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
              selected
                ? 'border-brand bg-brand text-white'
                : 'border-slate-300 bg-white text-brand hover:bg-slate-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
