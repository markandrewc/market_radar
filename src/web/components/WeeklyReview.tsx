import { useState } from 'react';
import { useLanguage } from '@/i18n';

type Copy = readonly [string, string, string, string, string, string];
type TaskId = 'demand' | 'training' | 'access';

const tasks: readonly { id: TaskId; title: Copy; detail: Copy; link: string }[] = [
  {
    id: 'demand', link: '#regions',
    title: ['Stellenmarkt im gewählten Gebiet prüfen', 'Check the job market in the selected area', 'Examiner le marché du travail dans la zone choisie', 'Controlla il mercato del lavoro nella zona scelta', 'Перевірте ринок праці у вибраному регіоні', 'راجع سوق العمل في المنطقة المختارة'],
    detail: ['Prüfe die lokale Stellensuche und das Gebiet, für das die Zahlen gelten.', 'Check the local job search and the area the figures cover.', 'Consultez la recherche locale et vérifiez le périmètre des chiffres.', 'Controlla la ricerca locale e l’area a cui si riferiscono i dati.', 'Перевірте місцевий пошук і територію, для якої наведено цифри.', 'تحقّق من البحث المحلي ومن النطاق الجغرافي للأرقام.'],
  },
  {
    id: 'training', link: '#roles',
    title: ['Ein Kursthema auswählen', 'Choose a course topic', 'Choisir un thème de cours', 'Scegli un tema per il corso', 'Виберіть тему для курсу', 'اختر موضوعاً للدورة'],
    detail: ['Öffne einen Beruf, lies die Aufgabenbeschreibung und prüfe die Belege für die gefragten Kenntnisse.', 'Open a role, read its tasks and check the evidence for the skills in demand.', 'Ouvrez un métier, lisez ses activités et vérifiez les sources sur les compétences demandées.', 'Apri una professione, leggi le attività e verifica le fonti sulle competenze richieste.', 'Відкрийте професію, прочитайте про завдання й перевірте джерела даних про затребувані навички.', 'افتح ملف مهنة واقرأ مهامها وتحقّق من مصادر المهارات المطلوبة.'],
  },
  {
    id: 'access', link: '#policy',
    title: ['Änderungen für die Vermittlung prüfen', 'Check changes that affect placements', 'Vérifier les changements qui touchent les placements', 'Verifica i cambiamenti che incidono sul collocamento', 'Перевірте зміни, які впливають на працевлаштування', 'راجع التغييرات التي تؤثر في التوظيف'],
    detail: ['Sichte die neuen SEM-Meldungen zu Migration, Ausweisen und Arbeitsmarktzugang.', 'Review new SEM notices on migration, residence documents and access to work.', 'Consultez les nouvelles annonces du SEM sur la migration, les titres de séjour et l’accès au travail.', 'Leggi gli aggiornamenti della SEM su migrazione, permessi e accesso al lavoro.', 'Перегляньте новини SEM про міграцію, документи на проживання й доступ до роботи.', 'راجع تحديثات SEM بشأن الهجرة ووثائق الإقامة وإمكانية الوصول إلى العمل.'],
  },
];

function currentMonday() {
  const localDate = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Zurich',
  }).formatToParts();
  const part = (type: string) => Number(localDate.find((item) => item.type === type)?.value);
  const monday = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return monday;
}

function readChecklist(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? tasks.filter((task) => value.includes(task.id)).map((task) => task.id) : [];
  } catch {
    return [];
  }
}

export default function WeeklyReview({ region }: { region: string }) {
  const { t, locale } = useLanguage();
  const monday = currentMonday();
  const key = 'market-radar:weekly-review:' + monday.toISOString().slice(0, 10) + ':' + region;
  const [checklist, setChecklist] = useState(() => ({ key, complete: readChecklist(key) }));
  const complete = checklist.key === key ? checklist.complete : readChecklist(key);
  const label = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(monday);
  const number = new Intl.NumberFormat(locale);
  const done = number.format(complete.length);
  const total = number.format(tasks.length);

  function toggle(id: TaskId, checked: boolean) {
    const next = checked ? [...complete, id] : complete.filter((item) => item !== id);
    setChecklist({ key, complete: next });
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // The checklist remains usable for this visit when browser storage is unavailable.
    }
  }

  return (
    <section id="weekly" aria-labelledby="weekly-title" className="scroll-mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="weekly-title" className="text-lg font-semibold tracking-tight">{t('Wochencheck', 'Weekly review', 'Suivi hebdomadaire', 'Controllo settimanale', 'Щотижневий огляд', 'المراجعة الأسبوعية')}</h2>
        <p className="text-sm text-slate-600">
          {t(`Woche ab ${label}`, `Week of ${label}`, `Semaine du ${label}`, `Settimana del ${label}`, `Тиждень із ${label}`, `الأسبوع من ${label}`)}
          {' · '}<span role="status">{t(`${done} von ${total} geprüft`, `${done} of ${total} reviewed`, `${done} sur ${total} vérifiés`, `${done} di ${total} verificati`, `Перевірено ${done} із ${total}`, `تمت مراجعة ${done} من ${total}`)}</span>
        </p>
      </div>
      <ul className="mt-3 grid gap-3 lg:grid-cols-3">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <a href={task.link} className="font-semibold text-teal-800 underline underline-offset-4">{t(...task.title)}</a>
            <p className="my-1 text-sm text-slate-700">{t(...task.detail)}</p>
            <label className="mt-2 inline-flex min-h-7 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-teal-800" checked={complete.includes(task.id)}
                onChange={(event) => toggle(task.id, event.currentTarget.checked)} />
              <span>{t('Als geprüft markieren', 'Mark reviewed', 'Marquer comme vérifié', 'Segna come verificato', 'Позначити як перевірене', 'حدّد كمُراجَع')}<span className="sr-only"> · {t(...task.title)}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-600">{t('Der Fortschritt bleibt in diesem Browser für das gewählte Gebiet gespeichert.', 'Progress for the selected area is saved in this browser.', 'La progression pour la zone choisie est enregistrée dans ce navigateur.', 'I progressi per la zona scelta sono salvati in questo browser.', 'Поступ для вибраного регіону зберігається в цьому браузері.', 'يُحفَظ التقدّم للمنطقة المختارة في هذا المتصفح.')}</p>
    </section>
  );
}
