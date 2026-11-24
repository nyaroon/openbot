import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld": "השרת הזה אינו תומך בלוחות. יש לעדכן את OpenBot במחשב שמפעיל אותו.",
  "error.boards.tooLargeToSend": "הלוח הזה גדול מדי לשליחה לאפליקציה הזו.",
  "error.boards.invalidChange": "השינוי הזה אינו תקין.",
  "error.boards.boardMissing": "הלוח הזה כבר לא קיים.",
  "error.boards.columnMissing": "העמודה הזו כבר לא קיימת.",
  "error.boards.cardMissing": "הכרטיס הזה כבר לא קיים.",
  "error.boards.tooManyBoards": "בשרת כבר יש את המספר המרבי של לוחות. יש למחוק לוח קודם.",
  "error.boards.tooManyColumns": "בלוח הזה כבר יש את המספר המרבי של עמודות. יש למחוק עמודה קודם.",
  "error.boards.tooManyCards": "בלוח הזה כבר יש את המספר המרבי של כרטיסים. יש להעביר כרטיס לארכיון או למחוק אותו קודם.",
  "error.boards.lastColumn": "בלוח חייבת להיות לפחות עמודה אחת.",
  "error.boards.columnNotEmpty": "בעמודה הזו עדיין יש כרטיסים. יש לבחור עמודה אחרת שאליה יועברו.",
  "error.boards.columnTarget": "יש לבחור עמודה אחרת באותו לוח.",
  "error.boards.cardPlacement": "אי אפשר למקם את הכרטיס שם. יש לרענן את הלוח ולנסות שוב.",
} as const satisfies PartialTranslation<typeof source>;
