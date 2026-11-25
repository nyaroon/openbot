import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.unavailable": "במחשב הזה אין אחסון סודות, ולכן הכספת אינה יכולה לשמור פריטים.",
  "error.vault.unreadable": "לא ניתן לקרוא את קובץ הכספת. יש לאפס את הכספת כדי להשתמש בה שוב.",
  "error.vault.tooLarge": "הכספת מלאה. יש למחוק כמה פריטים ולנסות שוב.",
  "error.vault.itemMissing": "הפריט הזה כבר אינו בכספת.",
  "error.vault.valueTooLong": "אחד הערכים ארוך מדי.",
  "error.vault.websiteInvalid": "יש להזין כתובת אתר HTTP/HTTPS.",
  "error.vault.passwordRequired": "יש להזין סיסמה.",
  "error.vault.twoStepKeyInvalid": "זה לא מפתח אימות דו־שלבי. יש להזין את מפתח ההגדרה או את קישור otpauth:// של האתר.",
  "error.vault.cardNumberInvalid": "יש להזין מספר כרטיס תקין.",
  "error.vault.securityCodeInvalid": "יש להזין קוד אבטחה בן 3 או 4 ספרות.",
  "error.vault.expiryInvalid": "יש להזין חודש ושנה תקינים לתפוגה.",
  "error.vault.contactEmpty": "יש להזין שם, כתובת, מספר טלפון או כתובת אימייל.",
  "error.vault.contactMissing": "איש הקשר לחיוב כבר אינו בכספת.",
  "error.vault.apiKeyRequired": "יש להזין מפתח API.",
  "error.vault.apiKeyNameInvalid":
    "יש להזין שם משתנה עם אותיות גדולות A–Z, ספרות ו-_, שמתחיל באות, כמו OPENAI_API_KEY.",
  "error.vault.apiKeyNameTaken": "בכספת כבר יש מפתח API עם שם המשתנה הזה.",
  "error.vault.csvInvalid": "הקובץ הזה אינו ייצוא סיסמאות בפורמט CSV.",
  "error.vault.csvTooLarge": "קובץ ה-CSV גדול מדי.",
  "error.vault.universalWrongPassphrase": "ביטוי הסיסמה הזה אינו נכון.",
  "error.vault.universalPassphraseShort": "השתמשו בביטוי סיסמה של 10 תווים לפחות.",
  "error.vault.universalSignIn": "היכנסו לחשבון OpenBot כדי להשתמש בכספת האוניברסלית.",
  "error.vault.universalNotSetUp": "הכספת האוניברסלית עדיין לא הוגדרה.",
  "error.vault.universalLocked": "בטלו קודם את נעילת הכספת האוניברסלית.",
  "error.vault.universalExists": "לחשבון הזה כבר יש כספת אוניברסלית. בטלו את נעילתה באמצעות ביטוי הסיסמה שלה.",
  "error.vault.universalChanged": "ביטוי הסיסמה שונה במחשב אחר. נסו שוב.",
  "error.vault.universalUnavailable": "לא ניתן היה לקרוא את הכספת האוניברסלית במחשב הזה.",
  "error.vault.universalSkillUnsupported":
    "אי אפשר לשתף את המיומנות הזו. מיומנויות מובנות ומיומנויות מתיקיית הבית נשארות במחשב הזה.",
  "error.vault.sharedReadOnly": "הפריט הזה משותף על ידי ארגון ואי אפשר לשנות אותו כאן.",
} as const satisfies PartialTranslation<typeof source>;
