import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "Войдите в аккаунт OpenBot, чтобы пользоваться организациями.",
  "error.organization.unreadable":
    "Данные организаций на этом компьютере нечитаемы. Они будут снова получены от службы аккаунтов.",
  "error.organization.tooLarge":
    "Общие элементы ваших организаций слишком велики, чтобы хранить их на этом компьютере.",
  "error.organization.forbidden": "У вас нет прав на это действие.",
  "error.organization.notFound": "Эта организация больше не существует, или вы в ней не состоите.",
  "error.organization.lastOwner": "В организации должен быть хотя бы один владелец.",
  "error.organization.memberNotFound": "Этот человек не состоит в организации.",
  "error.organization.memberExists": "Этот человек уже состоит в организации.",
  "error.organization.memberLimit": "В организации уже максимальное число участников.",
  "error.organization.invalidPhone": "Введите действительный номер WhatsApp с кодом страны.",
  "error.organization.organizationLimit": "Достигнуто максимальное число организаций.",
  "error.organization.notConfigured":
    "Общее хранилище ещё не настроено в службе аккаунтов. Попросите владельца платформы завершить настройку.",
  "error.organization.itemConflict": "Этот элемент изменён на другом компьютере. Он обновлён, повторите попытку.",
  "error.organization.itemLimit": "Хранилище организации заполнено. Удалите несколько элементов и повторите попытку.",
  "error.organization.itemMissing": "Этого элемента больше нет в хранилище организации.",
  "error.organization.vaultUnreadable":
    "Служба аккаунтов не смогла прочитать хранилище организации. Попросите владельца платформы проверить его ключ.",
  "error.organization.itemInvalid": "Этим элементом нельзя поделиться с организацией.",
  "error.organization.personalMissing": "Этого элемента больше нет в вашем хранилище.",
  "error.organization.serverNotFound": "Этот сервер не привязан к организации или больше не существует.",
  "error.organization.serverTaken": "Этот сервер уже принадлежит организации.",
  "error.organization.serverRevoked": "Администратор сервера удалил вас с него. Попросите приглашение.",
  "error.organization.serverFull": "На сервере достигнуто максимальное число участников.",
} as const satisfies PartialTranslation<typeof source>;
