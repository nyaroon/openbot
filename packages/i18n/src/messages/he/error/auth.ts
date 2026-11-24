import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/auth";

export const messages = {
  "error.auth.serviceUnavailable": "OpenBot לא הצליח להגיע לשירות החשבון. יש לוודא שה-API פועל ולנסות שוב.",
  "error.auth.sessionTimeout": "OpenBot לא ענה בזמן. בדקו את החיבור לאינטרנט, ואז נסו שוב.",
  "error.auth.networkBlocked":
    "חומת אש או שרת proxy ברשת הזו חסמו את הגישה של OpenBot אל {host}. יש לבקש ממנהל הרשת לאפשר את {host} ולנסות שוב.",
  "error.auth.signInFirst": "יש להתחבר תחילה ל-OpenBot.",
  "error.auth.signInRequired": "נדרשת התחברות.",
  "error.auth.chatColorUnavailable": "שירות החשבון עדיין אינו תומך בצבעי צ'אט. יש לנסות שוב מאוחר יותר.",
  "error.auth.accountChangedDuringRegister": "החשבון המחובר השתנה בזמן רישום השרת הזה.",
  "error.auth.hostCredentialUnavailable": "פרטי הגישה של המארח המרוחק אינם זמינים. יש לרשום את המארח שוב.",
  "error.auth.codeNotVerified": "לא ניתן היה לאמת את קוד ההתחברות.",
  "error.auth.serviceError": "שירות החשבון החזיר שגיאה.",
  "error.auth.serviceUnreachable": "OpenBot לא הצליח להגיע לשירות החשבון. יש לבדוק את החיבור ולנסות שוב.",
  "error.auth.serviceTimeout": "שירות החשבון לא הגיב בזמן. יש לנסות שוב.",
  "error.auth.serviceStatus": "שירות החשבון החזיר שגיאה ({status}). יש לנסות שוב מאוחר יותר.",
  "error.auth.invalidServerClaim": "שירות החשבון החזיר קוד שרת לא תקין.",
  "error.auth.codeNotSent": "OpenBot לא הצליח לשלוח את קוד ההתחברות.",
  "error.auth.deliveryTimeout":
    "OpenBot לא הצליח לאשר את המשלוח בזמן. ייתכן שהקוד עדיין יגיע. יש לבדוק את המשלוח לפני שליחה חוזרת.",
  "error.auth.deliveryInterrupted":
    "החיבור הסתיים לפני ש-OpenBot אישר את המשלוח. יש לבדוק את המשלוח כדי לא לשלוח קוד נוסף.",
  "error.auth.deliveryUnknown": "OpenBot לא הצליח לאשר אם קוד ההתחברות נשלח. יש לבדוק את המשלוח לפני שליחה חוזרת.",
} as const satisfies PartialTranslation<typeof source>;
