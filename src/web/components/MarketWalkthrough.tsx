import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/i18n';

type Copy = readonly [string, string, string, string, string, string];

const steps: readonly { title: Copy; instruction: Copy; section: string; link: Copy }[] = [
  {
    title: ['Prüfe, was die Zahlen abdecken', 'Check what the figures cover', 'Vérifiez ce que couvrent les chiffres', 'Controlla cosa includono i dati', 'Перевірте, що охоплюють цифри', 'تحقّق مما تغطّيه الأرقام'],
    instruction: [
      'Beginne mit Quelle und Datum. Die Stellenzahlen stammen aus einer ITBoard-Stichprobe. Die Kenntnisse je Beruf stammen aus datierten Berufsprofilen.',
      'Start with the source and date. The vacancy figures come from an ITBoard sample. Skills by role come from dated role profiles.',
      'Commencez par la source et la date. Les chiffres des offres proviennent d’un échantillon ITBoard. Les compétences par métier viennent de fiches datées.',
      'Parti dalla fonte e dalla data. I dati sulle offerte provengono da un campione ITBoard. Le competenze per professione vengono da profili datati.',
      'Почніть із джерела й дати. Дані про вакансії взято з вибірки ITBoard. Навички за професіями наведено в профілях із датою.',
      'ابدأ بالمصدر والتاريخ. أرقام الوظائف مأخوذة من عينة ITBoard. وتأتي المهارات حسب المهنة من ملفات مهنية مؤرّخة.',
    ],
    section: '#sources',
    link: ['Datenquellen öffnen', 'Open data sources', 'Ouvrir les sources', 'Apri le fonti dei dati', 'Відкрити джерела даних', 'افتح مصادر البيانات'],
  },
  {
    title: ['Wähle dein Gebiet für den Wochencheck', 'Choose an area for the weekly review', 'Choisissez une zone pour le suivi hebdomadaire', 'Scegli una zona per il controllo settimanale', 'Виберіть регіон для щотижневого огляду', 'اختر منطقة للمراجعة الأسبوعية'],
    instruction: [
      'Wähle die Schweiz oder eine Stadt. Lies das Gebiet neben den Zahlen. Einzelne Inserate findest du über die Stellensuche für die Stadt.',
      'Choose Switzerland or a city. Read the area shown next to the figures. For individual listings, use the city job search.',
      'Choisissez la Suisse ou une ville. Vérifiez le périmètre écrit à côté des chiffres. Utilisez la recherche par ville pour les offres individuelles.',
      'Scegli la Svizzera o una città. Leggi l’area indicata accanto ai dati. Usa la ricerca per città per trovare singoli annunci.',
      'Виберіть Швейцарію або місто. Перевірте, яка територія зазначена біля цифр. Окремі оголошення знайдете через пошук вакансій у місті.',
      'اختر سويسرا أو مدينة. اقرأ اسم النطاق الجغرافي بجانب الأرقام. وللعثور على إعلانات فردية استخدم البحث عن الوظائف في المدينة.',
    ],
    section: '#regions',
    link: ['Gebiet auswählen', 'Choose an area', 'Choisir une zone', 'Scegli la zona', 'Вибрати регіон', 'اختر المنطقة'],
  },
  {
    title: ['Wähle einen Beruf und prüfe die Kenntnisse', 'Choose a role and review its skills', 'Choisissez un métier et examinez ses compétences', 'Scegli una professione e verifica le competenze', 'Виберіть професію й перегляньте навички', 'اختر مهنة وراجع مهاراتها'],
    instruction: [
      'Wähle einen Beruf, für den ihr ausbildet. Die Beschreibung erklärt die Aufgaben. Bei den Kenntnissen stehen veröffentlichte Zahlen oder gekennzeichnete Praxisbeispiele.',
      'Choose a role you train for. The description explains the tasks. Skills are shown with published figures or labelled practice examples.',
      'Choisissez un métier pour lequel vous formez des personnes. La fiche décrit les activités. Les compétences sont accompagnées de chiffres publiés ou d’exemples pratiques signalés.',
      'Scegli una professione per cui offrite formazione. La descrizione spiega le attività. Le competenze sono accompagnate da dati pubblicati o esempi pratici indicati come tali.',
      'Виберіть професію, для якої ви готуєте людей. В описі наведено завдання. Поруч із навичками є опубліковані цифри або позначені практичні приклади.',
      'اختر مهنة تقدّمون تدريباً لها. يوضّح الوصف مهامها. تُعرض المهارات مع أرقام منشورة أو أمثلة عملية مميّزة بوضوح.',
    ],
    section: '#roles',
    link: ['Berufe und Kenntnisse erkunden', 'Explore roles and skills', 'Découvrir les métiers et les compétences', 'Esplora professioni e competenze', 'Переглянути професії та навички', 'استكشف المهن والمهارات'],
  },
  {
    title: ['Vergleiche die Entwicklung', 'Compare changes over time', 'Comparez l’évolution', 'Confronta l’andamento', 'Порівняйте зміни з часом', 'قارن التغيّر مع مرور الوقت'],
    instruction: [
      'Vergleiche dieselbe Kenntnis über mehrere Monate. Nutze den Anteil der Inserate, wenn die Stichprobengrösse wechselt. Die Beschriftung zeigt, für welche Stellen die Zahlen gelten.',
      'Compare the same skill across months. Use the share of listings when the sample size changes. The labels show which vacancies the figures cover.',
      'Comparez la même compétence sur plusieurs mois. Utilisez la part des offres si la taille de l’échantillon change. L’intitulé précise les offres couvertes.',
      'Confronta la stessa competenza in più mesi. Usa la quota degli annunci quando cambia la dimensione del campione. Le etichette indicano quali offerte sono incluse.',
      'Порівняйте ту саму навичку за кілька місяців. Якщо розмір вибірки змінюється, порівнюйте частки оголошень. Підписи показують, які вакансії охоплено.',
      'قارن المهارة نفسها في عدة أشهر. استخدم نسبة الإعلانات عند تغيّر حجم العينة. توضح التسميات الوظائف التي تشملها الأرقام.',
    ],
    section: '#skill-trends',
    link: ['Monatsvergleich öffnen', 'Open the monthly comparison', 'Ouvrir la comparaison mensuelle', 'Apri il confronto mensile', 'Відкрити порівняння за місяцями', 'افتح المقارنة الشهرية'],
  },
  {
    title: ['Prüfe Migration und Arbeitsmarktzugang', 'Check migration and access to work', 'Vérifiez les règles de migration et d’accès au travail', 'Verifica migrazione e accesso al lavoro', 'Перевірте правила міграції та доступу до роботи', 'راجع الهجرة وإمكانية الوصول إلى العمل'],
    instruction: [
      'Sichte Änderungen bei SEM-Zahlen, Visa, Aufenthalt, Kontingenten und Arbeitsmarktzugang. Prüfe den geltenden Stand, bevor du einen Einzelfall einschätzt.',
      'Review updates to SEM figures, visas, residence, quotas and access to work. Check the current status before assessing an individual case.',
      'Consultez les mises à jour du SEM sur les chiffres, les visas, le séjour, les contingents et l’accès au travail. Vérifiez l’état en vigueur avant d’examiner un cas individuel.',
      'Consulta gli aggiornamenti della SEM su cifre, visti, soggiorno, contingenti e accesso al lavoro. Verifica la situazione vigente prima di valutare un caso individuale.',
      'Перегляньте оновлення SEM щодо статистики, віз, проживання, квот і доступу до роботи. Перевірте чинні правила перед оцінкою окремого випадку.',
      'راجع تحديثات SEM بشأن الأرقام والتأشيرات والإقامة والحصص والوصول إلى العمل. تحقّق من القواعد السارية قبل تقييم حالة فردية.',
    ],
    section: '#policy',
    link: ['Amtliche Quellen öffnen', 'Open official sources', 'Ouvrir les sources officielles', 'Apri le fonti ufficiali', 'Відкрити офіційні джерела', 'افتح المصادر الرسمية'],
  },
  {
    title: ['Wähle den nächsten Schritt', 'Choose your next step', 'Choisissez la prochaine étape', 'Scegli il prossimo passo', 'Виберіть наступний крок', 'اختر الخطوة التالية'],
    instruction: [
      'Wähle eine Kenntnis für die nächste Kursbesprechung. Nimm Beruf, Stichtag und Quellenlink mit. Weise das Ausbildungsteam auf Datenlücken hin.',
      'Pick one skill for the next course discussion. Bring the role, the reference date and a source link. Point out gaps in the data to the training team.',
      'Choisissez une compétence pour la prochaine discussion pédagogique. Indiquez le métier, la date de référence et le lien de la source. Signalez les données manquantes à l’équipe.',
      'Scegli una competenza per la prossima discussione sul corso. Porta la professione, la data di riferimento e il link della fonte. Segnala al team i dati mancanti.',
      'Виберіть навичку для наступної розмови про курс. Зазначте професію, дату й посилання на джерело. Повідомте команді, яких даних бракує.',
      'اختر مهارة لمناقشتها في اجتماع الدورة المقبل. أحضر اسم المهنة وتاريخ البيانات ورابط المصدر. اذكر للفريق أي فجوات في البيانات.',
    ],
    section: '#context',
    link: ['Schweizer Kontext ansehen', 'Review the Swiss context', 'Consulter le contexte suisse', 'Consulta il contesto svizzero', 'Переглянути контекст Швейцарії', 'راجع سياق سوق العمل السويسري'],
  },
];

const action = 'rounded-lg border px-3 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700';
const primaryAction = `${action} border-teal-800 bg-teal-800 text-white hover:bg-teal-900`;
const secondaryAction = `${action} border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-white`;

export default function MarketWalkthrough() {
  const { t, locale } = useLanguage();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const wasOpened = useRef(false);
  const step = stepIndex === null ? null : steps[stepIndex];
  const number = new Intl.NumberFormat(locale);
  const stepNumber = number.format((stepIndex ?? 0) + 1);
  const stepCount = number.format(steps.length);

  useEffect(() => {
    if (stepIndex !== null) {
      wasOpened.current = true;
      stepHeading.current?.focus();
    } else if (wasOpened.current) {
      launcher.current?.focus();
    }
  }, [stepIndex]);

  return (
    <section id="walkthrough" aria-labelledby="market-tour-title" className="rounded-xl border border-teal-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="market-tour-title" className="text-base font-semibold text-slate-900">{t('Geführter Rundgang', 'Guided tour', 'Visite guidée', 'Visita guidata', 'Огляд із підказками', 'جولة إرشادية')}</h2>
          <p className="mt-1">{t('Finde Zahlen für dein Gebiet, verstehe die Berufsprofile und prüfe, was ein Praktikum beeinflussen kann.', 'Find figures for your area, understand the role profiles and see what can affect an internship.', 'Trouvez des chiffres pour votre région, comprenez les métiers et vérifiez ce qui peut influencer un stage.', 'Scopri i dati della tua zona, comprendi i profili professionali e verifica cosa può influire su un tirocinio.', 'Знайдіть цифри для свого регіону, перегляньте профілі професій і перевірте, що може вплинути на стажування.', 'اعثر على أرقام منطقتك، وافهم الملفات المهنية، وتعرّف على ما قد يؤثر في التدريب العملي.')}</p>
        </div>
        <button
          ref={launcher}
          type="button"
          className={primaryAction}
          aria-expanded={step !== null}
          aria-controls="market-tour-steps"
          onClick={() => setStepIndex(stepIndex === null ? 0 : null)}
        >
          {step ? t('Rundgang schliessen', 'Close tour', 'Fermer la visite', 'Chiudi la visita', 'Закрити огляд', 'أغلق الجولة')
            : t('Rundgang starten', 'Start tour', 'Démarrer la visite', 'Avvia la visita', 'Почати огляд', 'ابدأ الجولة')}
        </button>
      </div>

      <div id="market-tour-steps" hidden={step === null} onKeyDown={event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setStepIndex(null);
      }}>
        {step && stepIndex !== null && (
          <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/70 p-4">
            <h3 ref={stepHeading} tabIndex={-1} className="w-fit rounded font-semibold text-slate-900 focus:outline-2 focus:outline-offset-4 focus:outline-teal-700">
              <span className="mb-1 block text-xs font-medium text-teal-800">{t(`Schritt ${stepNumber} von ${stepCount}`, `Step ${stepNumber} of ${stepCount}`, `Étape ${stepNumber} sur ${stepCount}`, `Passo ${stepNumber} di ${stepCount}`, `Крок ${stepNumber} із ${stepCount}`, `الخطوة ${stepNumber} من ${stepCount}`)}</span>
              {t(...step.title)}
            </h3>
            <p className="mt-2 max-w-2xl">{t(...step.instruction)}</p>
            <a href={step.section} className="mt-2 inline-block font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">{t(...step.link)}</a>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={secondaryAction} disabled={stepIndex === 0} onClick={() => setStepIndex(stepIndex - 1)}>{t('Zurück', 'Back', 'Retour', 'Indietro', 'Назад', 'رجوع')}</button>
              <button type="button" className={primaryAction} onClick={() => setStepIndex(stepIndex === steps.length - 1 ? null : stepIndex + 1)}>
                {stepIndex === steps.length - 1 ? t('Rundgang abschliessen', 'Finish tour', 'Terminer la visite', 'Termina la visita', 'Завершити огляд', 'إنهاء الجولة')
                  : t('Weiter', 'Next', 'Suivant', 'Avanti', 'Далі', 'التالي')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
