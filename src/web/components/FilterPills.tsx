import { cn } from '@/lib/utils';

/**
 * "Pick one" tabs on paper. The pressed state is announced, the active tab keeps ink
 * text with a 2 px crimson underline (the label stays legible for every choice), and
 * the row scrolls sideways on small screens instead of overflowing the page.
 */
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
    <div role="group" aria-label={label} className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-control px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
              selected ? 'text-ink' : 'text-ink-soft hover:bg-brand-soft/70 hover:text-ink',
            )}
          >
            {option.label}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors',
                selected ? 'bg-brand-accent' : 'bg-transparent',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
