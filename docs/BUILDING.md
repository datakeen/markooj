# Building Markooj

How to run Markooj from source, test it, and build the installers for Windows, macOS and Linux. Release builds are made by GitHub Actions; you can still build on your own computer.

## What you need

- Windows 10 or 11, macOS 12 or later, or a 64-bit Linux.
- [Node.js](https://nodejs.org) 22 (the version the workflows use; 20 or newer should work).
- [Git](https://git-scm.com).
- About 2 GB of free disk space for the packages, the bundled tools and a build.

## Run from source

```bash
git clone https://github.com/datakeen/markooj.git
```

```bash
cd markooj
```

```bash
npm ci
```

```bash
npm run fetch-tools
```

```bash
npm start
```

`npm ci` installs the exact package versions in `package-lock.json`. `npm run fetch-tools` downloads the official tool builds for your computer, checks their SHA-256, and writes their license texts into `licenses/`:

- on Windows: Pandoc, DjVuLibre and pdf2djvu, into `vendor/win32/`;
- on macOS and Linux: Pandoc, into `vendor/darwin-arm64/`, `vendor/darwin-x64/` or `vendor/linux-x64/`. Install the DjVu tools with your package manager (`brew install djvulibre pdf2djvu`, or `sudo apt install djvulibre-bin pdf2djvu`); Markooj finds them on the PATH.

Without the tools, Markooj still runs, but the Pandoc and DjVu formats are missing (Markooj says so at start).

There is no build step: `main.js`, `preload.js` and the plain JavaScript in `src/` run as they are. Edit a file, then close Markooj and run `npm start` again.

### A throwaway profile

To try things without touching your real settings, recovered text and add-ins, point Markooj at an empty folder:

```bash
set MARKOOJ_USER_DATA=C:\temp\markooj-test
npx electron .
```

(In Git Bash, PowerShell, macOS or Linux, set the variable the way that shell does.)

DevTools open with Ctrl+Shift+I.

## Project layout

```
main.js                 the main process: windows, files, conversions, bundled tools, recovery, settings, smoke test
main-langpacks.js       language pack download, checks and install (pack format 1 and 2)
preload.js              the bridge to the page (window.mk): Markdown rendering, HTML to Markdown, spelling
src/                    the app: index.html, core.js (window.app), shell, editors, ribbon tabs, research tools …
src/writing/            the Writing Assistant: rules, Harper worker, spelling, near-miss spelling, user interface, tests
addons/                 the add-ins that ship with Markooj
data/                   the offline thesaurus (built by scripts/make-thesaurus.js)
fonts/                  bundled Urdu, Arabic and Persian fonts (SIL OFL)
csl/                    citation styles for Pandoc exports
docs/help/              the offline manual (shown with F1)
licenses/               license texts of bundled components
scripts/                fetch-tools.js, make-thesaurus.js, smoke.js
build/                  icons and the portable-zip hook for electron-builder
site/                   the website, published to https://datakeen.github.io/markooj/
.github/workflows/      check.yml (checks), release.yml (installers), pages.yml (website)
```

The contract between the modules (who owns which file, the `app` API, IPC channels, events and settings) is in [ARCHITECTURE.md](../ARCHITECTURE.md). Read it before a larger change.

## Tests

Markooj has one built-in smoke test that runs every module's tests inside the real app, exports a sample paper to every format, and takes screenshots.

```bash
npm run smoke:report
```

It writes into `smoke-out/` and prints PASS or FAIL for each test. To use another folder, or to run the app directly:

```bash
npx electron . --smoke smoke-out-mine
```

While you work on one part, run only its tests (no exports, no screenshots of other parts):

```bash
npx electron . --smoke smoke-out-mine --smoke-only "^writing:"
```

The window stays hidden; the exit code is 0 when everything passed. Results are in `smoke.json`, and the screenshots are PNG files in the same folder. Look at them: a test can pass while something looks wrong. Smoke runs always use their own settings folder inside the output folder, so they never touch your real settings.

Use a folder name relative to the project, as above, or a full Windows path. In Git Bash, a path such as `/out` turns into a folder under Git's own install folder.

To add a test, call `app.tests.register('area: what it checks', async () => { … })` in the module you changed. See [ADDINS.md](ADDINS.md#tests).

## Data files

These are in the repository already. Rebuild them only when you change their sources:

```bash
node scripts/make-thesaurus.js       # data/thesaurus-en.json from WordNet (node_modules/wordnet-db)
```

```bash
npm run icon                          # draws build/icon.svg, icon.png and icon.ico
```

```bash
npm run notices                       # THIRD_PARTY_NOTICES.md and licenses/npm-licenses.txt
```

## Build with GitHub Actions (the usual way)

Release builds are made on clean machines by `.github/workflows/release.yml`, so nothing has to be built on your own computer. Push a tag such as `v1.1.0`:

```bash
git tag -a v1.1.0 -m "Markooj 1.1.0"
```

```bash
git push origin v1.1.0
```

The workflow builds on Windows, macOS and Linux at the same time, checks every file name, and publishes a GitHub Release for the tag with these files:

| File | System |
| --- | --- |
| `Markooj-<version>-win-x64-setup.exe` | Windows installer |
| `Markooj-<version>-win-x64-portable.zip` | Windows, no install |
| `Markooj-<version>-mac-arm64.dmg` | macOS, Apple chip |
| `Markooj-<version>-mac-x64.dmg` | macOS, Intel |
| `Markooj-<version>-linux-x86_64.AppImage` | Linux, most distributions |
| `Markooj-<version>-linux-amd64.deb` | Debian and Ubuntu |
| `Markooj-<version>-linux-x64.tar.gz` | Linux, no install |
| `Markooj-<version>-third-party-sources.zip` | The GPL source code of the bundled tools |
| `Markooj-<version>-SHA256SUMS.txt` | Checksums of every file |

It takes about 20 to 40 minutes. **Actions → Build installers → Run workflow** on a branch builds the same files and keeps them with the run (open the run, then **Artifacts**) without making a release. See [RELEASING.md](RELEASING.md).

Two other workflows run on their own: **Check** (`check.yml`) on pushes to `main` and on pull requests, and **Publish website** (`pages.yml`) when something under `site/` changes on `main`.

## Build on your own computer

Local builds still work. Each system builds its own installers:

| On | Command | Files in `dist/` |
| --- | --- | --- |
| Windows | `npm run dist:win` | installer and portable zip |
| macOS | `npm run dist:mac` | both disk images (or `dist:mac:arm64`, `dist:mac:x64`) |
| Linux | `npm run dist:linux` | AppImage, `.deb` and `.tar.gz` |

Each command fetches the tools for that system first, then runs electron-builder. On Windows:

| File | What it is |
| --- | --- |
| `Markooj-<version>-win-x64-setup.exe` | The installer. Users can choose the folder; it adds Start menu and desktop shortcuts and opens Markdown files. |
| `Markooj-<version>-win-x64-portable.zip` | The portable copy. Unzip anywhere and run `Markooj.exe`. A `portable.txt` file inside tells Markooj to keep its settings in a `data` folder next to it. |

`npm run dist` (Windows) also downloads the GPL source code of Pandoc, DjVuLibre and pdf2djvu into `vendor-src/`, which a public release must offer. `npm run pack` builds an unpacked folder (`dist/win-unpacked/`) without an installer, which is quicker for a test.

**Build from a quiet folder.** electron-builder can write a broken app archive if files change while it packs (for example while an editor saves, or a smoke test writes). Close other tools first, or build from a fresh copy of the folder.

### Check a build

1. Install it, or unzip the portable zip into a new folder.
2. Start it and open **File → Save As / Export**: the Pandoc formats must be there (and the DjVu formats on Windows).
3. Press **Alt+Q** and run **Check Bundled Tools**.
4. On Windows, run the packaged app's smoke test: `dist\win-unpacked\Markooj.exe --smoke C:\temp\smoke-packaged`.

## Language packs

The language packs are built in their own repository, [datakeen/markooj-language-packs](https://github.com/datakeen/markooj-language-packs), not here. Its word lists and rules are plain TSV files that people edit in a spreadsheet. On every push to its `main` branch, GitHub Actions checks every pack, builds the zips and `index.json`, and publishes them to the release tagged `packs`, where Markooj downloads them:

```
https://github.com/datakeen/markooj-language-packs/releases/download/packs/index.json
```

To build the packs on your own computer, clone that repository and run `npm ci`, then `npm run build`. Its README and `docs/FORMAT.md` explain the format.

## Code signing (optional)

The builds are not code-signed, so Windows SmartScreen and macOS Gatekeeper ask once before the first start. To sign the Windows builds, buy a Windows code-signing certificate, add it to the repository's secrets as `CSC_LINK` (the base64 `.pfx`) and `CSC_KEY_PASSWORD`, and remove `CSC_IDENTITY_AUTO_DISCOVERY: "false"` from `release.yml`. Signing and notarizing for macOS needs an Apple Developer account. The [electron-builder signing guide](https://www.electron.build/code-signing) has the details.
