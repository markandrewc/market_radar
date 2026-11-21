type Copy = [de: string, en: string, fr: string, it: string, uk: string, ar: string];

export const roleCopy: Record<string, { label: Copy; job: Copy; example: Copy }> = {
  'it-support': {
    label: ['IT-Support', 'IT support', 'Assistance informatique', 'Assistenza informatica', 'ІТ-підтримка', 'الدعم التقني'],
    job: [
      'Hilft Menschen beim Umgang mit ihren Computern und bei technischen Störungen.',
      'Helps people use their computers and solve technical problems.',
      'Aide les personnes à utiliser leur ordinateur et à résoudre des problèmes techniques.',
      'Aiuta le persone a usare il computer e a risolvere problemi tecnici.',
      'Допомагає людям користуватися комп’ютерами та вирішувати технічні проблеми.',
      'يساعد الأشخاص في استخدام الحواسيب وحل المشكلات التقنية.',
    ],
    example: [
      'Beispiel: Die Person klärt, warum jemand sich nicht anmelden kann, hält die Lösung fest und zieht bei Bedarf Fachleute hinzu.',
      'For example, they find out why someone cannot sign in, document the fix and ask a specialist for help if needed.',
      'Par exemple, la personne cherche pourquoi une connexion échoue, note la solution et sollicite des spécialistes si nécessaire.',
      'Per esempio, la persona scopre perché un accesso non riesce, annota la soluzione e coinvolge chi ha le competenze necessarie.',
      'Наприклад, з’ясовує, чому не вдається увійти, записує рішення й за потреби звертається до фахівців.',
      'مثلاً، يتحقق من سبب تعذّر تسجيل الدخول، ويوثّق الحل ويستعين بمختص عند الحاجة.',
    ],
  },
  'fullstack-developer': {
    label: ['Fullstack-Webentwicklung', 'Full-stack web development', 'Développement web full stack', 'Sviluppo web full stack', 'Веброзробка full stack', 'تطوير الويب المتكامل'],
    job: [
      'Entwickelt die sichtbare Oberfläche einer Website und den Teil, der Daten speichert und bereitstellt.',
      'Builds both the visible part of a website and the part that stores and serves data.',
      'Développe l’interface visible d’un site ainsi que la partie qui stocke et fournit les données.',
      'Sviluppa l’interfaccia visibile di un sito e la parte che memorizza e fornisce i dati.',
      'Розробляє видиму частину вебсайту й частину, що зберігає та надає дані.',
      'يطوّر واجهة الموقع والجزء المسؤول عن تخزين البيانات وإتاحتها.',
    ],
    example: [
      'Beispiel: Die Person baut ein Formular, speichert die Antworten und zeigt eine Bestätigung an.',
      'For example, they build a form, save the replies and show a confirmation.',
      'Par exemple, la personne crée un formulaire, enregistre les réponses et affiche une confirmation.',
      'Per esempio, la persona crea un modulo, salva le risposte e mostra una conferma.',
      'Наприклад, створює форму, зберігає відповіді й показує підтвердження.',
      'مثلاً، يبني نموذجاً ويحفظ الردود ثم يعرض تأكيداً.',
    ],
  },
  'data-engineer': {
    label: ['Datenengineering', 'Data engineering', 'Ingénierie des données', 'Ingegneria dei dati', 'Інженерія даних', 'هندسة البيانات'],
    job: [
      'Sammelt und ordnet Daten, damit andere damit Fragen beantworten können.',
      'Collects and organises data so others can use it to answer questions.',
      'Rassemble et organise les données pour que d’autres puissent les utiliser pour répondre à des questions.',
      'Raccoglie e organizza dati che altre persone possono usare per rispondere a domande.',
      'Збирає й упорядковує дані, щоб інші могли відповісти на запитання.',
      'يجمع البيانات وينظّمها ليتمكّن الآخرون من استخدامها للإجابة عن الأسئلة.',
    ],
    example: [
      'Beispiel: Die Person verbindet Dateien aus zwei Quellen, prüft fehlende Werte und erstellt eine verlässliche Tabelle für einen Bericht.',
      'For example, they combine files from two sources, check for missing values and prepare a reliable table for a report.',
      'Par exemple, la personne réunit des fichiers de deux sources, repère les valeurs manquantes et prépare un tableau fiable pour un rapport.',
      'Per esempio, la persona unisce file da due fonti, verifica i valori mancanti e prepara una tabella affidabile per un rapporto.',
      'Наприклад, об’єднує файли з двох джерел, перевіряє пропущені значення й готує надійну таблицю для звіту.',
      'مثلاً، يدمج ملفات من مصدرين، ويتحقق من القيم المفقودة ويعدّ جدولاً موثوقاً لتقرير.',
    ],
  },
  'software-engineer': {
    label: ['Softwareentwicklung', 'Software engineering', 'Développement logiciel', 'Sviluppo software', 'Розробка програмного забезпечення', 'تطوير البرمجيات'],
    job: [
      'Entwirft, programmiert und testet Software für konkrete Aufgaben.',
      'Designs, writes and tests software for specific tasks.',
      'Conçoit, programme et teste des logiciels pour des tâches précises.',
      'Progetta, programma e verifica software per compiti specifici.',
      'Проєктує, програмує й тестує програмне забезпечення для конкретних завдань.',
      'يصمّم البرمجيات ويطوّرها ويختبرها لمهام محددة.',
    ],
    example: [
      'Beispiel: Die Person verbessert ein Buchungssystem und ergänzt einen Test, der den behobenen Fehler künftig erkennt.',
      'For example, they improve a booking system and add a test that catches the bug if it returns.',
      'Par exemple, la personne améliore un système de réservation et ajoute un test qui détecte le défaut s’il réapparaît.',
      'Per esempio, la persona migliora un sistema di prenotazione e aggiunge un test che rileva il difetto se si ripresenta.',
      'Наприклад, удосконалює систему бронювання й додає перевірку на випадок повторення помилки.',
      'مثلاً، يحسّن نظام حجوزات ويضيف اختباراً يكتشف الخطأ إذا تكرّر.',
    ],
  },
  'data-analyst': {
    label: ['Datenanalyse', 'Data analysis', 'Analyse des données', 'Analisi dei dati', 'Аналіз даних', 'تحليل البيانات'],
    job: [
      'Wertet Zahlen aus und erklärt, was sie für die Entscheidungen eines Teams bedeuten.',
      'Analyses figures and explains what they mean for a team’s decisions.',
      'Analyse les chiffres et explique ce qu’ils signifient pour les décisions d’une équipe.',
      'Analizza i numeri e spiega cosa indicano per le decisioni di un gruppo di lavoro.',
      'Аналізує цифри й пояснює, що вони означають для рішень команди.',
      'يحلّل الأرقام ويشرح ما تعنيه لقرارات الفريق.',
    ],
    example: [
      'Beispiel: Die Person vergleicht Wartezeiten mehrerer Teams und erklärt, welche Unterschiede belegt sind.',
      'For example, they compare wait times across teams and explain which differences the data supports.',
      'Par exemple, la personne compare les temps d’attente de plusieurs équipes et explique quels écarts sont établis.',
      'Per esempio, la persona confronta i tempi di attesa di più gruppi e spiega quali differenze sono documentate.',
      'Наприклад, порівнює час очікування в кількох командах і пояснює, які відмінності підтверджують дані.',
      'مثلاً، يقارن أوقات الانتظار بين الفرق ويشرح الفروق التي تدعمها البيانات.',
    ],
  },
  'people-analytics': {
    label: ['Datenanalyse im Personalwesen', 'People analytics', 'Analyse des données RH', 'Analisi dei dati HR', 'Аналітика у сфері персоналу', 'تحليل بيانات الموارد البشرية'],
    job: [
      'Wertet Daten zu Personal, Weiterbildung oder Rekrutierung aus, um Fragen der Personalabteilung zu beantworten.',
      'Analyses staff, training or recruitment data to answer questions from human resources.',
      'Analyse les données sur le personnel, la formation ou le recrutement pour répondre aux questions des ressources humaines.',
      'Analizza dati sul personale, la formazione o il reclutamento per rispondere alle domande delle risorse umane.',
      'Аналізує дані про працівників, навчання чи найм, щоб відповідати на запитання відділу кадрів.',
      'يحلّل بيانات الموظفين أو التدريب أو التوظيف للإجابة عن أسئلة الموارد البشرية.',
    ],
    example: [
      'Beispiel: Die Person berechnet die Teilnahme an Kursen je Abteilung anhand zusammengefasster Zahlen und erklärt, welche Schlüsse möglich sind.',
      'For example, they use aggregate figures to calculate training participation by department and explain what the results show.',
      'Par exemple, la personne utilise des chiffres agrégés pour calculer la participation aux cours par service et explique ce qu’on peut en conclure.',
      'Per esempio, la persona usa dati aggregati per calcolare la partecipazione ai corsi per reparto e spiega cosa si può concludere.',
      'Наприклад, за зведеними даними розраховує участь у курсах за відділами й пояснює, які висновки можна зробити.',
      'مثلاً، يستخدم أرقاماً مجمّعة لحساب المشاركة في الدورات حسب القسم ويشرح ما تظهره النتائج.',
    ],
  },
};

export const skillCopy: Record<string, Copy> = {
  ICT: ['Computersysteme und Netzwerke im Arbeitsalltag.', 'Computer systems and networks used at work.', 'Systèmes informatiques et réseaux utilisés au travail.', 'Sistemi informatici e reti utilizzati al lavoro.', 'Комп’ютерні системи й мережі в повсякденній роботі.', 'أنظمة الحاسوب والشبكات المستخدمة في العمل.'],
  'Microsoft 365': ['Werkzeuge für E-Mail, Dokumente und Teamarbeit.', 'Tools for email, documents and teamwork.', 'Outils pour les e-mails, les documents et le travail en équipe.', 'Strumenti per e-mail, documenti e lavoro di gruppo.', 'Інструменти для пошти, документів і спільної роботи.', 'أدوات للبريد الإلكتروني والمستندات والعمل الجماعي.'],
  'Active Directory': ['Verwaltet Anmeldungen und Zugriffsrechte.', 'Manages sign-ins and access permissions.', 'Gère les connexions et les droits d’accès.', 'Gestisce gli accessi e i permessi.', 'Керує входом у систему й правами доступу.', 'يدير تسجيل الدخول وصلاحيات الوصول.'],
  'Windows 11': ['Betriebssystem vieler Arbeitscomputer.', 'Operating system used on many work computers.', 'Système d’exploitation de nombreux ordinateurs professionnels.', 'Sistema operativo di molti computer di lavoro.', 'Операційна система багатьох робочих комп’ютерів.', 'نظام تشغيل تستخدمه كثير من حواسيب العمل.'],
  Java: ['Programmiersprache für Dienste hinter einer Anwendung.', 'Programming language for services behind an application.', 'Langage utilisé pour les services qui font fonctionner une application.', 'Linguaggio usato per i servizi alla base di un’applicazione.', 'Мова програмування для служб, що забезпечують роботу застосунку.', 'لغة برمجة للخدمات التي تعمل خلف واجهة التطبيق.'],
  React: ['Werkzeug für die sichtbare Oberfläche von Websites.', 'A tool for building the visible parts of websites.', 'Outil pour créer les parties visibles d’un site web.', 'Strumento per creare le parti visibili di un sito web.', 'Інструмент для створення видимої частини вебсайтів.', 'أداة لبناء الأجزاء المرئية من المواقع.'],
  Docker: ['Verpackt eine Anwendung, damit sie auf verschiedenen Computern gleich läuft.', 'Packages an application so it runs the same way on different computers.', 'Emballe une application pour qu’elle fonctionne de la même façon sur différents ordinateurs.', 'Racchiude un’applicazione affinché funzioni allo stesso modo su computer diversi.', 'Пакує застосунок, щоб він однаково працював на різних комп’ютерах.', 'يغلّف التطبيق ليعمل بالطريقة نفسها على حواسيب مختلفة.'],
  Angular: ['Werkzeug für bedienbare Oberflächen von Webanwendungen.', 'A tool for building interactive web application interfaces.', 'Outil pour créer des interfaces interactives pour les applications web.', 'Strumento per creare interfacce interattive per applicazioni web.', 'Інструмент для створення інтерактивних інтерфейсів вебзастосунків.', 'أداة لبناء واجهات تفاعلية لتطبيقات الويب.'],
  Python: ['Programmiersprache zum Automatisieren von Aufgaben und Verarbeiten von Daten.', 'Programming language for automating tasks and processing data.', 'Langage de programmation pour automatiser des tâches et traiter des données.', 'Linguaggio di programmazione per automatizzare compiti ed elaborare dati.', 'Мова програмування для автоматизації завдань і обробки даних.', 'لغة برمجة لأتمتة المهام ومعالجة البيانات.'],
  'ML / AI': ['Werkzeuge, die Muster aus Daten lernen und daraus Vorschläge oder Prognosen ableiten.', 'Tools that learn patterns from data and use them to make suggestions or predictions.', 'Outils qui apprennent à repérer des tendances dans les données et produisent des suggestions ou des prévisions.', 'Strumenti che apprendono schemi dai dati e li usano per proporre suggerimenti o previsioni.', 'Інструменти, що виявляють закономірності в даних і пропонують рекомендації чи прогнози.', 'أدوات تتعلّم الأنماط من البيانات وتستخدمها لتقديم اقتراحات أو توقّعات.'],
  Snowflake: ['Cloud-Plattform zum Speichern und Auswerten grosser Datenmengen.', 'Cloud platform for storing and analysing large volumes of data.', 'Plateforme cloud pour stocker et analyser de grands volumes de données.', 'Piattaforma cloud per archiviare e analizzare grandi volumi di dati.', 'Хмарна платформа для зберігання й аналізу великих обсягів даних.', 'منصّة سحابية لتخزين كميات كبيرة من البيانات وتحليلها.'],
  Kafka: ['Leitet laufend neue Informationen zwischen Softwaresystemen weiter.', 'Streams new information between software systems.', 'Transmet en continu de nouvelles informations entre systèmes logiciels.', 'Trasmette in continuo nuove informazioni tra sistemi software.', 'Постійно передає нову інформацію між програмними системами.', 'ينقل المعلومات الجديدة باستمرار بين الأنظمة البرمجية.'],
  SQL: ['Sprache zum Abfragen und Ordnen von Informationen in einer Datenbank.', 'Language for querying and organising information in a database.', 'Langage pour interroger et organiser les informations d’une base de données.', 'Linguaggio per interrogare e organizzare le informazioni di una banca dati.', 'Мова для запитів та впорядкування інформації в базі даних.', 'لغة للاستعلام عن المعلومات وتنظيمها في قاعدة بيانات.'],
  Kubernetes: ['Betreibt und verwaltet verpackte Anwendungen auf mehreren Computern.', 'Runs and manages containerised applications across computers.', 'Exécute et gère des applications conteneurisées sur plusieurs ordinateurs.', 'Esegue e gestisce applicazioni in container su più computer.', 'Запускає й керує контейнеризованими застосунками на кількох комп’ютерах.', 'يشغّل التطبيقات داخل حاويات ويديرها عبر عدة حواسيب.'],
  'CI/CD': ['Prüft Softwareänderungen automatisch und bereitet ihre Veröffentlichung vor.', 'Automatically checks software changes and prepares them for release.', 'Vérifie automatiquement les changements logiciels et prépare leur mise en production.', 'Controlla automaticamente le modifiche al software e prepara il rilascio.', 'Автоматично перевіряє зміни й готує їх до випуску.', 'يفحص تغييرات البرمجيات آلياً ويهيّئها للإصدار.'],
  'C++': ['Programmiersprache für Systeme und Anwendungen, die schnell laufen müssen.', 'Programming language for systems and applications that need to run fast.', 'Langage pour des systèmes et des applications qui doivent fonctionner rapidement.', 'Linguaggio per sistemi e applicazioni che richiedono prestazioni elevate.', 'Мова програмування для систем і застосунків, яким потрібна висока швидкість.', 'لغة برمجة للأنظمة والتطبيقات التي تتطلب سرعة عالية.'],
  TypeScript: ['Ergänzt JavaScript um Prüfungen, die manche Fehler vor dem Start einer Website erkennen.', 'Adds checks to JavaScript that catch some errors before a website starts.', 'Ajoute à JavaScript des vérifications qui détectent certaines erreurs avant le démarrage du site.', 'Aggiunge a JavaScript controlli che rilevano alcuni errori prima dell’avvio del sito.', 'Доповнює JavaScript перевірками, які виявляють частину помилок ще до запуску сайту.', 'يضيف إلى جافاسكريبت فحوصاً تكشف بعض الأخطاء قبل تشغيل الموقع.'],
};

export const courseCopy: Partial<Record<string, { title: Copy; practice: Copy; check: Copy }>> = {
  'it-support': {
    title: ['Ein Anmeldeproblem eingrenzen', 'Narrow down a sign-in problem', 'Cerner un problème de connexion', 'Individuare un problema di accesso', 'З’ясувати причину проблеми зі входом', 'تحديد سبب مشكلة تسجيل الدخول'],
    practice: [
      'Bearbeite eine fiktive Supportanfrage. Die Anmeldung bei Microsoft 365 schlägt auf Windows 11 fehl. Frage nach der Fehlermeldung und den betroffenen Personen. Schlage dann eine erste sichere Prüfung vor.',
      'Handle a fictional support request. Microsoft 365 sign-in fails on Windows 11. Ask what error appears and who is affected. Suggest a safe first check.',
      'Traite une demande d’assistance fictive. La connexion à Microsoft 365 échoue sous Windows 11. Demande quel message s’affiche et qui est concerné. Propose une première vérification sûre.',
      'Gestisci una richiesta di assistenza fittizia. L’accesso a Microsoft 365 non riesce in Windows 11. Chiedi quale errore appare e chi è coinvolto. Proponi un primo controllo sicuro.',
      'Опрацюй вигаданий запит. Не вдається увійти в Microsoft 365 у Windows 11. Дізнайся, яка помилка з’являється й кого вона стосується. Запропонуй безпечну першу перевірку.',
      'عالج طلب دعم افتراضياً. يتعذّر تسجيل الدخول إلى Microsoft 365 على Windows 11. اسأل عن رسالة الخطأ والأشخاص المتأثرين واقترح فحصاً أولياً آمناً.',
    ],
    check: [
      'Halte Fehlerbild, Massnahme und Ergebnis fest. Schütze die Zugangsdaten und leite ungelöste Fälle an das zuständige Team weiter.',
      'Record the problem, action and outcome. Protect login credentials and pass unresolved cases to the responsible team.',
      'Note le problème, l’action et le résultat. Protège les identifiants et transmets les cas non résolus à l’équipe compétente.',
      'Annota problema, intervento ed esito. Proteggi le credenziali e inoltra i casi irrisolti al gruppo competente.',
      'Запиши прояв проблеми, дію й результат. Захисти облікові дані й передай невирішені випадки відповідальній команді.',
      'دوّن المشكلة والإجراء والنتيجة. احمِ بيانات الدخول وأحِل الحالات غير المحلولة إلى الفريق المختص.',
    ],
  },
  'fullstack-developer': {
    title: ['Eine kleine Webanwendung mit React und Docker starten', 'Run a small web app with React and Docker', 'Lancer une petite application web avec React et Docker', 'Avviare una piccola app web con React e Docker', 'Запустити невеликий вебзастосунок з React і Docker', 'تشغيل تطبيق ويب صغير باستخدام React وDocker'],
    practice: ['Zeige drei fiktive Einträge in einer React-Liste und starte die Anwendung in einem vorbereiteten Container.', 'Display three fictional entries in a React list and run the app in a prepared container.', 'Affiche trois entrées fictives dans une liste React et lance l’application dans un conteneur préparé.', 'Mostra tre voci fittizie in una lista React e avvia l’app in un container predisposto.', 'Покажи три вигадані записи у списку React і запусти застосунок у підготовленому контейнері.', 'اعرض ثلاثة سجلات افتراضية في قائمة React وشغّل التطبيق داخل حاوية جاهزة.'],
    check: ['Bitte eine zweite Person, deiner Anleitung zu folgen und zu prüfen, ob alle drei Einträge sichtbar sind.', 'Ask someone else to follow your instructions and check that all three entries appear.', 'Demande à une autre personne de suivre tes instructions et de vérifier que les trois entrées s’affichent.', 'Chiedi a un’altra persona di seguire le tue istruzioni e verificare che le tre voci siano visibili.', 'Попроси іншу людину виконати твої інструкції й перевірити, чи видно всі три записи.', 'اطلب من شخص آخر اتباع تعليماتك والتحقق من ظهور السجلات الثلاثة.'],
  },
  'data-engineer': {
    title: ['CSV-Daten mit Python prüfen und zusammenfassen', 'Check and summarise CSV data with Python', 'Vérifier et résumer un CSV avec Python', 'Verificare e riepilogare dati CSV con Python', 'Перевірити й підсумувати дані CSV за допомогою Python', 'فحص بيانات CSV وتلخيصها باستخدام Python'],
    practice: ['Lies eine fiktive CSV-Datei ein. Markiere fehlende Werte und zähle die gültigen Einträge pro Gruppe.', 'Load a fictional CSV file. Flag missing values and count the valid entries in each group.', 'Charge un fichier CSV fictif. Signale les valeurs manquantes et compte les entrées valides par groupe.', 'Carica un file CSV fittizio. Segnala i valori mancanti e conta le voci valide per gruppo.', 'Завантаж вигаданий файл CSV. Познач пропущені значення й порахуй дійсні записи в кожній групі.', 'اقرأ ملف CSV افتراضياً. حدّد القيم المفقودة واحسب السجلات الصالحة في كل مجموعة.'],
    check: ['Prüfe die Gesamtzahl der Zeilen und weise fehlende Einträge separat aus.', 'Check the total number of rows and report missing entries separately.', 'Vérifie le nombre total de lignes et indique séparément les entrées manquantes.', 'Verifica il totale delle righe e indica separatamente le voci mancanti.', 'Перевір загальну кількість рядків і окремо вкажи пропущені записи.', 'تحقّق من إجمالي الصفوف واذكر السجلات المفقودة بصورة منفصلة.'],
  },
  'software-engineer': {
    title: ['Eine kleine Java-Schnittstelle bauen und testen', 'Build and test a small Java API', 'Créer et tester une petite API Java', 'Creare e testare una piccola API Java', 'Створити й перевірити невеликий API на Java', 'إنشاء واجهة Java صغيرة واختبارها'],
    practice: ['Erstelle eine Java-Schnittstelle für einen Eintrag aus einem fiktiven Datensatz. Teste eine gültige und eine ungültige Anfrage. Starte die Anwendung anschliessend in Docker.', 'Build a Java API for a record from a fictional dataset. Test a valid request and an invalid one. Run the app in Docker.', 'Crée une API Java pour une entrée d’un jeu de données fictif. Teste une requête valide et une autre invalide. Lance l’application dans Docker.', 'Crea un’API Java per una voce di un insieme di dati fittizio. Prova una richiesta valida e una non valida. Avvia l’applicazione in Docker.', 'Створи API на Java для запису з вигаданого набору даних. Перевір коректний і некоректний запити. Запусти застосунок у Docker.', 'أنشئ واجهة Java لسجل من مجموعة بيانات افتراضية. اختبر طلباً صالحاً وآخر غير صالح، ثم شغّل التطبيق في Docker.'],
    check: ['Beide Tests bestehen. Die Schnittstelle meldet bei ungültiger Eingabe den dokumentierten Fehler. Eine zweite Person kann die Anwendung mit deiner Anleitung starten.', 'Both tests pass. The API reports the documented error for invalid input. Someone else can run the app using your instructions.', 'Les deux tests réussissent. L’API renvoie l’erreur documentée si l’entrée est invalide. Une autre personne peut lancer l’application en suivant tes instructions.', 'Entrambi i test riescono. L’API segnala l’errore documentato se l’input non è valido. Un’altra persona può avviare l’app usando le tue istruzioni.', 'Обидві перевірки проходять. API повертає задокументовану помилку для некоректних даних. Інша людина може запустити застосунок за твоїми інструкціями.', 'ينجح الاختباران. تعرض الواجهة الخطأ الموثّق عند إدخال غير صالح. يستطيع شخص آخر تشغيل التطبيق باتباع تعليماتك.'],
  },
};

export const practiceCopy: Partial<Record<string, { skills: Copy[]; exercise: Copy; source: string; sourceLabel: Copy }>> = {
  'data-analyst': {
    skills: [
      ['Eine Tabelle bereinigen oder Daten aus einer Datenbank abfragen', 'Clean up a table or query a database', 'Nettoyer un tableau ou interroger une base de données', 'Pulire una tabella o interrogare una banca dati', 'Очистити таблицю чи зробити запит до бази даних', 'تنظيف جدول أو الاستعلام عن قاعدة بيانات'],
      ['Anteile mit der richtigen Bezugsgrösse vergleichen', 'Compare shares using the right totals', 'Comparer des proportions en utilisant les bons totaux', 'Confrontare le percentuali usando i totali corretti', 'Порівнювати частки за правильними загальними кількостями', 'مقارنة النسب باستخدام الإجماليات الصحيحة'],
      ['Erklären, welche Schlüsse eine Grafik zulässt', 'Explain what conclusions a chart supports', 'Expliquer ce que permet de conclure un graphique', 'Spiegare quali conclusioni permette un grafico', 'Пояснити, які висновки підтверджує графік', 'شرح الاستنتاجات التي يدعمها الرسم البياني'],
    ],
    exercise: ['Vergleiche mit fiktiven Daten, welcher Anteil der Termine an zwei Standorten wahrgenommen wurde. Erläutere in einem Satz, was den Unterschied beeinflussen könnte.', 'Use fictional data to compare the share of appointments that were attended at two locations. In one sentence, explain what might account for the difference.', 'À partir de données fictives, compare la proportion de rendez-vous honorés sur deux sites. Indique en une phrase ce qui pourrait expliquer l’écart.', 'Usa dati fittizi per confrontare la quota di appuntamenti rispettati in due sedi. Spiega in una frase cosa potrebbe influire sulla differenza.', 'За вигаданими даними порівняй частку відвіданих зустрічей у двох місцях. Одним реченням поясни можливу причину різниці.', 'استخدم بيانات افتراضية لمقارنة نسبة حضور المواعيد في موقعين. اشرح بجملة واحدة ما قد يفسّر الفرق.'],
    source: 'https://www.berufsberatung.ch/de/aus-weiterbildungen/zuercher-hochschule-fuer-angewandte-wissenschaften-zhaw/data-analysis',
    sourceLabel: ['Berufsberatung Schweiz · Datenanalyse', 'Swiss career guidance · Data analysis', 'Orientation suisse · Analyse des données', 'Orientamento svizzero · Analisi dei dati', 'Профорієнтація у Швейцарії · Аналіз даних', 'التوجيه المهني في سويسرا · تحليل البيانات'],
  },
  'people-analytics': {
    skills: [
      ['Zusammengefasste Personalkennzahlen auswerten', 'Analyse aggregate staffing figures', 'Analyser des chiffres RH agrégés', 'Analizzare dati aggregati del personale', 'Аналізувати зведені показники про персонал', 'تحليل أرقام الموظفين المجمّعة'],
      ['Eine einfache Grafik erstellen und das Ergebnis erklären', 'Create a simple chart and explain the result', 'Créer un graphique simple et expliquer le résultat', 'Creare un grafico semplice e spiegare il risultato', 'Побудувати простий графік і пояснити результат', 'إنشاء رسم بياني بسيط وشرح النتيجة'],
      ['Vertrauliche Angaben zu Mitarbeitenden schützen', 'Protect confidential staff information', 'Protéger les informations confidentielles du personnel', 'Proteggere le informazioni riservate sul personale', 'Захищати конфіденційні відомості про працівників', 'حماية معلومات الموظفين السرية'],
    ],
    exercise: ['Berechne mit fiktiven Abteilungssummen den Anteil der Mitarbeitenden mit abgeschlossenem Kurs. Weise die Ergebnisse nur für Gruppen aus, die gross genug sind, um Einzelpersonen zu schützen.', 'Use fictional department totals to calculate the share of staff who completed a course. Report results only for groups large enough to protect individuals.', 'Utilise des totaux fictifs par service pour calculer la part du personnel ayant terminé un cours. Publie les résultats uniquement pour des groupes assez grands pour protéger les personnes.', 'Usa totali fittizi per reparto per calcolare la quota di persone che hanno completato un corso. Riporta i risultati solo per gruppi sufficientemente grandi da tutelare le persone.', 'За вигаданими підсумками відділів обчисли частку працівників, які закінчили курс. Покажи результати лише для достатньо великих груп, щоб захистити окремих людей.', 'استخدم مجاميع افتراضية للأقسام لحساب نسبة الموظفين الذين أكملوا دورة. اعرض النتائج فقط للمجموعات الكبيرة بما يكفي لحماية الأفراد.'],
    source: 'https://www.berufsberatung.ch/de/aus-weiterbildungen/fachhochschule-nordwestschweiz-fhnw/datenanalyse-im-hrm-einstieg-in-hr',
    sourceLabel: ['Berufsberatung Schweiz · Datenanalyse im Personalwesen', 'Swiss career guidance · People analytics', 'Orientation suisse · Analyse des données RH', 'Orientamento svizzero · Analisi dei dati HR', 'Профорієнтація у Швейцарії · Аналітика у сфері персоналу', 'التوجيه المهني في سويسرا · تحليل بيانات الموارد البشرية'],
  },
};
