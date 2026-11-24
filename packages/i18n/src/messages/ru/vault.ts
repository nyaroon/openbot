import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/vault";

export const messages = {
  "vault.universal.title": "Универсальное хранилище",
  "vault.universal.intro":
    "Элементы, помеченные как универсальные, шифруются на этом компьютере и синхронизируются со всеми компьютерами, где выполнен вход в вашу учётную запись. Служба учётных записей никогда не видит ни их, ни вашу парольную фразу.",
  "vault.universal.signedOut": "Войдите в учётную запись OpenBot, чтобы пользоваться универсальным хранилищем.",
  "vault.universal.passphrase": "Парольная фраза",
  "vault.universal.passphraseHint":
    "Используйте не менее 10 символов. Если вы её потеряете, синхронизированные элементы восстановить не удастся.",
  "vault.universal.setUp": "Настроить",
  "vault.universal.unlock": "Разблокировать",
  "vault.universal.lockedHint":
    "Введите парольную фразу, чтобы разблокировать универсальное хранилище на этом компьютере.",
  "vault.universal.syncing": "Синхронизация…",
  "vault.universal.upToDate": "Всё актуально",
  "vault.universal.neverSynced": "Ещё не синхронизировано",
  "vault.universal.pending": {
    one: "{count} изменение ожидает синхронизации",
    few: "{count} изменения ожидают синхронизации",
    many: "{count} изменений ожидают синхронизации",
    other: "{count} изменения ожидают синхронизации",
  },
  "vault.universal.issueOffline": "Служба учётных записей недоступна. OpenBot повторит попытку.",
  "vault.universal.issueLimit":
    "Универсальное хранилище заполнено. Прекратите синхронизацию некоторых элементов, чтобы добавить новые.",
  "vault.universal.issueData": "Некоторые элементы не удалось синхронизировать.",
  "vault.universal.syncNow": "Синхронизировать сейчас",
  "vault.universal.changePassphrase": "Изменить парольную фразу",
  "vault.universal.currentPassphrase": "Текущая парольная фраза",
  "vault.universal.newPassphrase": "Новая парольная фраза",
  "vault.universal.applyChange": "Изменить",
  "vault.universal.dismiss": "Отмена",
  "vault.universal.forget": "Забыть на этом устройстве",
  "vault.universal.toggle": "Универсальный",
  "vault.universal.toggleHint": "Синхронизировать этот элемент со всеми вашими компьютерами",
  "vault.universal.badge": "Универсальный",
  "vault.universal.unshareTitle": "Прекратить синхронизацию этого элемента?",
  "vault.universal.unshareBody": "Выберите, что произойдёт с копиями на ваших других компьютерах.",
  "vault.universal.unshareEverywhere": "Прекратить синхронизацию везде",
  "vault.universal.unshareEverywhereHint": "На каждом компьютере останется своя копия.",
  "vault.universal.unshareHere": "Прекратить синхронизацию на этом компьютере",
  "vault.universal.unshareHereHint": "Другие компьютеры продолжат её синхронизировать.",
  "vault.universal.deleteNote": "Этот универсальный элемент будет удалён на всех ваших компьютерах.",
  "vault.universal.conflictCopy": "(копия при конфликте)",
} as const satisfies PartialTranslation<typeof source>;
