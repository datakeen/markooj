# Download Markooj

Markooj is a Markdown editor that works like Microsoft Word. You click and type on a page with a ribbon you already know, and Markooj writes plain Markdown for you. It has a visual equation editor, numbered equations, figures and tables with cross-references, citations from BibTeX, an offline Writing Assistant, right-to-left writing for Urdu, Arabic, Persian and Punjabi (Shahmukhi), Python and JavaScript macros, and export to PDF, Word, EPUB, LaTeX and many more formats. Free and open source, for Windows, macOS and Linux, and everything runs on your own computer.

Website: [datakeen.github.io/markooj](https://datakeen.github.io/markooj/)

## Which file do I need?

In the file names below, `x.y.z` is the version number, for example `1.1.0`.

| Your computer | Download | Notes |
| --- | --- | --- |
| **Windows 10 or 11** (most PCs) | `Markooj-x.y.z-win-x64-setup.exe` | The usual choice on Windows. Run it and follow the steps. |
| Windows, without installing | `Markooj-x.y.z-win-x64-portable.zip` | Unzip the whole zip into a folder (or a USB drive) and run `Markooj.exe`. Settings stay in a `data` folder next to it. |
| **Mac with an Apple chip** (M1, M2, M3, M4 and later) | `Markooj-x.y.z-mac-arm64.dmg` | Most Macs from late 2020 on. |
| Mac with an Intel chip | `Markooj-x.y.z-mac-x64.dmg` | Older Macs. Not sure? Click the Apple menu → **About This Mac**: it says **Chip** (Apple) or **Processor** (Intel). |
| **Linux** (most distributions) | `Markooj-x.y.z-linux-x86_64.AppImage` | One file that runs on most 64-bit Linux systems. |
| Debian, Ubuntu, Linux Mint | `Markooj-x.y.z-linux-amd64.deb` | Installs Markooj with the rest of your programs. |
| Linux, without installing | `Markooj-x.y.z-linux-x64.tar.gz` | A plain folder to unpack anywhere. |

You do not need `Markooj-x.y.z-third-party-sources.zip`. It holds the source code of Pandoc, DjVuLibre and pdf2djvu, which Markooj includes, for anyone who wants it. `Markooj-x.y.z-SHA256SUMS.txt` lists the checksums of every file.

## System needs

- Windows 10 or 11, 64-bit; macOS 12 (Monterey) or later; or a 64-bit Linux.
- About 1 GB of free disk space.
- No internet connection is needed. Pandoc, Python and the spelling and grammar checks are all inside. On Windows, the DjVu tools are inside too.

## Installing

### Windows

**Installer:** run `Markooj-x.y.z-win-x64-setup.exe`. You can choose the folder. It adds Markooj to the Start menu and the desktop, and Markdown files open in it with a double-click. To remove it later, use **Settings → Apps** in Windows.

**Portable zip:** right-click the zip, choose **Extract All…**, and pick a folder. Run `Markooj.exe` inside it. Keep the whole folder together: Markooj needs the `resources` folder beside it. To remove it, delete the folder.

### macOS

Open the `.dmg` file and drag **Markooj** onto the **Applications** folder. Then open Markooj from Applications. To remove it, drag it from Applications to the Trash.

### Linux

**AppImage:** right-click the file, open **Properties → Permissions**, and tick **Allow executing file as program** (or run `chmod +x Markooj-x.y.z-linux-x86_64.AppImage`). Then double-click it.

**Debian and Ubuntu:** double-click the `.deb` file to open it in your software center, or run:

```
sudo apt install ./Markooj-x.y.z-linux-amd64.deb
```

**tar.gz:** unpack it into a folder and run `markooj` inside it.

**DjVu files** on macOS and Linux need the DjVu tools from your package manager. Everything else works without them.

```
brew install djvulibre pdf2djvu
```

```
sudo apt install djvulibre-bin pdf2djvu
```

## The first start

The files are not code-signed yet, so your system may ask once:

- **Windows:** "Windows protected your PC". Click **More info**, then **Run anyway**.
- **macOS:** "Markooj cannot be opened" or "Apple could not check it". Right-click Markooj in Applications and choose **Open**, then **Open** again. On newer macOS versions, open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to Markooj.

## Checking the download

If you want to be sure a file arrived complete and unchanged, compare its SHA-256 checksum with the one in `Markooj-x.y.z-SHA256SUMS.txt` on the release page.

On Windows, in Command Prompt:

```
certutil -hashfile Markooj-x.y.z-win-x64-setup.exe SHA256
```

On macOS and Linux, in Terminal:

```
shasum -a 256 Markooj-x.y.z-mac-arm64.dmg
```

## Language packs

Urdu, Arabic, Punjabi (Shahmukhi) and Persian spelling and writing checks come as small language packs. In Markooj, open **File → Options → Language** and click **Check for language packs**. The packs are published in [their own repository](https://github.com/datakeen/markooj-language-packs).

## Getting started

Open Markooj and press **F1**. The Help has a getting started guide, step-by-step tutorials and a reference for everything. It works offline.

## More

- Website: [datakeen.github.io/markooj](https://datakeen.github.io/markooj/)
- Source code and every release: [github.com/datakeen/markooj](https://github.com/datakeen/markooj)
- What changed in each version: [changelog](https://github.com/datakeen/markooj/blob/main/CHANGELOG.md)
- Found a bug, or have an idea? [Open an issue](https://github.com/datakeen/markooj/issues)

Markooj is free and open source software under the [GNU Affero General Public License, version 3 or later](https://github.com/datakeen/markooj/blob/main/LICENSE). The programs and fonts it includes keep their own licenses.
