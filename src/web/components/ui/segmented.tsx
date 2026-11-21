import { useId } from 'react';

/** Small "pick one" control on a paper track, built on real radio buttons. */
export function Segmented<T extends string>({ label, value, options, onChange }:
  { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex rounded-control border border-line bg-brand-soft/60 p-1">
        {options.map((o) => (
          <label key={o.value} className="relative">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
            <span className="block cursor-pointer rounded-md px-3 py-1.5 text-sm text-ink-soft transition-colors peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-card peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-accent">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
