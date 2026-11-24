import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld": "Questo server non supporta le board. Aggiorna OpenBot sul computer che lo esegue.",
  "error.boards.tooLargeToSend": "Questa board è troppo grande per essere inviata a questa app.",
  "error.boards.invalidChange": "Questa modifica non è valida.",
  "error.boards.boardMissing": "Questa board non esiste più.",
  "error.boards.columnMissing": "Questa colonna non esiste più.",
  "error.boards.cardMissing": "Questa scheda non esiste più.",
  "error.boards.tooManyBoards": "Il server ha raggiunto il numero massimo di board. Elimina prima una board.",
  "error.boards.tooManyColumns": "Questa board ha raggiunto il numero massimo di colonne. Elimina prima una colonna.",
  "error.boards.tooManyCards":
    "Questa board ha raggiunto il numero massimo di schede. Archivia o elimina prima una scheda.",
  "error.boards.lastColumn": "Una board ha bisogno di almeno una colonna.",
  "error.boards.columnNotEmpty":
    "Questa colonna contiene ancora delle schede. Scegli un’altra colonna in cui spostarle.",
  "error.boards.columnTarget": "Scegli una colonna diversa della stessa board.",
  "error.boards.cardPlacement": "La scheda non può essere collocata lì. Aggiorna la board e riprova.",
} as const satisfies PartialTranslation<typeof source>;
