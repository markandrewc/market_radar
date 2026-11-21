export type Copy = readonly [de: string, en: string, fr: string, it: string, uk: string, ar: string];

export const migrationHeadings = {
  title: [
    'Wöchentlicher Überblick zu Migration und Arbeit',
    'Weekly overview of migration and employment',
    'Point hebdomadaire sur la migration et l’emploi',
    'Aggiornamento settimanale su migrazione e lavoro',
    'Щотижневий огляд міграції та працевлаштування',
    'نظرة أسبوعية على الهجرة والعمل',
  ],
  description: [
    'Prüfe für den Wochenüberblick, welche amtlichen Berichte und Regelungen neu dazugekommen sind. Jede Quelle nennt ihren Berichtszeitraum oder das Datum der Vorlage oder Regelung.',
    'Check for new official reports and rules each week. The source gives the relevant reporting period or the date of the proposal or rule.',
    'Vérifiez chaque semaine les nouveaux rapports et règlements officiels. La source indique la période couverte ou la date du projet ou de la règle.',
    'Controlla ogni settimana le nuove pubblicazioni e norme ufficiali. La fonte indica il periodo di riferimento o la data della proposta o della norma.',
    'Щотижня перевіряйте нові офіційні звіти й правила. У джерелі зазначено звітний період або дату пропозиції чи правила.',
    'تحقّق كل أسبوع من التقارير والقواعد الرسمية الجديدة. يذكر المصدر فترة التقرير أو تاريخ المقترح أو القاعدة.',
  ],
  why: ['Warum das wichtig ist', 'Why it matters', 'Pourquoi c’est important', 'Perché è importante', 'Чому це важливо', 'لماذا يهمّ ذلك'],
  check: ['Was du prüfen kannst', 'What to check', 'Que vérifier', 'Cosa verificare', 'Що варто перевірити', 'ما الذي ينبغي التحقّق منه'],
  sources: ['Amtliche Quellen', 'Official sources', 'Sources officielles', 'Fonti ufficiali', 'Офіційні джерела', 'المصادر الرسمية'],
} as const satisfies Record<string, Copy>;

export const migrationLinks = {
  asylumRelease: {
    url: 'https://www.sem.admin.ch/de/newnsb/W11FHTquJJ9Z',
    label: ['SEM-Mitteilung für Oktober 2026', 'SEM release for October 2026', 'Communiqué du SEM pour octobre 2026', 'Comunicato della SEM per ottobre 2026', 'Повідомлення SEM за жовтень 2026 р.', 'بيان أمانة الدولة للهجرة لأكتوبر 2026'],
  },
  asylumTables: {
    url: 'https://www.sem.admin.ch/de/asylstatistik-oktober-2026',
    label: ['Tabellen für Oktober 2026', 'October 2026 tables', 'Tableaux d’octobre 2026', 'Tabelle di ottobre 2026', 'Таблиці за жовтень 2026 р.', 'جداول أكتوبر 2026'],
  },
  asylumSeries: {
    url: 'https://www.sem.admin.ch/de/asylstatistik',
    label: ['SEM-Archiv der Monatsberichte', 'SEM monthly report archive', 'Archives des rapports mensuels du SEM', 'Archivio dei rapporti mensili della SEM', 'Архів щомісячних звітів SEM', 'أرشيف التقارير الشهرية لأمانة الدولة للهجرة'],
  },
  octoberStatusSApplications: {
    url: 'https://www.sem.admin.ch/dam/de/sd-web/f9x8Tiluiw1m/7-70-bew-schutz-m-2026-10-d.xlsx',
    label: ['Neue S-Gesuche im Oktober (XLSX)', 'New status S applications in October (XLSX)', 'Nouvelles demandes de statut S en octobre (XLSX)', 'Nuove domande di statuto S in ottobre (XLSX)', 'Нові заяви на статус S у жовтні (XLSX)', 'الطلبات الجديدة لوضع الحماية S في أكتوبر (XLSX)'],
  },
  septemberStatusSApplications: {
    url: 'https://www.sem.admin.ch/dam/de/sd-web/0sbfceXJtRYI/7-70-bew-schutz-m-2026-09-d.xlsx',
    label: ['Neue S-Gesuche im September (XLSX)', 'New status S applications in September (XLSX)', 'Nouvelles demandes de statut S en septembre (XLSX)', 'Nuove domande di statuto S in settembre (XLSX)', 'Нові заяви на статус S у вересні (XLSX)', 'الطلبات الجديدة لوضع الحماية S في سبتمبر (XLSX)'],
  },
  septemberAssignments: {
    url: 'https://www.sem.admin.ch/dam/de/sd-web/18qwrqs6R8au/260930-kantonszuweisung-status-s-d.pdf',
    label: ['Kantonszuweisungen im September (PDF)', 'Cantonal allocations in September (PDF)', 'Attributions aux cantons en septembre (PDF)', 'Attribuzioni ai cantoni in settembre (PDF)', 'Розподіл за кантонами у вересні (PDF)', 'التوزيع على الكانتونات في سبتمبر (PDF)'],
  },
  augustAssignments: {
    url: 'https://www.sem.admin.ch/dam/de/sd-web/VePJox5YDMbL/260831-kantonszuweisung-status-s-d.pdf',
    label: ['Kantonszuweisungen im August (PDF)', 'Cantonal allocations in August (PDF)', 'Attributions aux cantons en août (PDF)', 'Attribuzioni ai cantoni in agosto (PDF)', 'Розподіл за кантонами в серпні (PDF)', 'التوزيع على الكانتونات في أغسطس (PDF)'],
  },
  statusSStatistics: {
    url: 'https://www.sem.admin.ch/de/statistiken-ukraine',
    label: ['SEM-Statistik zum Schutzstatus S', 'SEM statistics on protection status S', 'Statistiques du SEM sur le statut de protection S', 'Statistiche della SEM sullo statuto di protezione S', 'Статистика SEM щодо статусу захисту S', 'إحصاءات أمانة الدولة للهجرة حول وضع الحماية S'],
  },
  entry: {
    url: 'https://www.sem.admin.ch/de/in-die-schweiz-einreisen',
    label: ['SEM-Hinweise zu Einreise und Visa', 'SEM guidance on entry and visas', 'Informations du SEM sur l’entrée et les visas', 'Indicazioni della SEM su ingresso e visti', 'Інформація SEM про в’їзд і візи', 'إرشادات أمانة الدولة للهجرة بشأن الدخول والتأشيرات'],
  },
  residence: {
    url: 'https://www.sem.admin.ch/de/aufenthalt',
    label: ['SEM-Hinweise zum Aufenthalt', 'SEM guidance on residence', 'Informations du SEM sur le séjour', 'Indicazioni della SEM sul soggiorno', 'Інформація SEM про перебування', 'إرشادات أمانة الدولة للهجرة بشأن الإقامة'],
  },
  travelProposal: {
    url: 'https://www.sem.admin.ch/de/newnsb/Oq0CiNf6IUcX',
    label: ['Reisevorlage des Bundesrats', 'Federal Council travel proposal', 'Projet du Conseil fédéral sur les voyages', 'Proposta del Consiglio federale sui viaggi', 'Пропозиція Федеральної ради щодо поїздок', 'مقترح المجلس الاتحادي بشأن السفر'],
  },
  quotas: {
    url: 'https://www.ejpd.admin.ch/de/newnsb/7HwBjdg5HpBA',
    label: ['Bundesratsentscheid zu den Kontingenten 2026', 'Federal Council decision on 2026 quotas', 'Décision du Conseil fédéral sur les contingents 2026', 'Decisione del Consiglio federale sui contingenti 2026', 'Рішення Федеральної ради про квоти на 2026 рік', 'قرار المجلس الاتحادي بشأن حصص عام 2026'],
  },
  cantonContacts: {
    url: 'https://www.sem.admin.ch/de/kantonale-migrations-und-arbeitsmarktbehoerden',
    label: ['Kantonale Migrations- und Arbeitsmarktbehörden', 'Cantonal migration and labour market authorities', 'Autorités cantonales de la migration et de l’emploi', 'Autorità cantonali della migrazione e del mercato del lavoro', 'Кантональні органи з питань міграції та ринку праці', 'سلطات الهجرة وسوق العمل في الكانتونات'],
  },
} as const satisfies Record<string, { url: string; label: Copy }>;

type Topic = {
  id: string;
  title: Copy;
  status: Copy;
  summary: Copy;
  why: Copy;
  check: Copy;
  links: readonly (keyof typeof migrationLinks)[];
};

export const migrationTopics = [
  {
    id: 'asylum-counts',
    title: ['Asylgesuche und Staatsangehörigkeit', 'Asylum applications and nationality', 'Demandes d’asile et nationalité', 'Domande d’asilo e cittadinanza', 'Заяви про надання притулку та громадянство', 'طلبات اللجوء والجنسية'],
    status: ['Amtlicher Bericht · 16. November 2026', 'Official report · 16 November 2026', 'Rapport officiel · 16 novembre 2026', 'Rapporto ufficiale · 16 novembre 2026', 'Офіційний звіт · 16 листопада 2026 р.', 'تقرير رسمي · 16 نوفمبر 2026'],
    summary: [
      'Das Staatssekretariat für Migration (SEM) erfasste im Oktober 2026 2’210 Asylgesuche. Im September 2026 waren es 2’122 und im Oktober 2025 waren es 2’643. Im Oktober 2026 entfielen 498 Gesuche auf Personen mit afghanischer und 430 auf Personen mit eritreischer Staatsangehörigkeit.',
      'The State Secretariat for Migration (SEM) recorded 2,210 asylum applications in October 2026, compared with 2,122 in September 2026 and 2,643 in October 2025. In October 2026, Afghan nationals filed 498 applications and Eritrean nationals filed 430.',
      'Le Secrétariat d’État aux migrations (SEM) a enregistré 2 210 demandes d’asile en octobre 2026, contre 2 122 en septembre 2026 et 2 643 en octobre 2025. En octobre 2026, 498 demandes ont été déposées par des personnes de nationalité afghane et 430 par des personnes de nationalité érythréenne.',
      'La Segreteria di Stato della migrazione (SEM) ha registrato 2’210 domande d’asilo nell’ottobre 2026, rispetto alle 2’122 del settembre 2026 e alle 2’643 dell’ottobre 2025. Nell’ottobre 2026, 498 domande provenivano da cittadini afghani e 430 da cittadini eritrei.',
      'У жовтні 2026 року Державний секретаріат з питань міграції (SEM) зареєстрував 2 210 заяв про надання притулку. У вересні 2026 року було 2 122 заяви, а в жовтні 2025 року — 2 643. У жовтні 2026 року громадяни Афганістану подали 498 заяв, громадяни Еритреї — 430.',
      'سجّلت أمانة الدولة للهجرة (SEM) 2,210 طلبًا للجوء في أكتوبر 2026، مقابل 2,122 في سبتمبر 2026 و2,643 في أكتوبر 2025. وفي أكتوبر 2026، قدّم مواطنون أفغان 498 طلبًا، وقدّم مواطنون إريتريون 430 طلبًا.',
    ],
    why: [
      'Die Zahlen helfen bei der Planung von Übersetzungen und Informationsangeboten. Der Bericht weist Gesuche und Entscheide getrennt aus.',
      'These figures help plan translations and outreach. The report records applications and decisions separately.',
      'Ces chiffres aident à planifier les traductions et les actions d’information. Le rapport distingue les demandes des décisions.',
      'I dati aiutano a pianificare traduzioni e iniziative informative. Il rapporto distingue le domande dalle decisioni.',
      'Ці дані допомагають планувати переклади та інформування. У звіті окремо наведено заяви та рішення.',
      'تساعد هذه الأرقام في التخطيط للترجمة والتواصل. يعرض التقرير الطلبات والقرارات بشكل منفصل.',
    ],
    check: [
      'Vergleiche in einem neuen Monatsbericht dieselbe Kennzahl über gleich lange Zeiträume. Lies die Aufschlüsselung nach Staatsangehörigkeit zusammen mit der Schweizer Gesamtzahl.',
      'In a new monthly report, compare the same measure over periods of equal length. Read the breakdown by nationality alongside the Swiss total.',
      'Dans le nouveau rapport mensuel, comparez le même indicateur sur des périodes de même durée. Lisez la ventilation par nationalité avec le total suisse.',
      'Nel nuovo rapporto mensile, confronta lo stesso indicatore per periodi di pari durata. Leggi il dettaglio per cittadinanza insieme al totale svizzero.',
      'У новому місячному звіті порівнюйте той самий показник за періоди однакової тривалості. Переглядайте розподіл за громадянством разом із загальним показником для Швейцарії.',
      'عند صدور تقرير شهري جديد، قارن المؤشر نفسه على مدى فترات متساوية. اقرأ التوزيع حسب الجنسية إلى جانب الإجمالي في سويسرا.',
    ],
    links: ['asylumRelease', 'asylumTables', 'asylumSeries'],
  },
  {
    id: 'protection-cantons',
    title: ['Schutzstatus S und Kantonszuweisungen', 'Protection status S and cantonal allocations', 'Statut de protection S et attributions aux cantons', 'Statuto di protezione S e attribuzioni ai cantoni', 'Статус захисту S і розподіл за кантонами', 'وضع الحماية S والتوزيع على الكانتونات'],
    status: ['Amtliche Zahlen · September und Oktober 2026', 'Official figures · September and October 2026', 'Chiffres officiels · septembre et octobre 2026', 'Dati ufficiali · settembre e ottobre 2026', 'Офіційні дані · вересень і жовтень 2026 р.', 'أرقام رسمية · سبتمبر وأكتوبر 2026'],
    summary: [
      'Im Oktober gingen schweizweit 987 neue Gesuche um Schutzstatus S ein, im September 1’162. Die kumulierten Erstzuweisungen seit März 2022 stiegen von 125’860 Ende August auf 126’890 Ende September. Im Kanton Bern waren es 15’083 Ende August und 15’199 Ende September.',
      'Switzerland recorded 987 new requests for protection status S in October and 1,162 in September. Cumulative first allocations since March 2022 rose from 125,860 at the end of August to 126,890 at the end of September. The corresponding totals for the canton of Bern were 15,083 and 15,199.',
      'La Suisse a enregistré 987 nouvelles demandes de statut de protection S en octobre et 1 162 en septembre. Le cumul des premières attributions depuis mars 2022 est passé de 125 860 fin août à 126 890 fin septembre. Les totaux correspondants pour le canton de Berne étaient de 15 083 et 15 199.',
      'In Svizzera si sono registrate 987 nuove domande di statuto di protezione S in ottobre e 1’162 in settembre. Le prime attribuzioni cumulate da marzo 2022 sono salite da 125’860 a fine agosto a 126’890 a fine settembre. Nel cantone di Berna i valori corrispondenti erano 15’083 e 15’199.',
      'У жовтні у Швейцарії подали 987 нових заяв на статус захисту S, у вересні — 1 162. Сукупна кількість перших розподілів з березня 2022 року зросла зі 125 860 наприкінці серпня до 126 890 наприкінці вересня. У кантоні Берн відповідні показники становили 15 083 і 15 199.',
      'سجّلت سويسرا 987 طلبًا جديدًا لوضع الحماية S في أكتوبر و1,162 في سبتمبر. وارتفع العدد التراكمي لحالات التوزيع الأول منذ مارس 2022 من 125,860 في نهاية أغسطس إلى 126,890 في نهاية سبتمبر. وفي كانتون برن بلغ العدد 15,083 في نهاية أغسطس و15,199 في نهاية سبتمبر.',
    ],
    why: [
      'Die Zuweisungszahlen helfen dabei, regionale Partner zu finden. Sie zählen jede Person im zuerst zugewiesenen Kanton.',
      'Allocation figures help identify regional partners. Each person is counted in the canton to which they were first assigned.',
      'Ces chiffres aident à trouver des partenaires régionaux. Chaque personne compte dans le premier canton auquel elle a été attribuée.',
      'I dati aiutano a individuare i partner regionali. Ogni persona è conteggiata nel primo cantone a cui è stata attribuita.',
      'Дані про розподіл допомагають знайти регіональних партнерів. Кожну особу рахують у кантоні, до якого її спочатку розподілили.',
      'تساعد أرقام التوزيع في تحديد الشركاء الإقليميين. يُحتسب كل شخص في الكانتون الذي أُحيل إليه أولًا.',
    ],
    check: [
      'Vergleiche neue Gesuche, Schutzgewährungen und Zuweisungen jeweils getrennt. Kläre mit lokalen Partnern, welche Unterstützung vor Ort gerade gebraucht wird.',
      'Compare new applications, grants of protection and allocations separately. Ask local partners what support is currently needed in the area.',
      'Comparez séparément les nouvelles demandes, les protections accordées et les attributions. Demandez aux partenaires locaux quels besoins d’accompagnement existent actuellement.',
      'Confronta separatamente nuove domande, concessioni della protezione e attribuzioni. Chiedi ai partner locali quale sostegno è attualmente necessario.',
      'Порівнюйте окремо нові заяви, рішення про надання захисту та розподіл. Запитайте місцевих партнерів, яка підтримка зараз потрібна на місці.',
      'قارن الطلبات الجديدة وقرارات منح الحماية وحالات التوزيع كلًّا على حدة. اسأل الشركاء المحليين عن الدعم المطلوب حاليًا.',
    ],
    links: ['octoberStatusSApplications', 'septemberStatusSApplications', 'septemberAssignments', 'augustAssignments', 'statusSStatistics'],
  },
  {
    id: 'visa-residence',
    title: ['Visa und Aufenthalt', 'Visas and residence', 'Visas et séjour', 'Visti e soggiorno', 'Візи та перебування', 'التأشيرات والإقامة'],
    status: ['SEM-Hinweise · Reisevorlage vom 11. November 2026', 'SEM guidance · travel proposal of 11 November 2026', 'Informations du SEM · projet sur les voyages du 11 novembre 2026', 'Indicazioni della SEM · proposta sui viaggi dell’11 novembre 2026', 'Інформація SEM · пропозиція щодо поїздок від 11 листопада 2026 р.', 'إرشادات أمانة الدولة للهجرة · مقترح السفر المؤرخ 11 نوفمبر 2026'],
    summary: [
      'Die Einreiseregeln hängen von der Staatsangehörigkeit, dem Reisezweck und der Aufenthaltsdauer ab. Der Bundesrat schlägt vor, die bisherigen Reiseregeln für Personen aus der Ukraine mit Schutzstatus S beizubehalten.',
      'Entry rules depend on nationality, purpose of travel and length of stay. The Federal Council proposes keeping the existing travel rules for people from Ukraine with protection status S.',
      'Les règles d’entrée dépendent de la nationalité, du motif du voyage et de la durée du séjour. Le Conseil fédéral propose de maintenir les règles de voyage actuelles pour les personnes venues d’Ukraine bénéficiant du statut de protection S.',
      'Le norme di ingresso dipendono dalla cittadinanza, dallo scopo del viaggio e dalla durata del soggiorno. Il Consiglio federale propone di mantenere le regole di viaggio attuali per le persone provenienti dall’Ucraina con statuto di protezione S.',
      'Правила в’їзду залежать від громадянства, мети поїздки та тривалості перебування. Федеральна рада пропонує зберегти чинні правила поїздок для осіб з України зі статусом захисту S.',
      'تعتمد قواعد الدخول على الجنسية والغرض من السفر ومدة الإقامة. يقترح المجلس الاتحادي الإبقاء على قواعد السفر الحالية للأشخاص القادمين من أوكرانيا ممن يحملون وضع الحماية S.',
    ],
    why: [
      'Für ein Praktikum sind Einreise, Aufenthalt und Berechtigung zur Arbeit getrennt zu klären.',
      'For an internship, check entry, residence and permission to work separately.',
      'Pour un stage, vérifiez séparément les conditions d’entrée, de séjour et de travail.',
      'Per un tirocinio verifica separatamente ingresso, soggiorno e diritto al lavoro.',
      'Для стажування потрібно окремо перевірити умови в’їзду, перебування та право на роботу.',
      'للتدريب العملي، تحقّق من شروط الدخول والإقامة والإذن بالعمل كلًّا على حدة.',
    ],
    check: [
      'Prüfe die geltenden Einreiseregeln beim SEM. Kläre vor dem geplanten Start mit der zuständigen kantonalen Stelle, welche Bewilligung oder Meldung für das Praktikum erforderlich ist.',
      'Check current entry rules with the SEM. Before the planned start, ask the relevant canton which permit or notification is required for the internship.',
      'Consultez les règles d’entrée en vigueur auprès du SEM. Avant le début du stage, vérifiez auprès du canton compétent quelle autorisation ou annonce est nécessaire.',
      'Consulta la SEM per le regole di ingresso in vigore. Prima dell’inizio previsto, verifica con il cantone competente quale autorizzazione o notifica è necessaria per il tirocinio.',
      'Перевірте чинні правила в’їзду в SEM. До початку стажування з’ясуйте у відповідному кантональному органі, чи потрібні дозвіл або повідомлення.',
      'تحقّق من قواعد الدخول الحالية لدى أمانة الدولة للهجرة. وقبل بدء التدريب، اسأل الجهة المختصة في الكانتون عن التصريح أو الإخطار المطلوب.',
    ],
    links: ['entry', 'residence', 'travelProposal'],
  },
  {
    id: 'permit-quotas',
    title: ['Kontingente für Arbeitsbewilligungen', 'Work permit quotas', 'Contingents de permis de travail', 'Contingenti per i permessi di lavoro', 'Квоти на дозволи на роботу', 'حصص تصاريح العمل'],
    status: ['Amtliche Höchstzahlen · 1. Januar bis 31. Dezember 2026', 'Official limits · 1 January to 31 December 2026', 'Limites officielles · du 1er janvier au 31 décembre 2026', 'Limiti ufficiali · dal 1° gennaio al 31 dicembre 2026', 'Офіційні ліміти · 1 січня – 31 грудня 2026 р.', 'الحدود الرسمية · من 1 يناير إلى 31 ديسمبر 2026'],
    summary: [
      'Für qualifizierte Erwerbstätige aus Drittstaaten stehen 2026 4’500 Aufenthaltsbewilligungen B und 4’000 Kurzaufenthaltsbewilligungen L zur Verfügung. Für das Vereinigte Königreich gilt ein eigenes Kontingent.',
      'For qualified workers from third countries, the 2026 limits are 4,500 B residence permits and 4,000 L short-stay permits. The United Kingdom has a separate quota.',
      'Pour les travailleurs qualifiés d’États tiers, les limites de 2026 sont de 4 500 autorisations de séjour B et de 4 000 autorisations de courte durée L. Le Royaume-Uni dispose de son propre contingent.',
      'Per i lavoratori qualificati di Stati terzi, nel 2026 sono previsti 4’500 permessi di dimora B e 4’000 permessi di soggiorno di breve durata L. Per il Regno Unito si applica un contingente separato.',
      'Для кваліфікованих працівників із третіх країн у 2026 році передбачено 4 500 дозволів на проживання типу B і 4 000 короткострокових дозволів типу L. Для Сполученого Королівства діє окрема квота.',
      'تبلغ حصص عام 2026 للعمال المؤهلين من خارج الاتحاد الأوروبي والرابطة الأوروبية للتجارة الحرة 4,500 تصريح إقامة من الفئة B و4,000 تصريح إقامة قصيرة من الفئة L. وللمملكة المتحدة حصة منفصلة.',
    ],
    why: [
      'Die Jahreszahlen helfen bei der Planung. Die zuständige kantonale Stelle klärt für den Einzelfall, ob ein Kontingent gilt und ob Bewilligungen verfügbar sind.',
      'The annual figures help with planning. The relevant canton can confirm whether a quota applies in a specific case and whether permits are available.',
      'Les chiffres annuels aident à planifier. Le canton compétent peut confirmer si un contingent s’applique au cas concret et si des autorisations sont disponibles.',
      'I dati annuali aiutano a pianificare. Il cantone competente può chiarire se un contingente si applica al caso specifico e se ci sono permessi disponibili.',
      'Річні показники допомагають планувати. Відповідний кантональний орган уточнить, чи діє квота в конкретному випадку і чи є доступні дозволи.',
      'تساعد الأرقام السنوية في التخطيط. ويمكن للجهة المختصة في الكانتون توضيح ما إذا كانت الحصة تنطبق على حالة معينة وما إذا كانت التصاريح متاحة.',
    ],
    check: [
      'Vergleiche neue Höchstzahlen oder Angaben zur Ausschöpfung jeweils für dieselbe Bewilligungsart. Kläre Voraussetzungen und Verfahren mit dem Kanton.',
      'Compare new limits or usage figures for the same permit type. Confirm eligibility and the procedure with the canton.',
      'Comparez les nouveaux plafonds ou leur utilisation pour le même type d’autorisation. Vérifiez les conditions et la procédure auprès du canton.',
      'Confronta nuovi limiti o dati sull’utilizzo per lo stesso tipo di permesso. Verifica requisiti e procedura con il cantone.',
      'Порівнюйте нові ліміти або показники використання для того самого виду дозволу. Уточніть вимоги та процедуру в кантоні.',
      'قارن الحدود الجديدة أو أرقام الاستخدام لنوع التصريح نفسه. وتحقّق من الشروط والإجراء لدى الكانتون.',
    ],
    links: ['quotas', 'cantonContacts'],
  },
] as const satisfies readonly Topic[];
