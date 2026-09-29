"""Sentiment work currently runs in the ingestion use case.

The separate module remains the queue ownership boundary for a future evaluated model. The current
rules baseline is deterministic and stored in the same ingestion transaction.
"""
