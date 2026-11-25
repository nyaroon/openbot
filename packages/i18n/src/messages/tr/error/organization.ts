import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "Kuruluşları kullanmak için OpenBot hesabınızda oturum açın.",
  "error.organization.unreadable": "Bu bilgisayardaki kuruluş verileri okunamıyor. Hesap hizmetinden yeniden alınacak.",
  "error.organization.tooLarge": "Kuruluşlarınızın paylaşılan öğeleri bu bilgisayarda tutulamayacak kadar büyük.",
  "error.organization.forbidden": "Bunu yapma izniniz yok.",
  "error.organization.notFound": "Bu kuruluş artık yok ya da üyesi değilsiniz.",
  "error.organization.lastOwner": "Bir kuruluşun en az bir sahibi olmalıdır.",
  "error.organization.memberNotFound": "Bu kişi kuruluşun üyesi değil.",
  "error.organization.memberExists": "Bu kişi zaten kuruluşun üyesi.",
  "error.organization.memberLimit": "Kuruluş en fazla üye sayısına ulaştı.",
  "error.organization.invalidPhone": "Ülke koduyla birlikte geçerli bir WhatsApp numarası girin.",
  "error.organization.organizationLimit": "En fazla kuruluş sayısına ulaşıldı.",
  "error.organization.notConfigured":
    "Paylaşılan kasa hesap hizmetinde henüz kurulmadı. Platform sahibinden kurulumu tamamlamasını isteyin.",
  "error.organization.itemConflict": "Bu öğe başka bir bilgisayarda değiştirildi. Yenilendi, yeniden deneyin.",
  "error.organization.itemLimit": "Kuruluş kasası dolu. Bazı öğeleri çıkarıp yeniden deneyin.",
  "error.organization.itemMissing": "Bu öğe artık kuruluş kasasında değil.",
  "error.organization.vaultUnreadable":
    "Hesap hizmeti kuruluş kasasını okuyamadı. Platform sahibinden anahtarını kontrol etmesini isteyin.",
  "error.organization.itemInvalid": "Bu öğe bir kuruluşla paylaşılamaz.",
  "error.organization.personalMissing": "Bu öğe artık kasanızda değil.",
  "error.organization.serverNotFound": "Bu sunucu kuruluşa bağlı değil ya da artık yok.",
  "error.organization.serverTaken": "Bu sunucu zaten bir kuruluşa ait.",
  "error.organization.serverRevoked": "Bir sunucu yöneticisi seni bu sunucudan çıkardı. Bunun yerine davet iste.",
  "error.organization.serverFull": "Sunucu izin verilen en yüksek üye sayısına ulaştı.",
} as const satisfies PartialTranslation<typeof source>;
