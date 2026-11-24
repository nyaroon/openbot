import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "Bu parola ifadesi doğru değil.",
  "error.vault.universalPassphraseShort": "En az 10 karakterlik bir parola ifadesi kullanın.",
  "error.vault.universalSignIn": "Evrensel kasayı kullanmak için OpenBot hesabınızda oturum açın.",
  "error.vault.universalNotSetUp": "Evrensel kasa henüz kurulmadı.",
  "error.vault.universalLocked": "Önce evrensel kasanın kilidini açın.",
  "error.vault.universalExists": "Bu hesapta zaten bir evrensel kasa var. Parola ifadesiyle kilidini açın.",
  "error.vault.universalChanged": "Parola ifadesi başka bir bilgisayarda değiştirildi. Yeniden deneyin.",
  "error.vault.universalUnavailable": "Evrensel kasa bu bilgisayarda okunamadı.",
  "error.vault.universalSkillUnsupported":
    "Bu beceri paylaşılamaz. Yerleşik ve ana klasördeki beceriler bu bilgisayarda kalır.",
} as const satisfies PartialTranslation<typeof source>;
