# Fall velocity summary: a Markooj Python macro.
# Open lab-notebook.md, then run this from Developer -> Editor (Ctrl+Enter).
# It reads the fall-velocity table and adds a summary under it.
from markooj import doc, ui
import re
import statistics

rows = [line for line in doc.lines() if re.match(r"\|\s*\d+\s*\|", line)]
groups = {}
for row in rows:
    cells = [c.strip() for c in row.strip().strip("|").split("|")]
    groups.setdefault(cells[1], []).append(float(cells[4]))

lines = ["", "**Summary (macro)**", ""]
for name, values in groups.items():
    spread = statistics.stdev(values) if len(values) > 1 else 0.0
    mean = statistics.mean(values)
    lines.append(f"- {name}: mean {mean:.3f} m/s, spread {spread:.3f} m/s")
    print(f"{name:>7}: {mean:.3f} m/s from {len(values)} grains")

marker = ": Fall velocity of single grains {#tbl:fall}"
if marker in doc.text and "**Summary (macro)**" not in doc.text:
    doc.text = doc.text.replace(marker, marker + "\n" + "\n".join(lines))
    ui.toast(f"Added a summary for {len(groups)} fractions")
else:
    ui.toast("The summary is already there")
