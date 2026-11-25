import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "היכנס לחשבון OpenBot שלך כדי להשתמש בארגונים.",
  "error.organization.unreadable": "נתוני הארגון במחשב הזה אינם קריאים. הם יתקבלו שוב משירות החשבונות.",
  "error.organization.tooLarge": "הפריטים המשותפים של הארגונים שלך גדולים מדי כדי להישמר במחשב הזה.",
  "error.organization.forbidden": "אין לך הרשאה לבצע פעולה זו.",
  "error.organization.notFound": "הארגון הזה כבר לא קיים או שאינך חבר בו.",
  "error.organization.lastOwner": "לארגון חייב להיות לפחות בעלים אחד.",
  "error.organization.memberNotFound": "האדם הזה אינו חבר בארגון.",
  "error.organization.memberExists": "האדם הזה כבר חבר בארגון.",
  "error.organization.memberLimit": "הארגון הגיע למספר החברים המרבי.",
  "error.organization.invalidPhone": "הזן מספר וואטסאפ תקין עם קידומת המדינה.",
  "error.organization.organizationLimit": "הגעת למספר הארגונים המרבי.",
  "error.organization.notConfigured":
    "הכספת המשותפת עדיין לא הוגדרה בשירות החשבונות. בקש מבעל הפלטפורמה לסיים את ההגדרה.",
  "error.organization.itemConflict": "הפריט הזה שונה במחשב אחר. הוא רוענן, נסה שוב.",
  "error.organization.itemLimit": "כספת הארגון מלאה. הסר כמה פריטים ונסה שוב.",
  "error.organization.itemMissing": "הפריט הזה כבר לא בכספת הארגון.",
  "error.organization.vaultUnreadable":
    "שירות החשבונות לא הצליח לקרוא את כספת הארגון. בקש מבעל הפלטפורמה לבדוק את המפתח שלה.",
  "error.organization.itemInvalid": "אי אפשר לשתף את הפריט הזה עם ארגון.",
  "error.organization.personalMissing": "הפריט הזה כבר לא בכספת שלך.",
  "error.organization.serverNotFound": "השרת הזה אינו מקושר לארגון, או שכבר אינו קיים.",
  "error.organization.serverTaken": "השרת הזה כבר שייך לארגון.",
  "error.organization.serverRevoked": "מנהל השרת הסיר אתכם מהשרת הזה. בקשו הזמנה במקום זאת.",
  "error.organization.serverFull": "השרת הגיע למספר החברים המרבי.",
} as const satisfies PartialTranslation<typeof source>;
