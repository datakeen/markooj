# Clipboard fixtures

The `text/html` (and Excel's `text/plain`) part of what Word, Excel, Google Sheets and LibreOffice put on the
Windows clipboard when you copy a table, trimmed to the copied fragment. The smoke tests in `src/tables.js`
(`tables: Office paste …`) read them through `markooj://app/test/fixtures/clipboard/`. They are not packaged.

`excel-table.tsv` is written by the test itself (tabs, CRLF line ends and a quoted cell with a line break),
because editors tend to turn tabs into spaces.
