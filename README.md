# Market Radar for Powercoders

An evidence dashboard for people who plan training and support internships. Start with the guided tour, then choose an IT role and open the original figures behind the chart.

## Run locally

```sh
npm ci
npm run dev:web
```

For a production build, run `npm run typecheck` and `npm run build`. `npm run preview` serves the build. The dashboard uses included data and needs no credentials or external service to render.

## Sources

- Role demand, overall skill mentions and junior figures come from the [ITBoard monthly CSV](https://www.itboard.ch/arbeitsmarkt/daten.csv) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Values cover the portal's Swiss samples. Missing role observations remain gaps. The import keeps the publisher's cutoff separate from retrieval time.
- Skills by role are dated observations of the public ITBoard profiles for [IT Support](https://www.itboard.ch/rollen/it-support), [Fullstack Development](https://www.itboard.ch/rollen/fullstack-developer) and [Data Engineering](https://www.itboard.ch/rollen/data-engineer). The time comparison uses mentions in each full monthly sample. The suggested exercises are examples for the training team to review.
- Work-access notices use [SEM guidance](https://www.sem.admin.ch/de/arbeit-asylbereich), the [ordinance published on Fedlex](https://www.fedlex.admin.ch/eli/oc/2025/669/de) and the [parliamentary committee update](https://www.parlament.ch/press-releases/Pages/mm-spk-s-2026-11-06.aspx?lang=1031). Each notice identifies the applicable stage and date. Editors check the primary sources before adding an update.

Run `node scripts/import-itboard.mjs` to refresh the monthly CSV and verified cutoff dates. The data is bundled at build time. The role-profile snapshots and policy entries are curated. Other sources listed on the page are links for reference.
