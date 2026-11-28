Third-party files used by the Markooj website
=============================================

Everything here is copied from the npm packages that Markooj itself uses (unmodified,
except where noted below),
so the website never loads code from another server. Only the "Try it" preview uses them.

katex/    KaTeX 0.19.1 (katex.min.js, katex.min.css and the .woff2 fonts)
          https://github.com/KaTeX/KaTeX  MIT License, see katex/LICENSE.txt
          Loaded when the "Try it" preview comes into view.

marked/   Marked 16.4.2 (lib/marked.umd.js; only the source map line removed)
          https://github.com/markedjs/marked  MIT License, see marked/LICENSE.txt
          Loaded when the "Try it" preview comes into view.

mermaid/  Mermaid 12.3.0 (dist/mermaid.min.js)
          https://github.com/mermaid-js/mermaid  MIT License, see mermaid/LICENSE.txt
          It bundles other packages; their licenses are in mermaid/THIRD-PARTY-LICENSES.txt.
          elkjs inside it is used under GPL-3.0-or-later (mermaid/GPL-3.0.txt).
          Loaded only when someone clicks "Add a diagram" in the preview.

The website's own code (index.html, 404.html, style.css, main.js, fx.js, demo.js) is
Copyright (C) 2026 Ahmed Bilal and contributors, under the GNU AGPL v3 or later.
