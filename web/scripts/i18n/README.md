# English interface dictionary

`client/src/lib/i18n-en.js` is generated; `client/src/lib/i18n.js` applies it in the browser.

After adding Vietnamese text to the interface (from `web/`):

```bash
python3 scripts/i18n/extract.py client/src > /tmp/vi-strings.json             # every Vietnamese string in the UI
node scripts/i18n/translate.mjs ../deploy/.env /tmp/vi-strings.json scripts/i18n/en-map.json   # Groq translates only the new ones
python3 scripts/i18n/build-dict.py /tmp/vi-strings.json scripts/i18n/en-map.json client/src/lib/i18n-en.js
```

Fix a translation by editing `en-map.json` (or `OVERRIDES` in `build-dict.py` for key terms), then run the last step.
Report headings that the AI writes (`## Tổng quan`…) are mapped in `HEADINGS` inside `client/src/lib/i18n.js`.
