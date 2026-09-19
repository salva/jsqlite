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


# The living guide's current summary must admit only the represented ordinary
# aggregate-window subset and preserve the residual atomic prepare boundary.
summary = section(translation, "## Authority and use", "## Core:")
assert "represented aggregate-window surface" in summary
assert "default and explicit ROWS/RANGE/GROUPS frames" in summary
assert "represented join/group/derived/CTE/outer-order compositions" in summary
assert re.search(r"Residual CTE and window compositions .* remain atomic typed", summary, re.S)
assert "ranking and\nvalue special built-ins" in summary

# Current API sections may not repeat the preimplementation blanket claim. The
# bounded positive contract and the two residual classes must be stated together.
aggregate = section(api, "### Aggregate SELECT tranche", "### Bounded grouped SELECT DISTINCT")
derived = section(api, "## Bounded FROM-derived and immutable-view surface", "### Expression subqueries")
execution = section(api, "### Aggregate-window execution (2026-09-19)", "\n---\n") if "\n---\n" in api[api.index("### Aggregate-window execution (2026-09-19)"):] else api[api.index("### Aggregate-window execution (2026-09-19)"):]

blanket = re.compile(
    r"\bWindows?\s*,.{0,220}?remain(?:s)? (?:future scope|unsupported)",
    re.I | re.S,
)
assert not blanket.search(aggregate), "current Aggregate SELECT tranche still blanket-rejects windows"
assert "represented bounded aggregate-window surface" in derived
assert "Ranking/value special built-ins, unrepresented window\ncompositions" in derived
assert "fail atomically" in derived
assert "represented ordinary aggregate-window subset is executable" in execution
assert "Unsupported\ncompositions reject atomically at prepare" in execution
assert "This does not admit ranking or value\nspecial built-ins" in execution

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
