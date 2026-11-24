import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/vault";

export const messages = {
  "vault.universal.title": "Cofre universal",
  "vault.universal.intro":
    "Os itens que você marca como Universal são criptografados neste computador e sincronizados com todos os computadores conectados à sua conta. O serviço de contas nunca os vê, nem a sua frase secreta.",
  "vault.universal.signedOut": "Entre na sua conta do OpenBot para usar o cofre universal.",
  "vault.universal.passphrase": "Frase secreta",
  "vault.universal.passphraseHint":
    "Use pelo menos 10 caracteres. Se você a perder, os itens sincronizados não poderão ser recuperados.",
  "vault.universal.setUp": "Configurar",
  "vault.universal.unlock": "Desbloquear",
  "vault.universal.lockedHint": "Digite sua frase secreta para desbloquear o cofre universal neste computador.",
  "vault.universal.syncing": "Sincronizando…",
  "vault.universal.upToDate": "Atualizado",
  "vault.universal.neverSynced": "Ainda não sincronizado",
  "vault.universal.pending": {
    one: "{count} alteração aguarda sincronização",
    other: "{count} alterações aguardam sincronização",
  },
  "vault.universal.issueOffline": "O serviço de contas está inacessível. O OpenBot tentará novamente.",
  "vault.universal.issueLimit": "O cofre universal está cheio. Pare de sincronizar alguns itens para adicionar mais.",
  "vault.universal.issueData": "Alguns itens não puderam ser sincronizados.",
  "vault.universal.syncNow": "Sincronizar agora",
  "vault.universal.changePassphrase": "Alterar frase secreta",
  "vault.universal.currentPassphrase": "Frase secreta atual",
  "vault.universal.newPassphrase": "Nova frase secreta",
  "vault.universal.applyChange": "Alterar",
  "vault.universal.dismiss": "Cancelar",
  "vault.universal.forget": "Esquecer neste dispositivo",
  "vault.universal.toggle": "Universal",
  "vault.universal.toggleHint": "Sincronizar este item com todos os seus computadores",
  "vault.universal.badge": "Universal",
  "vault.universal.unshareTitle": "Parar de sincronizar este item?",
  "vault.universal.unshareBody": "Escolha o que acontece com as cópias nos seus outros computadores.",
  "vault.universal.unshareEverywhere": "Parar de sincronizar em todos os lugares",
  "vault.universal.unshareEverywhereHint": "Cada computador mantém a sua própria cópia.",
  "vault.universal.unshareHere": "Parar de sincronizar neste computador",
  "vault.universal.unshareHereHint": "Os outros computadores continuam sincronizando.",
  "vault.universal.deleteNote": "Este item universal será excluído em todos os seus computadores.",
  "vault.universal.conflictCopy": "(cópia de conflito)",
} as const satisfies PartialTranslation<typeof source>;
