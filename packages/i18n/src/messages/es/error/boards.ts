import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld":
    "Este servidor no admite los tableros. Actualiza OpenBot en el ordenador que lo ejecuta.",
  "error.boards.tooLargeToSend": "Este tablero es demasiado grande para enviarlo a esta aplicación.",
  "error.boards.invalidChange": "Este cambio no es válido.",
  "error.boards.boardMissing": "Este tablero ya no existe.",
  "error.boards.columnMissing": "Esta columna ya no existe.",
  "error.boards.cardMissing": "Esta tarjeta ya no existe.",
  "error.boards.tooManyBoards": "El servidor ha alcanzado el número máximo de tableros. Elimina un tablero primero.",
  "error.boards.tooManyColumns": "Este tablero ha alcanzado el número máximo de columnas. Elimina una columna primero.",
  "error.boards.tooManyCards":
    "Este tablero ha alcanzado el número máximo de tarjetas. Archiva o elimina una tarjeta primero.",
  "error.boards.lastColumn": "Un tablero necesita al menos una columna.",
  "error.boards.columnNotEmpty": "Esta columna todavía tiene tarjetas. Elige otra columna a la que moverlas.",
  "error.boards.columnTarget": "Elige una columna distinta del mismo tablero.",
  "error.boards.cardPlacement": "La tarjeta no se puede colocar ahí. Actualiza el tablero e inténtalo de nuevo.",
} as const satisfies PartialTranslation<typeof source>;
