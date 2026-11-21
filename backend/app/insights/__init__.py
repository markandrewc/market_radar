"""The plain-language reading (docs/api.md "Insights (the plain-language reading)").

`templates.py` holds the sentence rules, `service.py` assembles the insights and the
home-page overview from the stored rows, `taxonomy.py` the curated policy knowledge.

The package is intentionally import-light: `from app.insights import taxonomy` must not drag
in the query layer, so the router and the digest can import exactly what they need.
"""
from . import taxonomy

__all__ = ["taxonomy"]
