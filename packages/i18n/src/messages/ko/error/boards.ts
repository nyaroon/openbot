import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld": "이 서버는 보드를 지원하지 않아요. 서버를 실행하는 컴퓨터에서 OpenBot을 업데이트하세요.",
  "error.boards.tooLargeToSend": "이 보드는 너무 커서 이 클라이언트로 보낼 수 없어요.",
  "error.boards.invalidChange": "올바르지 않은 변경이에요.",
  "error.boards.boardMissing": "이 보드는 더 이상 존재하지 않아요.",
  "error.boards.columnMissing": "이 열은 더 이상 존재하지 않아요.",
  "error.boards.cardMissing": "이 카드는 더 이상 존재하지 않아요.",
  "error.boards.tooManyBoards": "서버의 보드 수가 최대치에 도달했어요. 먼저 보드를 삭제하세요.",
  "error.boards.tooManyColumns": "이 보드의 열 수가 최대치에 도달했어요. 먼저 열을 삭제하세요.",
  "error.boards.tooManyCards": "이 보드의 카드 수가 최대치에 도달했어요. 먼저 카드를 보관하거나 삭제하세요.",
  "error.boards.lastColumn": "보드에는 열이 하나 이상 있어야 해요.",
  "error.boards.columnNotEmpty": "이 열에 아직 카드가 있어요. 카드를 옮길 다른 열을 선택하세요.",
  "error.boards.columnTarget": "같은 보드의 다른 열을 선택하세요.",
  "error.boards.cardPlacement": "카드를 그곳에 놓을 수 없어요. 보드를 새로 고친 뒤 다시 시도하세요.",
} as const satisfies PartialTranslation<typeof source>;
