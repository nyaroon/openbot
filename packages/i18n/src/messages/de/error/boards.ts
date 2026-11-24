import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld":
    "Dieser Server unterstützt keine Boards. Aktualisiere OpenBot auf dem Computer, auf dem er läuft.",
  "error.boards.tooLargeToSend": "Dieses Board ist zu groß, um es an diesen Client zu senden.",
  "error.boards.invalidChange": "Diese Änderung ist ungültig.",
  "error.boards.boardMissing": "Dieses Board gibt es nicht mehr.",
  "error.boards.columnMissing": "Diese Spalte gibt es nicht mehr.",
  "error.boards.cardMissing": "Diese Karte gibt es nicht mehr.",
  "error.boards.tooManyBoards": "Der Server hat die maximale Anzahl an Boards erreicht. Lösche zuerst ein Board.",
  "error.boards.tooManyColumns": "Dieses Board hat die maximale Anzahl an Spalten erreicht. Lösche zuerst eine Spalte.",
  "error.boards.tooManyCards":
    "Dieses Board hat die maximale Anzahl an Karten erreicht. Archiviere oder lösche zuerst eine Karte.",
  "error.boards.lastColumn": "Ein Board braucht mindestens eine Spalte.",
  "error.boards.columnNotEmpty":
    "Diese Spalte enthält noch Karten. Wähle eine andere Spalte, in die sie verschoben werden sollen.",
  "error.boards.columnTarget": "Wähle eine andere Spalte auf demselben Board.",
  "error.boards.cardPlacement":
    "Die Karte kann dort nicht platziert werden. Lade das Board neu und versuche es erneut.",
} as const satisfies PartialTranslation<typeof source>;
