"""Parser registry: source id -> parser.

A parser turns ALL raw documents of one source into clean numbers. It runs again whenever new documents
arrive, and its result replaces that source's observations, so parsers never need to track state.

Adding a parser for a source (once real sample documents exist):
1. Create app/transform/parsers/<name>.py with a function `parse(docs: list[Doc]) -> ParseOutput`.
2. Register it below:  PARSERS["<source id>"] = <name>.parse
3. Add a test with a real (anonymised, aggregated) sample in tests/.

Sources without a parser keep their documents as 'pending' until one is added.
"""
from ..base import Parser

PARSERS: dict[str, Parser] = {}
