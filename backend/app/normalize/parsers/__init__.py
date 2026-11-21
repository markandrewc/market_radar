"""Parser registry: source id (as in latest.json) -> parser.

A parser reads the latest downloaded file of one source and returns roles and observations. Months in its result
replace those months in the database; older months stay, so the database keeps its own history even if a source
only publishes the latest month. Parsers never need to track state.

Adding a parser:
1. Create app/normalize/parsers/<name>.py with `parse(f: RawFile) -> ParseOutput`.
2. Register it below.
3. Add a test with a small real excerpt of the file in tests/fixtures/.

Files of sources without a parser are recorded as 'no_parser' and change nothing on the dashboard.
"""
from ..base import Parser
from . import itboard

PARSERS: dict[str, Parser] = {
    "itboard-monthly": itboard.parse,
}
