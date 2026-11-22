# Markooj roadmap

Markooj aims to make writing in Markdown as easy as writing in Word, for anyone who has used Word, and especially for people who write research. Writing should feel calm, and the app should quietly help the writing get better.

These are the directions the project is heading in. They are not promises, and there are no dates.

## More computers

- The DjVu tools inside the macOS and Linux copies too, as they are on Windows.
- Code-signed installers, so Windows and macOS no longer ask on the first start.
- Updates that Markooj can tell you about, only if you want it to.

## Languages

Urdu, Arabic (Saudi Arabia, Modern Standard), Punjabi (Shahmukhi) and Persian come as language packs from their own repository, [datakeen/markooj-language-packs](https://github.com/datakeen/markooj-language-packs). The work is split into 20 parts of about the same size, and the plan is to finish about one part with each Markooj update. Careful beats fast: a part may move when native-speaker review takes longer.

- **Done in 1.1.0 (parts 1 and 2):** the packs repository, a pack format that people can edit in a spreadsheet, automatic checks and builds, and starter packs for Urdu, Arabic and Punjabi with near-miss spelling, letter and punctuation checks, common misspellings and style hints. Persian moved there. Urdu also gained full spelling with about 95,000 words from the CLE Urdu word list.
- **Aarab (parts 3 and 4):** add or remove zabar, zer, pesh, shadd, jazm and the other marks with one click, for a selection or the whole document; add aarab from the word list; Find that ignores aarab.
- **Roman typing (parts 5 and 6):** type in Roman letters and pick the word from five or more suggestions, as with pinyin, in Urdu, Arabic and Punjabi.
- **Bigger word lists and grammar (parts 7 to 12):** a native-speaker review of the CLE Urdu words and Urdu plural, oblique and verb forms, about 15,000 words for Arabic and 10,000 for Punjabi, then grammar checks for each language, such as کا، کی، کے agreement in Urdu and hamza seats in Arabic.
- **Community review (part 13):** a review page where native speakers approve or fix words without coding, and credits for reviewers.
- **Quran add-in (parts 14 to 17):** an optional add-in in its own repository, `datakeen/markooj-quran`, installed from the add-in store like any other add-in. Find an ayah by reference or by a few words in Arabic, Roman letters, Urdu or English, and insert it with a translation that may be shared freely and a citation. It is not part of Markooj itself.
- **Better writing, typing comfort and quality (parts 18 to 20):** formal and informal register, "Why?" explanations in Urdu, Arabic and Punjabi, on-screen keyboards, digits and Hijri dates, test sentences for every language, and a limit on false alarms.

The full list of parts and their status is in the [language packs roadmap](https://github.com/datakeen/markooj-language-packs/blob/main/ROADMAP.md).

Also planned:

- More languages for spelling and grammar, through language packs.
- The Markooj interface and this manual in more languages, starting with Urdu.

## Research writing

- More citation styles, and choosing your own `.csl` file from the References tab.
- Reading other reference formats besides BibTeX, such as CSL JSON.
- Smoother hand-off to journals: templates that match common journal and thesis layouts.
- Comparing two versions of a document side by side, like Word's Compare.

## Writing help

- More rules in the Writing Assistant, and rules you can write yourself.
- A personal style guide: words and spellings your team prefers.
- Optional AI help with your own key, off by default. Nothing leaves your computer unless you say so.

## Working with others

- Better round trips with Word: comments and tracked changes coming back from a reviewer.
- Working with Git from inside Markooj, for people who keep their writing in a repository.

## Add-ins and macros

- **Done in 1.1.0:** an add-in store inside Markooj. Find add-ins, install, update and remove them with one click. Anyone can submit an add-in from their own GitHub repository to the registry, [datakeen/markooj-addins](https://github.com/datakeen/markooj-addins), starting from the [add-in template](https://github.com/datakeen/markooj-addin-template). Language packs have their own tab in the same view (File → Add-ins → Language packs).
- The Quran add-in (language parts 14 to 17), in its own repository `markooj-quran`, installed from the store.
- More of the app available to macros and add-ins, with a stable, documented API.

## Ideas and help

Have an idea, or want to help with one of these? Please [open an issue](https://github.com/datakeen/markooj/issues). Every release is listed in [CHANGELOG.md](CHANGELOG.md), and [CONTRIBUTING.md](CONTRIBUTING.md) explains how to help.
