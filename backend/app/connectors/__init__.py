"""Config-driven connectors: sources.yaml -> adapters -> market_items.

- ``config``  reads and validates sources.yaml (docs/ADDING_SOURCES.md)
- ``base``    shared plumbing for all adapters (fetch, field mapping, MarketItem)
- adapters    rest_api, rss_atom, csv_url - each returns normalised MarketItems
"""
