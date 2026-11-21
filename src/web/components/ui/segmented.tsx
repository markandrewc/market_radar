import { useId } from 'react';

/** Small "pick one" control built on real radio buttons (keyboard and screen-reader friendly). */
export function Segmented<T extends string>({ label, value, options, onChange }:
  { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
        {options.map((o) => (
          <label key={o.value} className="relative">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
            <span className="block cursor-pointer rounded px-3 py-1.5 text-sm text-slate-700 peer-checked:bg-brand peer-checked:font-semibold peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-accent">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
