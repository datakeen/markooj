# Releasing a new version

A checklist for maintainers, so every release is complete. Version numbers follow [Semantic Versioning](https://semver.org/): a bug fix raises the last number (1.1.1), a new feature the middle one (1.2.0), and a change that can break documents, macros or add-ins the first one (2.0.0).

GitHub Actions builds the installers for Windows, macOS and Linux. Nothing has to be built on your own computer.

## 1. Prepare

1. Pull the latest code: `git pull`.
2. In `CHANGELOG.md`, rename **Unreleased** to the new version and today's date, for example `## [1.2.0] - 2027-01-15`. Add a fresh, empty **Unreleased** section above it, and the compare link at the bottom.
3. In `package.json`, set `"version"` to the same number. Markooj shows it in About and uses it in the file names. The release workflow stops if the tag and this number differ.
4. Check that the manual in `docs/help` still matches the app. The keyboard list in `docs/help/keyboard-shortcuts.md` comes from `app.keys.list()`; update it when shortcuts change.
5. If the app looks different, take new screenshots for `docs/images/` and the website (`site/`).

## 2. Check

```bash
npm ci
```

```bash
npm run fetch-tools
```

```bash
npm run smoke:report
```

Every test must pass. Look at the screenshots in `smoke-out/`. Then open the app (`npm start`) and try the new features once by hand.

## 3. Publish

```bash
git add .
```

```bash
git commit -m "Release 1.2.0"
```

```bash
git push
```

```bash
git tag -a v1.2.0 -m "Markooj 1.2.0"
```

```bash
git push origin v1.2.0
```

The tag starts the **Build installers** workflow (`.github/workflows/release.yml`). It builds on clean Windows, macOS and Linux machines at the same time, fetches Pandoc for each system (and on Windows also pdf2djvu and DjVuLibre with their source code), and makes:

- `Markooj-<version>-win-x64-setup.exe` and `Markooj-<version>-win-x64-portable.zip`
- `Markooj-<version>-mac-arm64.dmg` and `Markooj-<version>-mac-x64.dmg`
- `Markooj-<version>-linux-x86_64.AppImage`, `Markooj-<version>-linux-amd64.deb` and `Markooj-<version>-linux-x64.tar.gz`
- `Markooj-<version>-third-party-sources.zip` (the GPL source code of the bundled tools, with their licenses)
- `Markooj-<version>-SHA256SUMS.txt`

When all three systems are done, it publishes a GitHub Release named after the version, with a table of downloads and this version's part of `CHANGELOG.md` as its notes. It takes about 20 to 40 minutes. A tag with a hyphen, such as `v1.2.0-beta.1`, makes a pre-release instead. More about the build: [BUILDING.md](BUILDING.md).

If you build a release on your own computer instead, run `node scripts/fetch-tools.js --with-source` first (`npm run dist` does this on Windows) and keep the `vendor-src/` folder with that release: the notices promise the GPL source code of the bundled tools for three years.

## 4. Check the release

1. Open **Actions** on GitHub and wait for the green check on **Build installers**.
2. Open **Releases**. The release notes already hold the download table and this version's part of `CHANGELOG.md`. Click the pencil to change them if needed.
3. Download the installer for your system and try it once: start it, open a document, export a PDF and a Word file, and run **Check Bundled Tools** (Alt+Q).
4. Open the [website](https://datakeen.github.io/markooj/): its download buttons read the latest release.

## 5. SourceForge

The SourceForge project mirrors the GitHub releases on its own, so there is usually nothing to upload. After a release:

1. Open the project's **Files** page and check that a folder for the new version has appeared (this can take a few hours).
2. Click the **i** next to each main file and set the default download for its system: the setup `.exe` for Windows, the Apple-chip `.dmg` for macOS, the `.AppImage` for Linux.

Each release carries a `README.md` (built from `docs/downloads/README.md`, with the features and that version's What's new), so the mirror copies it and SourceForge shows it under the file list. If the mirror is not set up, upload the files and that `README.md` by hand into a folder named after the version.

## Language packs

Language packs live in their own repository, [datakeen/markooj-language-packs](https://github.com/datakeen/markooj-language-packs), and have their own release, tagged `packs`. Markooj reads `index.json` from that release when someone clicks **Check for language packs**.

Packs are released on their own, not with Markooj:

1. Change the word lists or rules in that repository, and raise the pack's `version` in its `pack.json` when its contents changed.
2. Push to `main` (or merge a pull request). The **Publish packs** workflow checks every pack, builds the zips and `index.json`, and uploads them to the `packs` release, replacing the old files.

Markooj checks every file against the SHA-256 in `index.json`, so the zips and `index.json` are always published together. To publish by hand, open **Actions → Publish packs → Run workflow**.

## With each Markooj update

The language work is split into 20 parts, listed in the [language packs roadmap](https://github.com/datakeen/markooj-language-packs/blob/main/ROADMAP.md). Each Markooj update includes the next part. When a part is done, mark it done in that roadmap and in [ROADMAP.md](../ROADMAP.md).

## If something goes wrong

- **The workflow failed.** Open the run in **Actions** and read the first red step. Fix the cause, delete the tag (`git tag -d v1.2.0`, then `git push origin :refs/tags/v1.2.0`), and tag again. Or open **Actions → Build installers → Run workflow** and pick the tag: it makes that tag's release again.
- **One system failed and the others worked.** No release is published until all three are done. Fix the cause and run the workflow again on the tag.
- **A release has old files.** The workflow replaces files with the same name, so running it again is safe.
- **A published release has a bad file.** Never replace a published file silently. Fix it in a new patch version (for example 1.2.1) and say so in the changelog.
