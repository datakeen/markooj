# Writing Assistant

The Writing Assistant reads along as you write and points out spelling, grammar, clarity and style problems. Each suggestion says what is wrong, offers a fix and explains the rule. It never changes your text by itself, and every fix can be undone with Ctrl+Z.

Everything runs on your computer. Your text never leaves it.

## Underlines and the pane

As you type, colored lines appear under words and phrases:

- **Red:** correctness (spelling, grammar, punctuation).
- **Blue:** clarity.
- **Green:** engagement.
- **Purple:** delivery (tone and formality).

Click an underlined word to see its card. Open **Review → Writing Assistant** (or click the score on the status bar) to see every suggestion in one pane, grouped by category, with an overall writing score from 0 to 100 and a count for each category.

Each card has:

- **Accept:** use the suggested fix. When there are several, pick one.
- **Dismiss:** hide this one suggestion.
- **Ignore rule:** stop showing this kind of suggestion. Turn rules back on in File → Options → Writing.
- **Add to dictionary:** for names and terms that are spelled right.
- **Why?** opens a short explanation with a wrong and a right example.

**Accept all safe fixes** applies every fix that cannot change your meaning, such as a doubled word or "a hour". One Ctrl+Z takes them all back.

When the same kind of mistake appears several times, each card words its message a little differently, so the explanations do not read like a broken record. The meaning, the fix and the **Why?** text stay the same, and checking again never changes a message.

## Going through suggestions one by one

- **F7** (Review → Spelling & Grammar) steps through suggestions in a dialog, like Word's Editor: Change, Ignore, Ignore All, Add to Dictionary, and Why?
- **Alt+F7** goes to the next underlined word and opens its card, and **Alt+Shift+F7** to the previous one.
- Right-click a red word for spelling suggestions.

## Goals

Click **Review → Goals** to tell Markooj about your writing. Goals change which suggestions you see.

- **Audience:** General, Knowledgeable or Expert.
- **Formality:** Informal, Neutral or Formal. Formal also flags contractions and casual words.
- **Domain:** General, Academic or Business. Academic allows the passive voice and asks you to spell out abbreviations.

## What it checks

### Correctness

| Check | Wrong | Right |
| --- | --- | --- |
| Spelling | We recieved the samples. | We received the samples. |
| US/UK spelling: one style throughout, the one your document's language sets | The colour of the center line (US document) | The color of the center line |
| Wrong preposition | We discussed about the results. | We discussed the results. |
| A or an | It took a hour to run a experiment. | It took an hour to run an experiment. |
| "An" that should be "and" (between describing words) | modern and surprising, an mesmerizing | modern, surprising, and mesmerizing |
| Commonly confused words (affect/effect, then/than, your/you're, lose/loose, principal/principle, complement/compliment, advice/advise) | The new rules will effect everyone. | The new rules will affect everyone. |
| Its or it's | Its clear that the model lost it's accuracy. | It's clear that the model lost its accuracy. |
| Repeated word | The the results were clear. | The results were clear. |
| Grammar and agreement | The results shows a trend. | The results show a trend. |
| Word boundary | We will work out side the lab. | We will work outside the lab. |
| Capitalization | the river rose. i measured it. | The river rose. I measured it. |
| Misheard phrase | For all intensive purposes | For all intents and purposes |
| Wrong word | The new rules will effect everyone. | The new rules will affect everyone. |
| Word choice | I could of gone. | I could have gone. |
| Word order | We only have three samples left only. | We have only three samples left. |
| Nonstandard word | Irregardless of the cost | Regardless of the cost |
| Punctuation | Its a good day. | It's a good day. |
| Formatting | Pages 10 - 20 | Pages 10–20 |
| Regional word | We parked the lorry (US document). | We parked the truck. |
| Typo | teh data | the data |

**Wrong prepositions** get special care, because they are easy to get wrong when your first language uses a different word. Markooj knows over 40 common slips, for example:

- *discuss about* → discuss; *comprise of* → comprise; *different than* → different from
- *married with* → married to; *on 1998* → in 1998; *in Monday* → on Monday
- *emphasize on* → emphasize; *request for* → request; *superior than* → superior to
- *cope up with* → cope with; *return back* → return; *since five years* → for five years
- *explain me* → explain to me; *depends of* → depends on; *according to me* → in my view

**Commonly confused words** are marked only when the words around them leave no doubt. "The new rules will effect everyone" is marked, because "effect" comes after "will" and before a person. "Subtle effects and mouse movement effects" is not, because "effects" is a plural noun there, which is right. The same care applies to then/than, your/you're, lose/loose, principal/principle, complement/compliment and advice/advise.

**"An" or "and"?** When "an" sits between two describing words, as in "black an white" or "modern and surprising, an mesmerizing", the card offers **and** first and **a** second. If you did mean an article, pick **a**.

### Clarity

| Check | Wrong | Right |
| --- | --- | --- |
| Long sentence (over 30 words; change it in Options) | One sentence that runs on through several ideas | Two or three shorter sentences |
| Wordy phrase | In order to reduce costs, we met due to the fact that prices rose. | To reduce costs, we met because prices rose. |
| Passive voice (at most one hint per paragraph) | The report was written by the committee. | The committee wrote the report. |
| Commas between describing words (a style hint) | a beautiful engaging modern and surprising page | a beautiful, engaging, modern, and surprising page |
| Unneeded word | The results are basically really good. | The results are good. |
| Hidden verb | We performed an analysis of the data and made a decision. | We analyzed the data and decided. |
| Absolute adjective | This is a very unique approach. | This is a unique approach. |
| Undefined abbreviation | The SDR was measured at three sites. | The sediment delivery ratio (SDR) was measured at three sites. |
| Inconsistent spelling | Send an e-mail … check your email. | Send an email … check your email. |
| Redundant words | Return back to the start. | Return to the start. |
| Style | In my opinion I think … | I think … |

### Engagement

| Check | Wrong | Right |
| --- | --- | --- |
| Weak phrase | The results were very good and the effect was very big. | The results were excellent and the effect was huge. |
| Overused word | This is an important point. Another important finding is an important trend. | This is an important point. Another key finding is a significant trend. |
| Repeated sentence start | We measured the flow. We dried the samples. We weighed them. | We measured the flow. After drying the samples, we weighed them. |
| Better word | We will try and finish today. | We will try to finish today. |

### Delivery

| Check | Wrong | Right |
| --- | --- | --- |
| Contraction (formal and academic goals only) | The model doesn't converge and it can't be used. | The model does not converge and it cannot be used. |
| Informal word | We got a lot of data and figured out the trend. | We collected substantial data and determined the trend. |
| Too many hedges | This may possibly suggest that the effect might be somewhat larger. | This suggests that the effect may be larger. |
| Sounds unsure | I think the results show a clear trend. | The results show a clear trend. |
| Too many exclamation marks | The test passed!!! | The test passed. |

Choose which categories to show in File → Options → Writing → Show suggestions for.

**Fewer false alarms.** The passive-voice hint appears at most once per paragraph. It skips phrases that name a status, such as "is marked as" or "is known as", and time or condition clauses such as "when the file is opened". The comma hint appears only for three or more describing words in a row, and never for words that build on each other, such as "a big old red car". Unit names such as MB and min, and key names such as Ctrl, are not marked.

### What it skips

Front matter, code, math, web and file addresses, citations, cross-references, comments and hidden notes are never checked. Words in another script than the document's language, such as Urdu words in an English document, are not marked as misspelled.

## Synonyms and the Thesaurus

- **Double-click** a word, or right-click it and choose **Synonyms**, to see a short list of other words. Click one to put it in place. (Turn the double-click list off in Options → Writing.)
- **Shift+F7** opens the Thesaurus pane: synonyms and antonyms of the selected word, grouped by meaning.

The thesaurus is WordNet 3.1 from Princeton University, stored inside Markooj, with about 19,500 English words.

## Word completion

Turn on **Suggest words as I type** in File → Options → Writing (or Review → Suggest words). After three letters, Markooj shows the rest of a likely word in gray. Press **Tab** or the **Right arrow** to accept it, or keep typing. Esc hides it. It is off by default.

## Language

English (US) and English (UK) are built in. The document's language comes from `lang:` in its front matter, or from the language on the status bar; new documents use the default in File → Options → Language. Urdu, Arabic, Persian and Punjabi (Shahmukhi) checks come with language packs. See [Languages and right-to-left text](languages-and-rtl.md).

## Spelling suggestions

Suggestions are ranked so that the word you most likely meant comes first: "calander" gives **calendar** before colander, "coreection" gives **correction**, and "syncrounus" gives **synchronous**. Markooj weighs the slips people really make (two letters swapped, a double letter missed, one vowel for another, a neighboring key), how the word sounds, and how common each word is. A word with an ending is corrected through its stem, so "monotonusity" offers monotony and monotonousness.

## Technical terms and place names

Spelling accepts several hundred technical words and place names that general dictionaries miss:

- **Hydraulics, hydropower, river engineering and fluid mechanics:** penstock, feedwater, tailrace, headrace, spillway, cofferdam, riprap, hydrograph, hyetograph, thermohydraulic, Manning, Reynolds, Froude and many more.
- **Engineering software and units:** Simulink, Fluent, Abaqus and similar names, and units such as cumec and cusec. All-capital names such as ANSYS, MATLAB, HEC-RAS and QGIS are never marked, and Markooj does not ask you to spell them out.
- **Places:** US states and well-known US places (San Onofre, for example), the countries and major cities of the world, and the provinces, regions, cities, rivers, dams and barrages of Pakistan (Khyber Pakhtunkhwa, Gilgit-Baltistan, Azad Kashmir, Rawalpindi, Faisalabad, Sukkur, Wah, Taxila, Mangla, Tarbela and more).

Names keep their capital letter: "Lahore" is accepted and "lahore" is marked, as in any dictionary. The list is on by default. To check these words like any other, turn off **Accept technical terms and place names** in File → Options → Writing, on Review → Proofing (**Technical terms**), or with the command of the same name (Alt+Q).

## Your dictionary

Words you add are kept in your dictionary and used in every document. **Review → My dictionary** shows, adds and removes them.

## Turning it off

- **Review → Check writing as you type** turns the colored lines on and off.
- **Review → Check spelling as you type** does the same for the red spelling lines.

## Where the checks come from

Grammar comes from [Harper](https://github.com/Automattic/harper) (Apache-2.0), which runs inside Markooj. Spelling uses Hunspell dictionaries from SCOWL through nspell; suggestions are ranked with word frequencies taken from WordNet (Princeton University). The technical terms and place names were listed for Markooj. The other rules were written for Markooj, with researchers and people writing in their second language in mind.
