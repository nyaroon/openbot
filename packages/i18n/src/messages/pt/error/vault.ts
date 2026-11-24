import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "Essa frase secreta não está correta.",
  "error.vault.universalPassphraseShort": "Use uma frase secreta com pelo menos 10 caracteres.",
  "error.vault.universalSignIn": "Entre na sua conta do OpenBot para usar o cofre universal.",
  "error.vault.universalNotSetUp": "O cofre universal ainda não foi configurado.",
  "error.vault.universalLocked": "Desbloqueie primeiro o cofre universal.",
  "error.vault.universalExists": "Esta conta já tem um cofre universal. Desbloqueie-o com a frase secreta dele.",
  "error.vault.universalChanged": "A frase secreta foi alterada em outro computador. Tente novamente.",
  "error.vault.universalUnavailable": "Não foi possível ler o cofre universal neste computador.",
} as const satisfies PartialTranslation<typeof source>;
