# Math macros

Math macros are your own short names for LaTeX you type often. Define `\R` once, and every `\R` in every equation shows as ℝ.

## Define a macro

1. Click **Developer → Math macros**.
2. Choose where the macros live:
   - **All documents:** kept in Markooj and used in every document.
   - **This document:** saved in this file's front matter (as `math-macros`), so they travel with the file.

   If both define the same name, This document wins.
3. Type or paste the definitions, one or more per line. The preview shows each one as you type.
4. Click **Save**.

For example:

```latex
\newcommand{\R}{\mathbb{R}}
\newcommand{\vect}[1]{\mathbf{#1}}
\DeclareMathOperator{\Var}{Var}
```

Now `$x \in \R$`, `$\vect{v}$` and `$\Var(X)$` work in every equation.

## What Markooj understands

Paste definitions the way you have them in a LaTeX preamble:

- `\newcommand`, `\renewcommand`, `\providecommand` and `\DeclareRobustCommand`
- `\def`, `\gdef`, `\edef`, `\xdef` and `\let`
- `\DeclareMathOperator` and `\DeclareMathOperator*`
- Arguments: `[2]` for two arguments, and `[2][default]` for an optional first one
- Several definitions on one line, `%` comments, and definitions that run over several lines

If a line has extra text after a definition, as in `\newcommand{\R}{\mathbb{R}}$\R$`, Markooj still defines `\R`, points out the extra text, and offers **Remove the extra text**. A line it cannot use gets a plain message that says why.

## The examples gallery

The **Examples** panel lists ready-made macros. Each shows what it does, what to type and how the result looks. Click **Add** to put one in your list.

| Macro | What it is | Type |
| --- | --- | --- |
| `\R`, `\N`, `\Z`, `\Q`, `\C` | The number sets ℝ, ℕ, ℤ, ℚ, ℂ | `x \in \R` |
| `\vect` | A vector in bold | `\vect{v}` |
| `\abs`, `\norm` | Absolute value and norm, with bars that grow | `\abs{x - y}` |
| `\set` | A set in braces that grow | `\set{1, 2, 3}` |
| `\inner` | Inner product of two vectors | `\inner{u}{v}` |
| `\dd` | An upright d for integrals | `\int f(x)\,\dd x` |
| `\pdv` | Partial derivative | `\pdv{f}{x}` |
| `\grad` | Gradient (nabla) | `\grad f` |
| `\E`, `\Var`, `\Cov` | Expectation, variance, covariance | `\Var(X) = \sigma^2` |
| `\given` | The bar in a conditional probability | `P(A \given B)` |
| `\tr`, `\T` | Trace and transpose | `A\T x` |
| `\argmin`, `\argmax` | Arg min and arg max | `\argmin_{x} f(x)` |
| `\order` | Big O | `\order{n \log n}` |
| `\unit` | A unit after a number, upright with a thin space | `9.81\unit{m/s^2}` |
| `\degree` | Degree sign | `90\degree` |
| `\eps` | Short for the curly epsilon | `\eps > 0` |

## In exports

Your macros go with the document when you export. Word, LaTeX and the other Pandoc formats get them as `\newcommand` lines, so the equations come out right there too.
