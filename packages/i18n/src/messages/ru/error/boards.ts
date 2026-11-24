import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld":
    "Этот сервер не поддерживает доски. Обновите OpenBot на компьютере, на котором он работает.",
  "error.boards.tooLargeToSend": "Эта доска слишком велика для отправки в это приложение.",
  "error.boards.invalidChange": "Это изменение недопустимо.",
  "error.boards.boardMissing": "Этой доски больше нет.",
  "error.boards.columnMissing": "Этого столбца больше нет.",
  "error.boards.cardMissing": "Этой карточки больше нет.",
  "error.boards.tooManyBoards": "На сервере достигнуто максимальное число досок. Сначала удалите одну из них.",
  "error.boards.tooManyColumns": "На этой доске достигнуто максимальное число столбцов. Сначала удалите один из них.",
  "error.boards.tooManyCards":
    "На этой доске достигнуто максимальное число карточек. Сначала архивируйте или удалите одну из них.",
  "error.boards.lastColumn": "На доске должен остаться хотя бы один столбец.",
  "error.boards.columnNotEmpty": "В этом столбце ещё есть карточки. Выберите другой столбец, куда их переместить.",
  "error.boards.columnTarget": "Выберите другой столбец на той же доске.",
  "error.boards.cardPlacement": "Карточку нельзя поместить сюда. Обновите доску и повторите попытку.",
} as const satisfies PartialTranslation<typeof source>;
