import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld":
    "このサーバーはボードに対応していません。サーバーを実行しているコンピューターの OpenBot を更新してください。",
  "error.boards.tooLargeToSend": "このボードは大きすぎるため、このクライアントに送信できません。",
  "error.boards.invalidChange": "この変更は無効です。",
  "error.boards.boardMissing": "このボードはもう存在しません。",
  "error.boards.columnMissing": "この列はもう存在しません。",
  "error.boards.cardMissing": "このカードはもう存在しません。",
  "error.boards.tooManyBoards": "サーバーのボード数が上限に達しました。先にボードを削除してください。",
  "error.boards.tooManyColumns": "このボードの列数が上限に達しました。先に列を削除してください。",
  "error.boards.tooManyCards": "このボードのカード数が上限に達しました。先にカードをアーカイブまたは削除してください。",
  "error.boards.lastColumn": "ボードには少なくとも 1 つの列が必要です。",
  "error.boards.columnNotEmpty": "この列にはまだカードがあります。移動先として別の列を選択してください。",
  "error.boards.columnTarget": "同じボード内の別の列を選択してください。",
  "error.boards.cardPlacement": "カードをそこに配置できません。ボードを更新してから、もう一度お試しください。",
} as const satisfies PartialTranslation<typeof source>;
