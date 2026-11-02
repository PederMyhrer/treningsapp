# Trening

Treningslogg med kalender, styrkeutvikling og buldring. Én statisk side på GitHub Pages, ingen server og ingen avhengigheter.

**Bruk den her:** https://pedermyhrer.github.io/treningsapp/

## Bruk

- **Kalender:** festene på veggen viser hvilke dager du har trent. Trykk på en dag for å se uken, og på en økt for å se eller føre den.
- **Økt:** velg buldring, styrke, cardio eller annet. Alt lagres mens du skriver.
- **Oversikt:** økter per uke, styrke per øvelse, topper, fingrene og faste tester.
- **Mer:** kroppsvekt, buldrefarger, synk, nedlasting og passord.

Legg siden på hjemskjermen, så oppfører den seg som en app.

## Oppsett

1. Slå på Pages: Settings, Pages, Deploy from a branch, `main`, `/ (root)`.
2. Lag et fine-grained token: Settings, Developer settings, Personal access tokens. Velg bare repoet `treningsapp` og gi *Contents: Read and write*.
3. Åpne siden, skriv passordet og lim inn tokenet under Mer. Dette gjøres én gang per enhet.

Uten token kan du fortsatt føre, men endringene blir liggende på enheten til tokenet er på plass.

## Slik regnes det

Styrke vises som estimert 1RM med Epley: `last × (1 + reps / 30)`, med beste sett per økt. Sett over 12 repetisjoner telles ikke, fordi anslaget blir for usikkert. For øvelser med kroppsvekt er last lik kroppsvekt pluss ekstra vekt, med kroppsvekten som gjaldt den dagen. Uten registrert kroppsvekt vises tyngste ekstra vekt i stedet.

Hallfarger kan ikke sammenlignes over tid, siden problemene skiftes. Bruk faste tester til det.

## Skript og analyse

`tools/trening.mjs` leser og fører samme data fra kommandolinjen. `node tools/trening.mjs hjelp` viser alt. `eksport` lager CSV med én rad per økt, sett, problem og test.

Passordet gis med `TRENING_PW` eller filen `.trening-pw`, som ikke sjekkes inn.

## Sikkerhet

`data.json` er kryptert med AES-256-GCM, med nøkkel fra passordet (PBKDF2-SHA256, 600 000 runder), samme format som økonomisiden. Repoet er offentlig, men filen er uleselig uten passordet. Husker du passordet på enheten, ligger det i klartekst i nettleseren der. Velg bort «Husk på denne enheten» hvis det ikke passer.

Endres dataene to steder samtidig, slås de sammen automatisk. Nyeste versjon per økt vinner.

## Tester

```
npm test
node test/e2e.cjs
```

## Lisens

Skriftene i `fonts/` (Barlow) er lisensiert under SIL Open Font License 1.1.
