import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld":
    "Deze server ondersteunt borden niet. Werk OpenBot bij op de computer waarop de server draait.",
  "error.boards.tooLargeToSend": "Dit bord is te groot om naar deze client te sturen.",
  "error.boards.invalidChange": "Deze wijziging is ongeldig.",
  "error.boards.boardMissing": "Dit bord bestaat niet meer.",
  "error.boards.columnMissing": "Deze kolom bestaat niet meer.",
  "error.boards.cardMissing": "Deze kaart bestaat niet meer.",
  "error.boards.tooManyBoards": "De server heeft het maximale aantal borden. Verwijder eerst een bord.",
  "error.boards.tooManyColumns": "Dit bord heeft het maximale aantal kolommen. Verwijder eerst een kolom.",
  "error.boards.tooManyCards": "Dit bord heeft het maximale aantal kaarten. Archiveer of verwijder eerst een kaart.",
  "error.boards.lastColumn": "Een bord heeft minstens één kolom nodig.",
  "error.boards.columnNotEmpty": "Deze kolom bevat nog kaarten. Kies een andere kolom om ze naartoe te verplaatsen.",
  "error.boards.columnTarget": "Kies een andere kolom op hetzelfde bord.",
  "error.boards.cardPlacement": "De kaart kan daar niet worden geplaatst. Vernieuw het bord en probeer het opnieuw.",
} as const satisfies PartialTranslation<typeof source>;
