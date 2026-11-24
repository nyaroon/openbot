import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld":
    "Ce serveur ne prend pas en charge les tableaux. Mettez à jour OpenBot sur l’ordinateur qui l’exécute.",
  "error.boards.tooLargeToSend": "Ce tableau est trop volumineux pour être envoyé à cette application.",
  "error.boards.invalidChange": "Cette modification n’est pas valide.",
  "error.boards.boardMissing": "Ce tableau n’existe plus.",
  "error.boards.columnMissing": "Cette colonne n’existe plus.",
  "error.boards.cardMissing": "Cette carte n’existe plus.",
  "error.boards.tooManyBoards": "Le serveur a atteint le nombre maximal de tableaux. Supprimez d’abord un tableau.",
  "error.boards.tooManyColumns": "Ce tableau a atteint le nombre maximal de colonnes. Supprimez d’abord une colonne.",
  "error.boards.tooManyCards":
    "Ce tableau a atteint le nombre maximal de cartes. Archivez ou supprimez d’abord une carte.",
  "error.boards.lastColumn": "Un tableau doit avoir au moins une colonne.",
  "error.boards.columnNotEmpty":
    "Cette colonne contient encore des cartes. Choisissez une autre colonne où les déplacer.",
  "error.boards.columnTarget": "Choisissez une autre colonne du même tableau.",
  "error.boards.cardPlacement": "La carte ne peut pas être placée à cet endroit. Actualisez le tableau et réessayez.",
} as const satisfies PartialTranslation<typeof source>;
