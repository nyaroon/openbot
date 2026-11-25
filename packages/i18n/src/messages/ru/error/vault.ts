import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "Неверная парольная фраза.",
  "error.vault.universalPassphraseShort": "Используйте парольную фразу не короче 10 символов.",
  "error.vault.universalSignIn": "Войдите в учётную запись OpenBot, чтобы пользоваться универсальным хранилищем.",
  "error.vault.universalNotSetUp": "Универсальное хранилище ещё не настроено.",
  "error.vault.universalLocked": "Сначала разблокируйте универсальное хранилище.",
  "error.vault.universalExists":
    "У этой учётной записи уже есть универсальное хранилище. Разблокируйте его его парольной фразой.",
  "error.vault.universalChanged": "Парольная фраза была изменена на другом компьютере. Повторите попытку.",
  "error.vault.universalUnavailable": "Не удалось прочитать универсальное хранилище на этом компьютере.",
  "error.vault.universalSkillUnsupported":
    "Этот навык нельзя передать. Встроенные навыки и навыки из домашней папки остаются на этом компьютере.",
  "error.vault.sharedReadOnly": "Этим элементом поделилась организация, и здесь его изменить нельзя.",
} as const satisfies PartialTranslation<typeof source>;
