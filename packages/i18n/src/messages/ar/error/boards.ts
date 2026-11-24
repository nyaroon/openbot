import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld": "لا يدعم هذا الخادم اللوحات. حدّث OpenBot على الحاسوب الذي يشغّله.",
  "error.boards.tooLargeToSend": "هذه اللوحة كبيرة جدًا لإرسالها إلى هذا التطبيق.",
  "error.boards.invalidChange": "هذا التغيير غير صالح.",
  "error.boards.boardMissing": "لم تعد هذه اللوحة موجودة.",
  "error.boards.columnMissing": "لم يعد هذا العمود موجودًا.",
  "error.boards.cardMissing": "لم تعد هذه البطاقة موجودة.",
  "error.boards.tooManyBoards": "بلغ الخادم الحد الأقصى لعدد اللوحات. احذف لوحة أولًا.",
  "error.boards.tooManyColumns": "بلغت هذه اللوحة الحد الأقصى لعدد الأعمدة. احذف عمودًا أولًا.",
  "error.boards.tooManyCards": "بلغت هذه اللوحة الحد الأقصى لعدد البطاقات. أرشف بطاقة أو احذفها أولًا.",
  "error.boards.lastColumn": "تحتاج اللوحة إلى عمود واحد على الأقل.",
  "error.boards.columnNotEmpty": "لا يزال في هذا العمود بطاقات. اختر عمودًا آخر لنقلها إليه.",
  "error.boards.columnTarget": "اختر عمودًا مختلفًا في اللوحة نفسها.",
  "error.boards.cardPlacement": "لا يمكن وضع البطاقة هناك. حدّث اللوحة وحاول مرة أخرى.",
} as const satisfies PartialTranslation<typeof source>;
