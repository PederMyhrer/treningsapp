# Treningsapp

Peders treningslogg. Statisk side på GitHub Pages, ingen avhengigheter og ingen byggesteg.

- Ikke legg til Claude som medforfatter eller annen attribusjon i commits. Commits skal stå i Peders navn alene.
- Tekst i appen og i dokumentasjon er på norsk og uten tankestreker.
- `data.json` er kryptert. Passordet ligger aldri i repoet. Bruk miljøvariabelen `TRENING_PW` eller filen `.trening-pw`.
- `core.js` deles av nettsiden og skriptet. Filformatet må virke begge veier.
- Kjør `npm test` og `node test/e2e.cjs` før kodeendringer pushes.

## Føre og analysere

```
node tools/trening.mjs hjelp
node tools/trening.mjs sett --ovelse "Pull-up" --reps 4 --kg 20 --push
node tools/trening.mjs eksport
```

Regler for føring: Bruk dagens dato hvis ingen annen er oppgitt. Skriv bare det Peder sier, og gjett ikke på tall. Oppvarming føres ikke. Sammenlign med tidligere økter bare når han spør.
