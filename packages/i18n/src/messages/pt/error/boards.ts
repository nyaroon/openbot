import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld":
    "Este servidor não oferece suporte a quadros. Atualize o OpenBot no computador que o executa.",
  "error.boards.tooLargeToSend": "Este quadro é grande demais para enviar a este aplicativo.",
  "error.boards.invalidChange": "Esta alteração não é válida.",
  "error.boards.boardMissing": "Este quadro não existe mais.",
  "error.boards.columnMissing": "Esta coluna não existe mais.",
  "error.boards.cardMissing": "Este cartão não existe mais.",
  "error.boards.tooManyBoards": "O servidor atingiu o número máximo de quadros. Exclua um quadro primeiro.",
  "error.boards.tooManyColumns": "Este quadro atingiu o número máximo de colunas. Exclua uma coluna primeiro.",
  "error.boards.tooManyCards": "Este quadro atingiu o número máximo de cartões. Arquive ou exclua um cartão primeiro.",
  "error.boards.lastColumn": "Um quadro precisa de pelo menos uma coluna.",
  "error.boards.columnNotEmpty": "Esta coluna ainda tem cartões. Escolha outra coluna para movê-los.",
  "error.boards.columnTarget": "Escolha uma coluna diferente no mesmo quadro.",
  "error.boards.cardPlacement": "O cartão não pode ser colocado ali. Atualize o quadro e tente novamente.",
} as const satisfies PartialTranslation<typeof source>;
