import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MarketSources from '@/components/MarketSources';
import MarketWalkthrough from '@/components/MarketWalkthrough';
import MigrationWatch from '@/components/MigrationWatch';
import RegionalMarket, { type RegionId } from '@/components/RegionalMarket';
import WeeklyReview from '@/components/WeeklyReview';
import { radar, skillsByRole } from '@/data/market-radar';
import { regionOptions } from '@/data/regional-market';
import { courseCopy, practiceCopy, roleCopy, skillCopy } from '@/data/home-copy';
import { useLanguage } from '@/i18n';

const periods = [...radar.totals].sort((a, b) => a.month.localeCompare(b.month));
const [previous, latest] = periods.slice(-2);
const junior = radar.junior.find((row) => row.month === latest.month);
const totalsByMonth = new Map(periods.map((row) => [row.month, row]));
const latestMonth = new Date(latest.month + '-01T00:00:00Z');
const historyMonths = Array.from({ length: 11 }, (_, index) =>
  new Date(Date.UTC(latestMonth.getUTCFullYear(), latestMonth.getUTCMonth() - 10 + index, 1)).toISOString().slice(0, 7));
const monthDate = (month: string) => new Date(month + '-01T00:00:00Z');
const sourceClass = 'font-medium text-teal-800 underline underline-offset-4 hover:text-teal-950';

function startingRegion(): RegionId {
  try {
    const saved = localStorage.getItem('market-radar:region');
    return regionOptions.find((option) => option.id === saved)?.id ?? 'switzerland';
  } catch {
    return 'switzerland';
  }
}

const trendSkills = [
  { id: 'python', label: 'Python' },
  { id: 'security', label: 'IT-Sicherheit' },
  { id: 'docker', label: 'Docker' },
];

const exploredRoles = [
  ...radar.roles,
  { id: 'people-analytics', label: 'Datenanalyse im Personalwesen' },
];

function ReportLink({ url, className = sourceClass }: { url?: string | null; className?: string }) {
  const { t } = useLanguage();
  return (
    <a className={className} href={url ?? radar.source.url} target="_blank" rel="noopener noreferrer">
      {url ? t('ITBoard-Monatsbericht', 'ITBoard monthly report', 'Rapport mensuel ITBoard', 'Rapporto mensile ITBoard', 'Місячний звіт ITBoard', 'تقرير ITBoard الشهري') : 'ITBoard CSV'}
    </a>
  );
}

export default function Home() {
  const { locale, t } = useLanguage();
  const [roleId, setRoleId] = useState(radar.roles[0].id);
  const [region, setRegion] = useState<RegionId>(startingRegion);
  const role = exploredRoles.find((item) => item.id === roleId) ?? exploredRoles[0];
  const name = (item: typeof role) => roleCopy[item.id] ? t(...roleCopy[item.id].label) : item.label;
  const description = roleCopy[role.id];
  const skills = skillsByRole[role.id];
  const practice = practiceCopy[role.id];
  const course = courseCopy[role.id];
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const signed = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const monthFormat = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shortFormat = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const dateFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const formatMonth = (month: string) => monthFormat.format(monthDate(month));
  const formatDate = (date: string) => dateFormat.format(new Date(date.slice(0, 10) + 'T00:00:00Z'));
  const count = (value: number | null | undefined) => value == null ? '—' : number.format(value);
  const outOf = (value: number | null | undefined, base: number | null | undefined) =>
    count(value) + ' ' + t('von', 'of', 'sur', 'su', 'з', 'من') + ' ' + count(base);
  const listings = t('Inserate', 'listings', 'annonces', 'annunci', 'оголошення', 'إعلانات');
  const sample = t('ITBoard-Stichprobe Schweiz', 'Swiss ITBoard sample', 'Échantillon suisse ITBoard', 'Campione svizzero ITBoard', 'Швейцарська вибірка ITBoard', 'عيّنة ITBoard في سويسرا');
  const exercise = t('Übungsvorschlag', 'Practice exercise', 'Exercice pratique', 'Esercizio pratico', 'Практична вправа', 'تمرين عملي');
  const roleRows = radar.rows.filter((row) => row.role_id === role.id);
  const roleByMonth = new Map(roleRows.map((row) => [row.month, row]));
  const current = roleByMonth.get(latest.month);
  const chart = historyMonths.map((month) => ({
    month,
    period: shortFormat.format(monthDate(month)),
    value: roleByMonth.get(month)?.value ?? null,
  }));
  function changeRegion(value: RegionId) {
    setRegion(value);
    try {
      localStorage.setItem('market-radar:region',value);
    } catch {
      // The selection is available for the current visit.
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-slate-900 px-5 py-7 text-white sm:px-8" aria-labelledby="overview-title">
        <h1 id="overview-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('Market Radar für Powercoders', 'Market Radar for Powercoders', 'Market Radar pour Powercoders', 'Market Radar per Powercoders', 'Market Radar для Powercoders', 'Market Radar لـ Powercoders')}</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          {t('Vergleiche den Schweizer IT-Stellenmarkt, sieh nach, welche Kenntnisse gefragt sind, und wähle ein Praxisthema für den nächsten Kurs.',
            'Compare the Swiss IT job market, see which skills are in demand and choose a practical topic for the next course.',
            'Compare le marché suisse de l’emploi informatique, repère les compétences demandées et choisis un sujet pratique pour le prochain cours.',
            'Confronta il mercato del lavoro informatico svizzero, scopri le competenze richieste e scegli un argomento pratico per il prossimo corso.',
            'Порівняй показники ринку ІТ-праці Швейцарії, дізнайся, які навички потрібні, й обери практичну тему для наступного курсу.',
            'قارن سوق وظائف تقنية المعلومات في سويسرا، وتعرّف على المهارات المطلوبة واختر موضوعاً عملياً للدورة القادمة.')}
        </p>
      </section>

      <MarketWalkthrough />

      <MarketSources
        latestReportUrl={latest.cutoff_source_url}
        latestMonthLabel={formatMonth(latest.month)}
        cutoffLabel={latest.data_cutoff ? formatDate(latest.data_cutoff) : null}
        csvCheckedLabel={radar.fetched_at ? formatDate(radar.fetched_at) : null}
        skillProfileUrl={skills?.source ?? null}
        skillRoleLabel={name(role)}
        skillReadLabel={skills ? formatDate(skills.read_on) : null}
      />

      <WeeklyReview region={region} />

      <section className="grid gap-4 sm:grid-cols-3" aria-label={t('ITBoard-Monatsstichproben', 'ITBoard monthly samples', 'Échantillons mensuels ITBoard', 'Campioni mensili ITBoard', 'Місячні вибірки ITBoard', 'عيّنات ITBoard الشهرية')}>
        {[previous, latest].map((row) => (
          <Card key={row.month}>
            <CardHeader>
              <CardTitle>{formatMonth(row.month)}</CardTitle>
              <CardDescription>{sample}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-semibold tabular-nums">{count(row.value)}</p>
              <p className="text-sm text-slate-600">{t('Gezählte Inserate', 'Listings counted', 'Annonces comptées', 'Annunci conteggiati', 'Підраховані оголошення', 'الإعلانات المحتسبة')} · {row.data_cutoff ? formatDate(row.data_cutoff) : t('Stichtag offen', 'Cut-off unknown', 'Date de référence inconnue', 'Data di riferimento sconosciuta', 'Дата зрізу невідома', 'تاريخ الرصد غير معروف')}</p>
              <ReportLink url={row.cutoff_source_url} />
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>{t('Offen für Berufseinsteigende', 'Open to entry-level applicants', 'Ouvert aux profils débutants', 'Aperti a chi è all’inizio della carriera', 'Відкриті для початківців', 'متاحة للمتقدمين في بداية مسيرتهم')}</CardTitle>
            <CardDescription>{formatMonth(latest.month)} · {sample}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-3xl font-semibold tabular-nums">{junior?.base && junior.base > 0 ? percent.format(junior.value / junior.base) : '—'}</p>
            <p className="text-sm text-slate-600">
              {junior ? outOf(junior.value, junior.base) + ' ' + t('Inseraten', 'listings', 'annonces', 'annunci', 'оголошень', 'إعلاناً') : t('Keine Angabe zur Anzahl', 'Count unavailable', 'Nombre indisponible', 'Conteggio non disponibile', 'Кількість недоступна', 'العدد غير متاح')}
              {junior?.data_cutoff && ' · ' + formatDate(junior.data_cutoff)}
            </p>
            <ReportLink url={junior?.cutoff_source_url} />
          </CardContent>
        </Card>
      </section>

      <RegionalMarket region={region} onRegionChange={changeRegion} />

      <section id="roles" aria-labelledby="roles-heading" className="scroll-mt-5 space-y-3">
        <h2 id="roles-heading" className="text-xl font-semibold tracking-tight">{t('Berufe entdecken', 'Explore roles', 'Découvrir les métiers', 'Esplora le professioni', 'Ознайомся з професіями', 'استكشف المهن')}</h2>
        <div role="group" aria-labelledby="roles-heading" className="flex flex-wrap gap-2">
          {exploredRoles.map((item) => (
            <button key={item.id} type="button" aria-pressed={role.id === item.id} onClick={() => setRoleId(item.id)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 aria-pressed:border-teal-800 aria-pressed:bg-teal-800 aria-pressed:text-white">
              {name(item)}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4" aria-live="polite">
          <p className="text-sm font-semibold text-teal-950">{t('Was macht man in diesem Beruf?', 'What do people do in this role?', 'En quoi consiste ce métier ?', 'In che cosa consiste questa professione?', 'Що роблять у цій професії?', 'ما طبيعة العمل في هذه المهنة؟')}</p>
          {description && <p className="mt-1 text-sm">{t(...description.job)}</p>}
          {description && <p className="mt-1 text-sm text-slate-700">{t(...description.example)}</p>}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle><span aria-live="polite">{name(role)} · {t('Nachfrage pro Monat', 'Monthly demand', 'Demande mensuelle', 'Domanda mensile', 'Щомісячний попит', 'الطلب الشهري')}</span></CardTitle>
              <CardDescription>
                {current ? outOf(current.value, current.base) + ' · ' + sample + ' · ' + formatMonth(current.month)
                  : roleRows.length ? formatMonth(latest.month) + ' · ' + t('Kein veröffentlichter Wert für diese Rolle', 'No published figure for this role', 'Aucun chiffre publié pour ce métier', 'Nessun dato pubblicato per questa professione', 'Для цієї професії показник не опубліковано', 'لا تتوفر بيانات منشورة لهذه المهنة')
                    : t('In den verwendeten ITBoard-Daten fehlt eine separate Stellenzahl für diese Rolle.', 'The ITBoard data used here provides no separate count for this role.', 'Les données ITBoard utilisées ici ne fournissent pas de nombre distinct pour ce métier.', 'I dati ITBoard utilizzati non indicano un conteggio separato per questa professione.', 'У використаних даних ITBoard немає окремої кількості вакансій для цієї професії.', 'لا تتضمن بيانات ITBoard المستخدمة هنا عدداً منفصلاً لهذه المهنة.')}
              </CardDescription>
            </CardHeader>
            {roleRows.length > 0 ? (
            <CardContent className="space-y-4">
              <div className="h-56 min-w-0" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 10, left: 0, bottom: 1 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} minTickGap={8} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'auto']} fontSize={11} width={32} tickFormatter={count} />
                    <Tooltip formatter={(value) => typeof value === 'number' ? count(value) : ''} labelFormatter={(_, payload) => payload[0]?.payload?.month ? formatMonth(payload[0].payload.month) : ''} />
                    <Line type="linear" dataKey="value" name={listings} stroke="#0f766e" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-slate-600">{t('Eine Lücke steht für einen von ITBoard nicht veröffentlichten Monatswert.', 'A gap means ITBoard published no value for that month.', 'Un espace indique qu’ITBoard n’a pas publié de valeur pour ce mois.', 'Un vuoto indica che ITBoard non ha pubblicato un valore per il mese.', 'Пропуск означає, що ITBoard не опублікував дані за цей місяць.', 'تشير الفجوة إلى شهر لم ينشر ITBoard قيمة له.')}</p>
              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-teal-800">{t('Monatszahlen und Quellen ansehen', 'See monthly figures and sources', 'Voir les chiffres mensuels et les sources', 'Vedi i dati mensili e le fonti', 'Переглянути місячні показники й джерела', 'عرض الأرقام الشهرية والمصادر')}</summary>
                <Table className="mt-2">
                  <TableHeader><TableRow>
                    <TableHead>{t('Monat', 'Month', 'Mois', 'Mese', 'Місяць', 'الشهر')}</TableHead>
                    <TableHead>{t('Rolle / Stichprobe', 'Role / sample', 'Métier / échantillon', 'Professione / campione', 'Професія / вибірка', 'المهنة / العيّنة')}</TableHead>
                    <TableHead>{t('Stichtag und Quelle', 'Cut-off and source', 'Date de référence et source', 'Data di riferimento e fonte', 'Дата зрізу й джерело', 'تاريخ الرصد والمصدر')}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {historyMonths.map((month) => {
                      const row = roleByMonth.get(month);
                      const evidence = row ?? totalsByMonth.get(month);
                      return (
                        <TableRow key={month}>
                          <TableCell className="whitespace-normal">{formatMonth(month)}</TableCell>
                          <TableCell className="whitespace-normal">{count(row?.value)} / {count(row?.base ?? evidence?.value)}</TableCell>
                          <TableCell className="whitespace-normal">
                            <a href={evidence?.cutoff_source_url ?? radar.source.url} target="_blank" rel="noopener noreferrer" className={sourceClass}>
                              {evidence?.data_cutoff ? formatDate(evidence.data_cutoff) : 'ITBoard CSV'}
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </details>
            </CardContent>
            ) : <CardContent className="text-sm text-slate-700">{t('Nutze das Berufsbeispiel und prüfe regionale Möglichkeiten bei Arbeitgebern oder über die öffentliche Stellensuche.',
              'Use the role example and look for nearby opportunities through employers or the public job search.',
              'Utilise l’exemple de métier et cherche des possibilités dans ta région auprès des employeurs ou sur le portail public.',
              'Usa l’esempio della professione e cerca opportunità locali presso i datori di lavoro o sul portale pubblico.',
              'Скористайся прикладом професії та шукай можливості у своєму регіоні в роботодавців або через державний портал.',
              'استخدم مثال المهنة وابحث عن الفرص في منطقتك لدى أصحاب العمل أو عبر البوابة العامة للوظائف.')}</CardContent>}
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>{skills ? t('In Inseraten genannte Kenntnisse', 'Skills mentioned in listings', 'Compétences mentionnées dans les annonces', 'Competenze indicate negli annunci', 'Навички у вакансіях', 'المهارات المذكورة في الإعلانات')
                : t('Kenntnisse zum Einstieg', 'Skills to get started', 'Compétences pour débuter', 'Competenze per iniziare', 'Початкові навички', 'مهارات للبدء')}</CardTitle>
              <CardDescription>
                {skills ? count(skills.base) + ' ' + listings + ' · ' + name(role) + ' · ' + t('Abruf', 'Checked', 'Consulté le', 'Consultato il', 'Перевірено', 'تاريخ الاطلاع') + ' ' + formatDate(skills.read_on)
                  : t('Praxisbeispiele. Für diese Rolle liegen im Radar keine veröffentlichten Kennzahlen je Kenntnis vor.',
                    'Practical examples. This radar has no published skill counts for this role.',
                    'Exemples pratiques. Ce radar ne contient aucun chiffre publié par compétence pour ce métier.',
                    'Esempi pratici. Il radar non contiene dati pubblicati per singola competenza di questa professione.',
                    'Практичні приклади. Для цієї професії радар не має опублікованих показників за окремими навичками.',
                    'أمثلة عملية. لا تتوفر في هذه اللوحة أعداد منشورة للمهارات الفردية لهذه المهنة.')}
              </CardDescription>
            </CardHeader>
            {skills ? (
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {skills.skills.map(([label, value]) => (
                  <li key={label}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="shrink-0 text-slate-600 tabular-nums">{outOf(value, skills.base)}</span>
                    </div>
                    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-teal-50">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: (100 * value / skills.base) + '%' }} />
                    </div>
                    {skillCopy[label] && <p className="mt-1 text-xs text-slate-600">{t(...skillCopy[label])}</p>}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-600">{t('Das Berufsprofil zeigt eine Momentaufnahme. Ein Inserat kann mehrere Kenntnisse nennen.', 'The role profile is a snapshot. A listing may mention multiple skills.', 'Le profil est un instantané. Une annonce peut mentionner plusieurs compétences.', 'Il profilo è una fotografia del momento. Un annuncio può citare più competenze.', 'Профіль відображає стан на певну дату. В оголошенні можуть бути кілька навичок.', 'يعرض الملف المهني لقطة في تاريخ محدّد. قد يذكر الإعلان الواحد عدة مهارات.')}</p>
              <a className={sourceClass} href={skills.source} target="_blank" rel="noopener noreferrer">{t('ITBoard-Berufsprofil öffnen', 'Open the ITBoard role profile', 'Ouvrir le profil ITBoard', 'Apri il profilo ITBoard', 'Відкрити профіль ITBoard', 'فتح الملف المهني على ITBoard')}</a>
              <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-3">
                <h3 className="text-sm font-semibold text-teal-900">{exercise} · {course ? t(...course.title) : skills.course.title}</h3>
                <p className="text-sm">{course ? t(...course.practice) : skills.course.practice}</p>
                <p className="text-sm text-slate-700">{course ? t(...course.check) : skills.course.check}</p>
              </div>
            </CardContent>
            ) : practice && (
              <CardContent className="space-y-3">
                <ul className="list-disc space-y-1 ps-5 text-sm">{practice.skills.map((label) => <li key={label[0]}>{t(...label)}</li>)}</ul>
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm">
                  <h3 className="font-semibold text-teal-900">{exercise}</h3>
                  <p className="mt-1">{t(...practice.exercise)}</p>
                </div>
                <a className={sourceClass} href={practice.source} target="_blank" rel="noopener noreferrer">{t(...practice.sourceLabel)}</a>
              </CardContent>
            )}
          </Card>
        </div>
      </section>

      <section id="skill-trends" className="scroll-mt-5" aria-labelledby="skill-trends-heading">
        <Card>
          <CardHeader>
            <CardTitle><span id="skill-trends-heading">{t('Wie sich gefragte Kenntnisse verändern', 'How demand for skills changes', 'Évolution des compétences demandées', 'Come cambia la domanda di competenze', 'Як змінюється попит на навички', 'كيف يتغيّر الطلب على المهارات')}</span></CardTitle>
            <CardDescription>{t('Vergleiche, in welchem Anteil der Inserate eine Kenntnis in den zwei jüngsten ITBoard-Monatsstichproben vorkommt.',
              'Compare the share of listings mentioning a skill in the two latest monthly ITBoard samples.',
              'Compare la proportion d’annonces mentionnant une compétence dans les deux derniers échantillons mensuels ITBoard.',
              'Confronta la quota di annunci che citano una competenza nei due campioni mensili ITBoard più recenti.',
              'Порівняй частку оголошень, у яких згадано навичку, у двох найновіших місячних вибірках ITBoard.',
              'قارن نسبة الإعلانات التي تذكر مهارةً ما في أحدث عيّنتين شهريتين من ITBoard.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t('Kenntnis', 'Skill', 'Compétence', 'Competenza', 'Навичка', 'المهارة')}</TableHead>
                <TableHead className="whitespace-normal">{formatMonth(previous.month)}</TableHead>
                <TableHead className="whitespace-normal">{formatMonth(latest.month)}</TableHead>
                <TableHead className="whitespace-normal">{t('Veränderung', 'Change', 'Évolution', 'Variazione', 'Зміна', 'التغيّر')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {trendSkills.map(({ id, label }) => {
                  const before = radar.skill_trends.find((row) => row.skill_id === id && row.month === previous.month);
                  const after = radar.skill_trends.find((row) => row.skill_id === id && row.month === latest.month);
                  const beforeShare = before?.base ? before.value / before.base : null;
                  const afterShare = after?.base ? after.value / after.base : null;
                  const change = beforeShare !== null && afterShare !== null ? 100 * (afterShare - beforeShare) : null;
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{id === 'security' ? t(label, 'IT security', 'Sécurité informatique', 'Sicurezza informatica', 'ІТ-безпека', 'أمن المعلومات') : label}</TableCell>
                      <TableCell className="whitespace-normal">{beforeShare === null ? '—' : <>{percent.format(beforeShare)}<br /><span className="text-xs text-slate-600">{outOf(before?.value, before?.base)}</span></>}</TableCell>
                      <TableCell className="whitespace-normal">{afterShare === null ? '—' : <>{percent.format(afterShare)}<br /><span className="text-xs text-slate-600">{outOf(after?.value, after?.base)}</span></>}</TableCell>
                      <TableCell className="whitespace-normal">{change === null ? '—' : signed.format(change) + ' ' + t('Pp.', 'pp', 'pp', 'pp', 'в. п.', 'ن. م.')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-sm text-slate-600">{t('Pp. steht für Prozentpunkte. Der Vergleich verwendet die jeweilige Portalstichprobe. Die Berufsprofile oben zeigen Kenntnisse an einem einzelnen Datum.',
              'pp means percentage points. The comparison uses the portal sample for each month. The role profiles above show skills for a single date.',
              'pp signifie points de pourcentage. La comparaison utilise l’échantillon du portail pour chaque mois. Les profils ci-dessus donnent les compétences à une date précise.',
              'pp indica i punti percentuali. Il confronto usa il campione del portale per ogni mese. I profili mostrano le competenze a una data precisa.',
              'в. п. означає відсоткові пункти. Порівняння ґрунтується на вибірці порталу за кожен місяць. Профілі вище показують навички на конкретну дату.',
              'الرمز ن. م. يعني النقاط المئوية. تستخدم المقارنة عيّنة البوابة لكل شهر. وتعرض الملفات المهنية أعلاه المهارات في تاريخ محدّد.')}</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {[previous, latest].map((row) => (
                <a key={row.month} className={sourceClass} href={row.cutoff_source_url ?? radar.source.url} target="_blank" rel="noopener noreferrer">
                  ITBoard · {formatMonth(row.month)}{row.data_cutoff && ' · ' + formatDate(row.data_cutoff)}
                </a>
              ))}
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="policy" className="scroll-mt-5" aria-labelledby="policy-heading">
        <Card>
          <CardHeader>
            <CardTitle><span id="policy-heading">{t('Änderungen beim Arbeitsmarktzugang', 'Changes to access to work', 'Évolutions de l’accès au travail', 'Modifiche all’accesso al lavoro', 'Зміни щодо доступу до праці', 'تغيّرات الوصول إلى سوق العمل')}</span></CardTitle>
            <CardDescription>{t('Amtliche Meldungen, die ein Praktikum oder eine Anstellung betreffen können. Jede Meldung zeigt das Datum und ihren Stand.',
              'Official updates that may affect internships or employment. Each update shows its date and status.',
              'Informations officielles pouvant concerner un stage ou un emploi. Chaque information indique sa date et son statut.',
              'Notizie ufficiali che possono riguardare un tirocinio o un impiego. Ogni notizia indica data e stato.',
              'Офіційні повідомлення, які можуть вплинути на стажування чи працевлаштування. Для кожного вказано дату й стан.',
              'مستجدات رسمية قد تؤثر في التدريب العملي أو التوظيف. يبيّن كل تحديث تاريخه وحالته.')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">{t('Vorlage', 'Proposal', 'Projet', 'Proposta', 'Законопроєкт', 'مقترح')} · <time dateTime="2026-11-06">{formatDate('2026-11-06')}</time></p>
              <h3 className="mt-1 font-semibold">{t('Für die Arbeit den Kanton wechseln', 'Changing cantons for work', 'Changer de canton pour travailler', 'Cambiare Cantone per lavoro', 'Зміна кантону через роботу', 'الانتقال إلى كانتون آخر للعمل')}</h3>
              <p className="mt-1 text-sm">{t('Eine Parlamentskommission unterstützt die Vorlage für einen Kantonswechsel bei Erwerbstätigkeit mit Schutzstatus S unter bestimmten Voraussetzungen. Der Entscheid des Ständerats steht aus. Für die Vermittlung gelten die aktuellen Regeln.',
                'A parliamentary committee supports a proposal to allow people with protection status S to change cantons for work under certain conditions. A decision by the Council of States is pending. Current rules apply to placements.',
                'Une commission parlementaire soutient un projet permettant aux personnes titulaires du statut de protection S de changer de canton pour travailler sous certaines conditions. La décision du Conseil des États est attendue. Les règles actuelles s’appliquent au placement.',
                'Una commissione parlamentare sostiene la proposta di consentire a chi ha lo statuto di protezione S di cambiare Cantone per lavoro a determinate condizioni. Si attende la decisione del Consiglio degli Stati. Al collocamento si applicano le regole attuali.',
                'Парламентська комісія підтримала пропозицію, за якою люди зі статусом захисту S за певних умов можуть змінювати кантон через роботу. Рішення Ради кантонів очікується. Для працевлаштування діють поточні правила.',
                'تؤيد لجنة برلمانية مقترحاً يسمح لحاملي وضع الحماية S بالانتقال إلى كانتون آخر للعمل وفق شروط محددة. قرار مجلس الولايات قيد الانتظار. تسري القواعد الحالية على التوظيف.')}</p>
              <p className="mt-2 text-sm"><a className={sourceClass} href="https://www.parlament.ch/press-releases/Pages/mm-spk-s-2026-11-06.aspx?lang=1031" target="_blank" rel="noopener noreferrer">{t('Schweizer Parlament · Kommissionsmeldung', 'Swiss Parliament · Committee release', 'Parlement suisse · Communiqué de la commission', 'Parlamento svizzero · Comunicato della commissione', 'Парламент Швейцарії · Повідомлення комісії', 'البرلمان السويسري · بيان اللجنة')}</a></p>
            </article>
            <article className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-teal-800">{t('Amtliche Anleitung', 'Official guidance', 'Guide officiel', 'Guida ufficiale', 'Офіційна настанова', 'إرشادات رسمية')} · <time dateTime="2026-10-21">{formatDate('2026-10-21')}</time></p>
              <h3 className="mt-1 font-semibold">{t('Was muss der Arbeitgeber tun?', 'What does the employer need to do?', 'Que doit faire l’employeur ?', 'Che cosa deve fare il datore di lavoro?', 'Що має зробити роботодавець?', 'ما المطلوب من صاحب العمل؟')}</h3>
              <p className="mt-1 text-sm">{t('Das Staatssekretariat für Migration erklärt, bei welchem Ausweis eine Meldung oder eine kantonale Bewilligung nötig ist. Prüfe den Ausweis und kläre unklare Fälle mit dem Kanton.',
                'The State Secretariat for Migration explains which permits require a notification or cantonal authorisation. Check the permit and ask the canton about unclear cases.',
                'Le Secrétariat d’État aux migrations explique quels permis exigent une annonce ou une autorisation cantonale. Vérifie le permis et contacte le canton en cas de doute.',
                'La Segreteria di Stato della migrazione spiega per quali permessi serve una notifica o un’autorizzazione cantonale. Verifica il permesso e chiarisci i dubbi con il Cantone.',
                'Державний секретаріат з питань міграції пояснює, за яких документів потрібно подати повідомлення чи отримати дозвіл кантону. Перевір документ і звернися до кантону, якщо є сумніви.',
                'توضح أمانة الدولة للهجرة متى يلزم الإبلاغ أو الحصول على إذن كانتوني لكل نوع من الوثائق. تحقّق من الوثيقة واستفسر من الكانتون عند الحاجة.')}</p>
              <p className="mt-2 text-sm"><a className={sourceClass} href="https://www.sem.admin.ch/de/arbeit-asylbereich" target="_blank" rel="noopener noreferrer">{t('SEM-Anleitung und kantonale Kontakte', 'SEM guidance and cantonal contacts', 'Guide du SEM et contacts cantonaux', 'Guida SEM e contatti cantonali', 'Настанови SEM і контакти кантонів', 'إرشادات SEM وجهات الاتصال في الكانتونات')}</a></p>
            </article>
            <article className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-teal-800">{t('In Kraft seit', 'In force since', 'En vigueur depuis le', 'In vigore dal', 'Діє з', 'ساري منذ')} · <time dateTime="2025-12-01">{formatDate('2025-12-01')}</time></p>
              <h3 className="mt-1 font-semibold">{t('Erwerbstätigkeit bei Schutzstatus S melden', 'Reporting employment under protection status S', 'Annoncer une activité avec le statut de protection S', 'Notificare l’attività con lo statuto di protezione S', 'Повідомлення про роботу зі статусом захисту S', 'الإبلاغ عن بدء العمل لحاملي وضع الحماية S')}</h3>
              <p className="mt-1 text-sm">{t('Bei einer Anstellung mit Schutzstatus S meldet der Arbeitgeber die Erwerbstätigkeit in der Regel vor Arbeitsbeginn. Der Bundesrat hat das frühere Bewilligungsverfahren geändert. Das SEM erklärt Ablauf und Ausnahmen.',
                'When hiring someone with protection status S, the employer generally reports the employment before work starts. The Federal Council changed the previous permit procedure. SEM explains the steps and exceptions.',
                'Lorsqu’il embauche une personne titulaire du statut de protection S, l’employeur annonce généralement l’activité avant son début. Le Conseil fédéral a modifié l’ancienne procédure d’autorisation. Le SEM détaille les démarches et les exceptions.',
                'Quando assume una persona con lo statuto di protezione S, il datore di lavoro di norma notifica l’attività prima che inizi. Il Consiglio federale ha modificato la precedente procedura di autorizzazione. La SEM illustra i passaggi e le eccezioni.',
                'При наймі людини зі статусом захисту S роботодавець зазвичай повідомляє про працевлаштування до початку роботи. Федеральна рада змінила попередній порядок отримання дозволу. SEM пояснює процедуру й винятки.',
                'عند توظيف شخص يحمل وضع الحماية S، يُبلّغ صاحب العمل عن التوظيف عادةً قبل بدء العمل. عدّل المجلس الاتحادي إجراءات الترخيص السابقة. توضّح SEM الخطوات والاستثناءات.')}</p>
              <p className="mt-2 text-sm">
                <a className={sourceClass} href="https://www.efd.admin.ch/de/newnsb/O1q31tESAJVk" target="_blank" rel="noopener noreferrer">{t('Bundesratsbeschluss', 'Federal Council decision', 'Décision du Conseil fédéral', 'Decisione del Consiglio federale', 'Рішення Федеральної ради', 'قرار المجلس الاتحادي')}</a>
                {' · '}<a className={sourceClass} href="https://www.fedlex.admin.ch/eli/oc/2025/669/de" target="_blank" rel="noopener noreferrer">{t('Fedlex · Verordnung', 'Fedlex · Ordinance', 'Fedlex · Ordonnance', 'Fedlex · Ordinanza', 'Fedlex · Постанова', 'Fedlex · المرسوم')}</a>
              </p>
            </article>
          </CardContent>
        </Card>
      </section>

      <MigrationWatch />

      <section id="context" className="grid scroll-mt-5 gap-4 lg:grid-cols-2" aria-label={t('Schweizer Kontext und nächster Schritt', 'Swiss context and next steps', 'Contexte suisse et prochaines étapes', 'Contesto svizzero e prossimi passi', 'Швейцарський контекст і наступні кроки', 'السياق السويسري والخطوات التالية')}>
        <Card>
          <CardHeader><CardTitle>{t('Von der Ausbildung zum Praktikum', 'From training to an internship', 'De la formation au stage', 'Dalla formazione al tirocinio', 'Від навчання до стажування', 'من التدريب إلى التدريب العملي')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{t('Powercoders berichtet von über 370 vermittelten Praktika seit 2017. 250 dieser Teilnehmenden fanden anschliessend eine Stelle oder Lehrstelle.',
              'Powercoders reports arranging over 370 internships since 2017. 250 of those participants then found a job or apprenticeship.',
              'Powercoders indique avoir trouvé plus de 370 stages depuis 2017. Ensuite, 250 de ces personnes ont trouvé un emploi ou une place d’apprentissage.',
              'Powercoders dichiara di aver procurato oltre 370 tirocini dal 2017. Di queste persone, 250 hanno poi trovato un impiego o un posto di apprendistato.',
              'Powercoders повідомляє, що з 2017 року допомогла організувати понад 370 стажувань. Згодом 250 учасників знайшли роботу або місце професійного навчання.',
              'تفيد Powercoders بأنها نسّقت أكثر من 370 فرصة تدريب عملي منذ عام 2017. ثم وجد 250 مشاركاً وظيفة أو فرصة تدريب مهني.')}</p>
            <p><a className={sourceClass} href="https://powercoders.org/companies/" target="_blank" rel="noopener noreferrer">{t('Powercoders · Zahlen und Arbeitgeberprogramm', 'Powercoders · Figures and employer programme', 'Powercoders · Chiffres et programme pour les employeurs', 'Powercoders · Dati e programma per i datori di lavoro', 'Powercoders · Показники й програма для роботодавців', 'Powercoders · الأرقام وبرنامج أصحاب العمل')}</a></p>
            <p><a className={sourceClass} href="https://powercoders.org/programs/bootcamp/" target="_blank" rel="noopener noreferrer">{t('Bootcamp und Weg ins Praktikum', 'Bootcamp and the path to an internship', 'Formation intensive et accès au stage', 'Corso intensivo e percorso verso il tirocinio', 'Інтенсивний курс і шлях до стажування', 'الدورة المكثفة والمسار إلى التدريب العملي')}</a></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('Schweizer Arbeitsmarkt', 'Swiss job market', 'Marché du travail suisse', 'Mercato del lavoro svizzero', 'Ринок праці Швейцарії', 'سوق العمل السويسري')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{t('Der Fachkräftemangelindex von UZH und Adecco ging 2025 bei ICT- und Informatikberufen zurück.',
              'The UZH and Adecco skills shortage index declined for ICT and computing occupations in 2025.',
              'L’indice de pénurie de main-d’œuvre qualifiée de l’UZH et d’Adecco a reculé en 2025 pour les métiers des TIC et de l’informatique.',
              'Nel 2025 l’indice di carenza di personale qualificato di UZH e Adecco è sceso per le professioni ICT e informatiche.',
              'У 2025 році індекс дефіциту фахівців UZH та Adecco знизився для професій у сфері ІКТ та інформатики.',
              'انخفض مؤشر نقص الكفاءات الصادر عن UZH وAdecco في وظائف تقنية المعلومات والاتصالات والحوسبة عام 2025.')}</p>
            <p><a className={sourceClass} href="https://www.stellenmarktmonitor.uzh.ch/de/indices/fachkraeftemangel.html" target="_blank" rel="noopener noreferrer">{t('Index von UZH und Adecco', 'Index by UZH and Adecco', 'Indice de l’UZH et d’Adecco', 'Indice di UZH e Adecco', 'Індекс UZH та Adecco', 'مؤشر UZH وAdecco')}</a></p>
            <p>{t('BSS schätzt den verbleibenden Bildungsbedarf bis 2033 auf 54’400 ICT-Fachkräfte. Erwartete Abschlüsse und Zuwanderung sind eingerechnet.',
              'BSS estimates a remaining need to train 54,400 ICT specialists by 2033. It accounts for expected graduates and immigration.',
              'BSS estime qu’il reste à former 54 400 spécialistes des TIC d’ici à 2033. Le calcul tient compte des diplômes attendus et de l’immigration.',
              'BSS stima che entro il 2033 restino da formare 54 400 specialisti ICT. Il calcolo include i titoli attesi e l’immigrazione.',
              'За оцінкою BSS, до 2033 року потрібно додатково підготувати 54 400 фахівців з ІКТ. Розрахунок враховує очікуваних випускників та імміграцію.',
              'تقدّر BSS الحاجة المتبقية إلى تأهيل 54,400 مختص في تقنية المعلومات والاتصالات بحلول 2033. ويأخذ التقدير في الحسبان أعداد الخريجين والهجرة المتوقّعة.')}</p>
            <p><a className={sourceClass} href="https://www.ict-berufsbildung.ch/resources/BSS-Schlussbericht-ICT-Bildungsbedarf-2033-2025-09_09.pdf" target="_blank" rel="noopener noreferrer">{t('BSS-Schlussbericht', 'BSS final report', 'Rapport final de BSS', 'Rapporto finale BSS', 'Підсумковий звіт BSS', 'التقرير النهائي لـ BSS')}</a></p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
