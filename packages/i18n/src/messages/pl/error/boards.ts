import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld": "Ten serwer nie obsługuje tablic. Zaktualizuj OpenBot na komputerze, na którym działa.",
  "error.boards.tooLargeToSend": "Ta tablica jest za duża, aby wysłać ją do tej aplikacji.",
  "error.boards.invalidChange": "Ta zmiana jest nieprawidłowa.",
  "error.boards.boardMissing": "Ta tablica już nie istnieje.",
  "error.boards.columnMissing": "Ta kolumna już nie istnieje.",
  "error.boards.cardMissing": "Ta karta już nie istnieje.",
  "error.boards.tooManyBoards": "Serwer ma maksymalną liczbę tablic. Najpierw usuń jedną z nich.",
  "error.boards.tooManyColumns": "Ta tablica ma maksymalną liczbę kolumn. Najpierw usuń jedną z nich.",
  "error.boards.tooManyCards": "Ta tablica ma maksymalną liczbę kart. Najpierw zarchiwizuj lub usuń jedną z nich.",
  "error.boards.lastColumn": "Tablica musi mieć co najmniej jedną kolumnę.",
  "error.boards.columnNotEmpty": "W tej kolumnie nadal są karty. Wybierz inną kolumnę, do której je przeniesiesz.",
  "error.boards.columnTarget": "Wybierz inną kolumnę na tej samej tablicy.",
  "error.boards.cardPlacement": "Nie można umieścić karty w tym miejscu. Odśwież tablicę i spróbuj ponownie.",
} as const satisfies PartialTranslation<typeof source>;
