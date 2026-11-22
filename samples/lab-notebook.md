---
title: Lab Notebook — Settling Column Tests
author: Hydraulics lab, bench 2
date: 2026-11-21
lang: en-US
---

# Settling column tests

## 2026-11-19 · Set-up

Filled the 2 m column with tap water at 20 °C. Sieved the sand into three fractions and dried each one overnight at 105 °C.

- [x] Column level checked
- [x] Thermometer calibrated
- [ ] Camera timing checked against the stopwatch

## 2026-11-21 · Fall velocity

Each grain was timed over the middle 1.5 m of the column.

| Trial | Fraction | Diameter (mm) | Time (s) | Velocity (m/s) |
|------:|:---------|--------------:|---------:|---------------:|
| 1 | fine | 0.25 | 41.7 | 0.036 |
| 2 | fine | 0.25 | 43.1 | 0.035 |
| 3 | medium | 0.50 | 21.4 | 0.070 |
| 4 | medium | 0.50 | 20.8 | 0.072 |
| 5 | coarse | 1.00 | 10.6 | 0.142 |
| 6 | coarse | 1.00 | 10.9 | 0.138 |

: Fall velocity of single grains {#tbl:fall}

The fall velocity of a small sphere follows Stokes' law, $w_s = \dfrac{\Delta\, g\, D^2}{18\,\nu}$, which only holds for the fine fraction.

## Python check

Select the code below and press **Ctrl+Alt+Enter** to run it, or save it as a macro from **Developer → Editor**.

```python
from markooj import doc
import re, statistics

rows = [l for l in doc.lines() if re.match(r"\|\s*\d+\s*\|", l)]
by_fraction = {}
for row in rows:
    cells = [c.strip() for c in row.strip("|").split("|")]
    by_fraction.setdefault(cells[1], []).append(float(cells[4]))

for name, v in by_fraction.items():
    print(f"{name:>7}: mean {statistics.mean(v):.3f} m/s from {len(v)} grains")
```

## To do

1. Repeat the fine fraction with deaired water.
2. Add a column for the particle Reynolds number.
