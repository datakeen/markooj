# Macros and scripting

Like VBA in Word, the **Developer** tab lets you automate Markooj. Macros are small programs in **Python** or **JavaScript** that work on the open document: find and replace with patterns, number things, insert tables, tidy up text. Both languages run inside Markooj and work offline. Nothing needs to be installed.

## The Developer tab

| Button | What it does |
| --- | --- |
| **Macros** (Alt+F8) | See, run, edit and delete your saved macros. |
| **Record** | Record what you do, to play it back later. |
| **Editor** (Alt+F11) | Write and test macros, with code colors and an Output panel. |
| **Run code** (Ctrl+Alt+Enter) | Run the selected Python code, or the Python code block the cursor is in. |
| **Console** (Ctrl+Alt+P) | A Python console: type a line, see the result. |
| **Math macros** | Your own LaTeX commands. See [Math macros](math-macros.md). |
| **Add-ins** | Manage add-ins. See [Add-ins](add-ins.md). |

## Record a macro

1. Click **Developer → Record**. A recording sign shows on the status bar.
2. Do the steps you want to repeat: click ribbon buttons, use shortcuts, type text.
3. Click **Record** again, or **Stop** on the status bar, to finish.
4. Give the macro a name, choose Python or JavaScript, and tick **Show on ribbon** if you want a button for it. Click Save.

The recorder writes one line per step, such as `await run("format.bold")` for a button and `doc.insert("text")` for typing. Open the macro in the editor to see and change it.

## Write a macro

1. Click **Developer → Editor** (Alt+F11).
2. Choose **Python** or **JavaScript**, and give the macro a name.
3. Write the code. The book button (or F1 inside the editor) shows the API reference and ready-made examples.
4. Press **Ctrl+Enter** (or F5) to run it. Messages and errors appear in the Output panel.
5. Press **Ctrl+S** to save it.

A macro can have a **Shortcut**, such as Ctrl+Alt+Shift+N. If the key already belongs to a command, Markooj tells you, and the macro takes it over. Tick **Show on ribbon** for a button in a **My macros** group on the Developer tab.

### An example in Python

```python
from markooj import doc, ui

n = doc.replace("colour", "color")
n += doc.replace("Colour", "Color")
ui.toast(f"Replaced {n} times")
```

### The same in JavaScript

```js
let n = doc.replace('colour', 'color');
n += doc.replace('Colour', 'Color');
ui.toast(`Replaced ${n} times`);
```

### More examples in the editor

- Replace all "colour" with "color"
- Number all figures
- Insert today's date
- Make a table of word frequencies
- Convert inches to cm in the selection
- Ask a question (and save the answer as the author)

## Document API reference

The same API works in both languages. In Python, start with `from markooj import doc, ui` (it is also imported for you). Names with two words use an underscore in Python (`replace_selection`) and a capital letter in JavaScript (`replaceSelection`).

| Python | JavaScript | What it does |
| --- | --- | --- |
| `doc.text` | `doc.text` | The whole document as Markdown. Assign to it to replace everything. |
| `doc.title`, `doc.path` | `doc.title`, `doc.path` | The document's name and file path (empty if not saved yet). |
| `doc.selection` | `doc.selection` | The selected text. |
| `doc.insert(text)` | `doc.insert(text)` | Insert text at the cursor. |
| `doc.replace_selection(text)` | `doc.replaceSelection(text)` | Replace the selected text. |
| `doc.replace(find, repl, regex=False, all=True, case=True)` | `doc.replace(find, repl, {regex, all, case})` | Find and replace. Returns how many places changed. |
| `doc.find(query)` | `doc.find(query)` | Every match, as line, column and text. |
| `doc.lines()` | `doc.lines()` | The document as a list of lines. |
| `doc.meta`, `doc.set_meta(key, value)` | `doc.meta`, `doc.setMeta(key, value)` | Document properties (title, author, keywords …) in the front matter. |
| `doc.save()` | `doc.save()` | Save the document. |
| `docs.list()`, `docs.open(path)`, `docs.new(text)`, `docs.activate(id)` | the same | Work with the open documents. |
| `ui.alert(msg)`, `ui.confirm(msg)` | `await ui.alert(msg)`, `await ui.confirm(msg)` | Show a message, or ask yes or no. |
| `await ui.prompt_async(msg, default)` | `await ui.prompt(msg, default)` | Ask for some text. Returns the answer, or nothing if canceled. |
| `ui.toast(msg)` | `ui.toast(msg)` | A short message at the bottom of the window. |
| `await run(command_id, args)` | `await run(commandId, args)` | Run any button's command, for example `await run("format.bold")`. |
| `commands()` | `commands()` | Every command id, the same ones the recorder writes. |
| `print(...)` | `print(...)`, `console.log(...)` | Write to the Output panel. |

The **Print all command ids** button in the editor's API reference prints every command id with its name and shortcut. The ids are also in [Keyboard shortcuts](keyboard-shortcuts.md).

### Python notes

- Python 3 runs right inside Markooj (Pyodide). The standard library works: `re`, `math`, `statistics`, `datetime`, `json`, `collections` and the rest. Extra packages cannot be installed.
- The first Python run of a session takes a few seconds while Python starts. File → Options → Developer can start it in the background when Markooj opens.
- `ui.prompt` and `ui.confirm` wait for the answer where your system allows it; `await ui.prompt_async(...)` and `await ui.confirm_async(...)` always work.

### JavaScript notes

- A JavaScript macro runs as an async function, so use `await` with `ui.alert`, `ui.prompt`, `ui.confirm`, `run` and `docs.open`.
- The full `app` object is available too, as in [add-ins](add-ins.md).

## Running code from a document

Put Python code in a fenced block in your document:

````
```python
import statistics
print(statistics.mean([12.5, 18.0, 15.2]))
```
````

Click inside the block and press **Ctrl+Alt+Enter**. The result shows in the Python console. Before running code that came with a document, Markooj asks once whether you trust it. Only run code you trust.

## Stopping a macro

To stop a running macro, press **Alt+Q**, type `stop`, and pick **Stop running macro**. Macros that run longer than 60 seconds stop by themselves; change the limit (or set 0 for none) in **File → Options → Developer**.

## Where macros are kept

Saved macros live in a `macros` folder in your Markooj settings folder (or in the `data` folder of a portable copy). They are yours: they are not part of any document.
