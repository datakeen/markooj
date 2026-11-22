# Contributing to Markooj

Thank you for helping. Bug reports, fixes, add-ins, language packs, help pages and ideas are all welcome. Small, focused changes are the easiest to review.

For feedback or a bug, please [open an issue](https://github.com/datakeen/markooj/issues). There is no need to email. Inside Markooj, **Help → Report a Problem** opens a new issue for you.

## Reporting bugs

Please include:

- the Markooj version (Help → About Markooj → Copy Version Info) and your system (Windows, macOS or Linux, and its version);
- which download you use (installer, portable zip, `.dmg`, AppImage, `.deb` or `.tar.gz`);
- the steps that lead to the problem, what you expected, and what happened;
- a screenshot, and if you can, a small Markdown file that shows the problem.

If the problem is about a converted file (Word, PDF, LaTeX …), a small sample file helps a lot. Leave out anything private.

## Getting started

1. Fork the repository and clone your fork.
2. Run `npm ci`, then `npm run fetch-tools`, then `npm start`. Details are in [docs/BUILDING.md](docs/BUILDING.md).
3. Read [ARCHITECTURE.md](ARCHITECTURE.md). It says which file owns what, and how the parts talk to each other through `window.app` and `window.mk`.
4. Make your change.
5. Run the smoke test: `npm run smoke:report`. Every test must pass. Look at the screenshots in `smoke-out/`.
6. Open a pull request that says what you changed and why. Screenshots of interface changes help.

## Where things go

- **A new feature for some people:** often best as an add-in. See [docs/ADDINS.md](docs/ADDINS.md). Publish it from your own repository, starting from the [add-in template](https://github.com/datakeen/markooj-addin-template), and ask for it to be listed in the add-in store with a pull request to [datakeen/markooj-addins](https://github.com/datakeen/markooj-addins/blob/main/SUBMITTING.md). A good add-in can later move into Markooj.
- **A new command or ribbon button:** register a command with a `label` and a `description` (it becomes the ScreenTip), and put the button in the ribbon group of the module that owns the tab. Every button runs a command, so it also works from the keyboard, the command search, macros and the recorder.
- **Words, rules and new languages:** these live in the [language packs repository](https://github.com/datakeen/markooj-language-packs). Its word lists and rules are plain spreadsheet files, and its [guide for helpers](https://github.com/datakeen/markooj-language-packs/blob/main/CONTRIBUTING.md) explains every step, with no coding needed. Native speakers of Urdu, Arabic and Punjabi are especially welcome.
- **The manual:** `docs/help/*.md`. Keep every page true to the app as it is, and keep links relative.

## Style

- **Plain JavaScript.** No bundler and no framework. Files in `src/` load with `<script>` tags in the order listed in `ARCHITECTURE.md`.
- **Safety:** the window has `contextIsolation` on and `nodeIntegration` off. The page reaches the computer only through `window.mk` in `preload.js`. Rendered HTML is always sanitized. No network access unless the user asks for it.
- **Markdown first:** every edit goes through the Markdown text, so the file stays byte-for-byte the same outside the part that changed, and undo, recovery and every mode stay in step.
- **Interface text:** short, plain and friendly, in US English (color, center, license), with Word's names where Word has the same thing. No jargon where an everyday word works.
- **Tests:** add `app.tests.register('area: what it checks', …)` for what you change.

## Code of conduct

Be kind and patient. Assume good intent, explain instead of judging, and remember that many people here write in their second or third language.

## License of contributions

Markooj is under the [GNU Affero General Public License](LICENSE), version 3 or any later version. By sending a pull request, you agree that your contribution is licensed the same way.

Bundled programs, libraries, dictionaries and fonts keep their own licenses (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). If your change adds a dependency, say so in the pull request, and choose one whose license allows it to ship inside an AGPL v3 program (MIT, BSD, ISC, Apache-2.0 and MPL-2.0 do; GPL-2.0-only code does not, unless it stays a separate program that Markooj runs as a tool).
