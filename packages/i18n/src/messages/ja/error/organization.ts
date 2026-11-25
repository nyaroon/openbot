import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "組織を使うには OpenBot アカウントにサインインしてください。",
  "error.organization.unreadable": "このコンピュータの組織データを読み取れません。アカウントサービスから再取得します。",
  "error.organization.tooLarge": "組織の共有項目が大きすぎて、このコンピュータに保持できません。",
  "error.organization.forbidden": "この操作を行う権限がありません。",
  "error.organization.notFound": "この組織は存在しないか、メンバーではありません。",
  "error.organization.lastOwner": "組織には少なくとも 1 人のオーナーが必要です。",
  "error.organization.memberNotFound": "この人は組織のメンバーではありません。",
  "error.organization.memberExists": "この人はすでに組織のメンバーです。",
  "error.organization.memberLimit": "組織のメンバー数が上限に達しています。",
  "error.organization.invalidPhone": "国番号付きの有効な WhatsApp 番号を入力してください。",
  "error.organization.organizationLimit": "組織の数が上限に達しました。",
  "error.organization.notConfigured":
    "共有保管庫はアカウントサービスでまだ設定されていません。プラットフォームオーナーに設定の完了を依頼してください。",
  "error.organization.itemConflict":
    "この項目は別のコンピュータで変更されました。最新の内容に更新したので、もう一度お試しください。",
  "error.organization.itemLimit": "組織の保管庫がいっぱいです。項目をいくつか削除してから、もう一度お試しください。",
  "error.organization.itemMissing": "この項目は組織の保管庫にもうありません。",
  "error.organization.vaultUnreadable":
    "アカウントサービスが組織の保管庫を読み取れませんでした。プラットフォームオーナーにキーの確認を依頼してください。",
  "error.organization.itemInvalid": "この項目は組織と共有できません。",
  "error.organization.personalMissing": "この項目は保管庫にもうありません。",
} as const satisfies PartialTranslation<typeof source>;
