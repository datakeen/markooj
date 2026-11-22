# Equations

Markooj has a visual equation editor that also speaks LaTeX. You can build an equation with the mouse, type it with shortcuts, or paste LaTeX, and both views stay in step.

## Insert an equation

1. Press **Alt+=**, or click **Insert → Equation** (also on the Home tab).
2. Type the equation in the top box. Shortcuts work as you type:

   | Type | You get |
   | --- | --- |
   | `/` | a fraction |
   | `^` | a power |
   | `_` | an index (subscript) |
   | `sqrt` | √ |
   | `alpha`, `beta` … | α, β … |
   | `sum`, `int` | ∑, ∫ |
   | `->`, `<=`, `!=` | →, ≤, ≠ |
   | Tab | the next box, for example from the top of a fraction to the bottom |

3. Or type LaTeX in the box below, for example `\frac{a}{b}`. Each box follows the other.
4. Press **Enter** (or click **Insert**). Esc cancels.

To change an equation later, double-click it on the page. The button then says **Update**.

## The palettes

The tabs above the editor hold ready-made pieces. Click one to put it in.

- **Basic:** fractions, roots, powers and indexes.
- **Big operators:** sums, products, integrals and limits.
- **Brackets:** brackets that grow with what is inside.
- **Matrix:** point to pick the number of rows and columns, and the bracket kind.
- **Accents:** hats, bars, dots and arrows over letters.
- **Greek**, **Symbols** and **Arrows**.
- **Units:** units set upright, with the right spacing.
- **Recent:** the equations you used lately. Click the star (Alt+F) to keep one as a favorite.

Ctrl+PageDown and Ctrl+PageUp move between the palette tabs, and Alt+1 to Alt+9 jump to one.

**Keyboard** (Alt+K) shows a math keyboard on the screen, handy on a touch screen. **Alt+H** shows the typing shortcuts.

## Inline or display

- **Inline** math sits inside a line of text, like *E = mc²*.
- **Display** math stands on its own line, centered, and can have a number.

Alt+D switches between them. In the file, inline math is written as `$…$` and display math as `$$ … $$`. If you prefer `\(…\)` for inline math, choose it in File → Options → Editor → Inline math style. Both always show.

## Numbered equations

For a display equation, switch on **Numbered** (Alt+N) and give it a **Label** (Alt+L), such as `shields`. The equation gets a number like (1) or (2.1) in the right margin, and you can refer to it by its label: "see Eq. (1)". The number updates by itself when equations move. In the file this is written as:

```
$$
\tau_c = \theta_c (\rho_s - \rho) g d_{50}
$$ {#eq:shields}
```

Numbers sit in a margin of their own, so they never overlap a long equation. To number every display equation, with or without a label, turn on **References → Number all equations**. More in [Numbering and cross-references](numbering-and-cross-references.md).

### Fixed numbers from other files

Equations that came with a typed number such as `\tag{3}` keep it. **References → Convert fixed equation numbers** turns them into labeled equations that renumber themselves.

## Your own commands

Tired of typing `\mathbb{R}`? Define `\R` once in **Developer → Math macros** and use it in every equation. See [Math macros](math-macros.md).

## In exports

Equations stay sharp in PDF and print. Word exports get real Word equations through Pandoc, LaTeX exports get the LaTeX as written, and EPUB gets MathML.
