# Case Builder for Detective: City of Angels

A free fan tool for writing your own cases for *Detective: City of Angels*. It walks you through the design process, lets you type every part of a case, and prints finished cards at actual size.

Live site: https://detective.skirmishgames.app

## What it does

The Case files tab lists cases ready to print and play: Case Builder originals by Ivan & Claude (print PDF made in the browser, or open a copy to edit), and fan cases packaged as PDFs and credited to their authors once each author has agreed. Files that give the game away are marked "Chisel only"; Sleuth-mode files are marked "Solo player only". The list lives in `cases/index.json`; originals are backup files in `cases/originals/`, fan PDFs go in `cases/fan/` (ignored by git until an author agrees; remove that line from `.gitignore` to publish).

My cases holds the cases you write yourself, saved in your browser.

The Guide tab covers the case design process in ten steps, summarised from the official Case Design Guide.

The Build tab has one step per part of a case:

- Story outline, solution, alternate guesses and unanswered questions.
- City planner on the kit map. Tap a number to add a place; the tool counts districts.
- Case cards A to L with notebook, tag and information-sheet layouts. Use kit art or upload your own pictures, with zoom and positioning.
- Responses in a Chisel grid: one most useful answer and any number of lies per question, with "look at a card" links. Codes (1a ... 1z, 2a ...) and Response cards are generated, text facing each edge for the ARC sleeve.
- Search cards that can take, flip or place a card, with an archive option.
- Mystery cards and the epilogue.
- The detective briefing, laid out on the kit briefing sheet.
- Checks for missing most useful answers, hidden cards nobody can reveal, choke points, face-up weapons, locations with no Search card, too many districts and text that does not fit.

The Print tab makes PDFs at 100% on Letter or A4, with crop marks on shared edges and backs mirrored for long-edge duplex. The Chisel grid, epilogue, case bible and city plan print from the browser.

Everything saves in your browser. Back up a case to a file (pictures included) and restore it anywhere.

An example case, *The Last Encore*, shows every part filled in.

## Card sizes

| Component | Size |
|---|---|
| Case and Mystery cards | 2.25 x 3.5 in (57 x 89 mm) |
| Response cards | 3 x 3 in |
| Search cards | 1.77 x 2.68 in (45 x 68 mm) |
| Briefing | Letter page |

## Running it locally

```
python3 -m http.server 8765
```

Then open http://localhost:8765. Canvas features do not work from `file://`.

## Development

- Static site, no build step. ES modules in `js/`, kit images in `assets/kit/`, fonts in `fonts/`, jsPDF in `vendor/`.
- `js/render.js` draws every card on canvas; `js/print.js` lays out the PDFs; `js/checks.js` holds the design checks.
- `js/data/locations.js` holds the 100 map locations, their districts and their position on the City Planning Guide.
- Before a release: `node tools/stamp.js`, then `node test/smoke.js` with the local server running.

## Credits

*Detective: City of Angels* is designed by Evan Derrick, illustrated by Vincent Dutrait and published by Van Ryder Games. Card templates, kit art, card backs, the briefing sheet and the city planning map come from the official Case Design Kit, © Van Ryder Games. This project is not affiliated with Van Ryder Games. Cases made with the kit may not be sold.

Fonts under the SIL Open Font License: Special Elite, Courier Prime, Permanent Marker, Caveat, Oswald. PDF output by jsPDF (MIT).

Made by Ivan ([BoardGameGeek](https://boardgamegeek.com/profile/slyfoxbgg)). Contact: skirmishgames.app@gmail.com
