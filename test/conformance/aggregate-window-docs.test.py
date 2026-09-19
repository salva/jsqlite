#!/usr/bin/env python3
"""Guard current aggregate-window contract wording without rewriting history."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
translation = (ROOT / "docs/TRANSLATION.md").read_text(encoding="utf-8")
api = (ROOT / "docs/api.md").read_text(encoding="utf-8")


def section(text: str, heading: str, next_heading: str) -> str:
    start = text.index(heading)
    end = text.index(next_heading, start + len(heading))
    return text[start:end]


# The living guide's current summary must admit the represented ordinary and
# special built-in window subsets and preserve the residual atomic boundary.
summary = section(translation, "## Authority and use", "## Core:")
summary_words = " ".join(summary.split())
assert "represented aggregate-window surface" in summary_words
assert "default and explicit ROWS/RANGE/GROUPS frames" in summary_words
assert "represented join/group/derived/CTE/outer-order compositions" in summary_words
assert re.search(r"Residual CTE and window compositions .* remain atomic typed", summary_words)
assert (
    "all eleven pinned ranking, distribution, offset, and value special built-ins"
    in summary_words
)

# Current API sections may not repeat the preimplementation blanket claim. The
# bounded positive contract and the two residual classes must be stated together.
aggregate = section(api, "### Aggregate SELECT tranche", "### Bounded grouped SELECT DISTINCT")
derived = section(api, "## Bounded FROM-derived and immutable-view surface", "### Expression subqueries")
execution = section(api, "### Aggregate-window execution (2026-09-19)", "\n---\n") if "\n---\n" in api[api.index("### Aggregate-window execution (2026-09-19)"):] else api[api.index("### Aggregate-window execution (2026-09-19)"):]

aggregate_words = " ".join(aggregate.split())
derived_words = " ".join(derived.split())
execution_words = " ".join(execution.split())

blanket = re.compile(
    r"\bWindows?\s*,.{0,220}?remain(?:s)? (?:future scope|unsupported)",
    re.I | re.S,
)
assert not blanket.search(aggregate), "current Aggregate SELECT tranche still blanket-rejects windows"
assert "represented bounded aggregate-window surface" in derived_words
assert "Unrepresented window compositions" in derived_words
assert "fail atomically" in derived_words
assert "represented ordinary aggregate-window subset is executable" in execution_words
assert "Unsupported compositions reject atomically at prepare" in execution_words
assert "Special built-ins use the separately bounded execution contract below" in execution_words

# Preserve the explicitly historical checkpoint: the guard must distinguish it
# from current contract prose rather than deleting useful preimplementation facts.
historical = section(
    api,
    "## Window rewrite/setup historical boundary (2026-09-18; superseded for aggregate execution)",
    "### Aggregate-window execution (2026-09-19)",
)
assert "they are not the current\naggregate-window capability statement" in historical
assert "window functions are not implemented" in historical
assert "Aggregate-window preimplementation boundary (historical)" in historical

print("aggregate-window docs: bounded current admission, residual atomic rejection, historical checkpoints preserved")
