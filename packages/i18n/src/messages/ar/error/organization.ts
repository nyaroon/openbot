import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "سجّل الدخول إلى حسابك في OpenBot لاستخدام المؤسسات.",
  "error.organization.unreadable": "بيانات المؤسسة على هذا الحاسوب غير قابلة للقراءة. ستُجلب مجددًا من خدمة الحسابات.",
  "error.organization.tooLarge": "العناصر المشتركة لمؤسساتك أكبر من أن تُحفظ على هذا الحاسوب.",
  "error.organization.forbidden": "ليست لديك صلاحية للقيام بذلك.",
  "error.organization.notFound": "هذه المؤسسة لم تعد موجودة أو أنك لست عضوًا فيها.",
  "error.organization.lastOwner": "تحتاج المؤسسة إلى مالك واحد على الأقل.",
  "error.organization.memberNotFound": "هذا الشخص ليس عضوًا في المؤسسة.",
  "error.organization.memberExists": "هذا الشخص عضو في المؤسسة بالفعل.",
  "error.organization.memberLimit": "بلغت المؤسسة الحد الأقصى لعدد الأعضاء.",
  "error.organization.invalidPhone": "أدخل رقم واتساب صالحًا مع رمز الدولة.",
  "error.organization.organizationLimit": "تم بلوغ الحد الأقصى لعدد المؤسسات.",
  "error.organization.notConfigured": "لم تُعدّ الخزنة المشتركة في خدمة الحسابات بعد. اطلب من مالك المنصة إكمال الإعداد.",
  "error.organization.itemConflict": "تم تغيير هذا العنصر على حاسوب آخر. جرى تحديثه، فحاول مرة أخرى.",
  "error.organization.itemLimit": "خزنة المؤسسة ممتلئة. أزل بعض العناصر ثم حاول مرة أخرى.",
  "error.organization.itemMissing": "لم يعد هذا العنصر في خزنة المؤسسة.",
  "error.organization.vaultUnreadable":
    "تعذّر على خدمة الحسابات قراءة خزنة المؤسسة. اطلب من مالك المنصة التحقق من مفتاحها.",
  "error.organization.itemInvalid": "لا يمكن مشاركة هذا العنصر مع مؤسسة.",
  "error.organization.personalMissing": "لم يعد هذا العنصر في خزنتك.",
} as const satisfies PartialTranslation<typeof source>;
