"""Parser registry: source id (as in latest.json) -> parser.

A parser reads the latest downloaded file of one source and returns roles and observations (job market
numbers) or items (context data such as asylum and residence statistics, category D). Months in its result
replace those months in the database; older months stay, so the database keeps its own history even if a source
only publishes the latest month. Parsers never need to track state.

Adding a parser:
1. Create app/normalize/parsers/<name>.py with `parse(f: RawFile) -> ParseOutput`.
2. Register it below.
3. Add a test with a small real excerpt of the file in tests/fixtures/.

Files of sources without a parser are recorded as 'no_parser' and change nothing on the dashboard.
"""
from ..base import Parser
from . import bfs_besta, itboard, sem_asylum, sem_immigration, sem_provisional, sem_status_s

PARSERS: dict[str, Parser] = {
    "itboard-monthly": itboard.parse,
    # BFS/SEM tables are context data (asylum, residence permits, vacancies by branch): they become
    # MarketItems of category D instead of role observations.
    "bfs-besta-regions": bfs_besta.parse,
    "sem-asylum-applications": sem_asylum.parse,
    "sem-immigration-canton-nationality": sem_immigration.parse,
    "sem-provisional-employment": sem_provisional.parse,
    "sem-status-s-monthly": sem_status_s.parse,
}
