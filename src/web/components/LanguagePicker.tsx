import { Languages } from 'lucide-react';
import { languages, useLanguage } from '@/i18n';

export default function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage();
  const label = t('Sprache', 'Language', 'Langue', 'Lingua', 'Мова', 'اللغة');

  return (
    <label className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-slate-800">
      <Languages className="size-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      <select
        value={language}
        onChange={(event) => {
          const option = languages.find((item) => item.id === event.currentTarget.value);
          if (option) setLanguage(option.id);
        }}
        className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        {languages.map(({ id, name, locale }) => <option key={id} value={id} lang={locale}>{name}</option>)}
      </select>
    </label>
  );
}
