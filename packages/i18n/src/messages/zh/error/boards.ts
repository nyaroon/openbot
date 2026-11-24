import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld": "该服务器不支持看板，请更新运行它的电脑上的 OpenBot。",
  "error.boards.tooLargeToSend": "该看板过大，无法发送到此客户端。",
  "error.boards.invalidChange": "此更改无效。",
  "error.boards.boardMissing": "该看板已不存在。",
  "error.boards.columnMissing": "该列已不存在。",
  "error.boards.cardMissing": "该卡片已不存在。",
  "error.boards.tooManyBoards": "服务器上的看板数量已达上限，请先删除一个看板。",
  "error.boards.tooManyColumns": "此看板的列数已达上限，请先删除一列。",
  "error.boards.tooManyCards": "此看板的卡片数量已达上限，请先归档或删除一张卡片。",
  "error.boards.lastColumn": "看板至少需要保留一列。",
  "error.boards.columnNotEmpty": "此列中仍有卡片，请选择另一列来存放它们。",
  "error.boards.columnTarget": "请选择同一看板中的另一列。",
  "error.boards.cardPlacement": "无法将卡片放到该位置。请刷新看板后重试。",
} as const satisfies PartialTranslation<typeof source>;
