import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/vault";

export const messages = {
  "vault.universal.title": "ユニバーサル保管庫",
  "vault.universal.intro":
    "「ユニバーサル」にした項目は、このコンピューターで暗号化され、アカウントにサインインしているすべてのコンピューターと同期されます。アカウントサービスは項目もパスフレーズも一切見ることができません。",
  "vault.universal.signedOut": "ユニバーサル保管庫を使うには、OpenBot アカウントにサインインしてください。",
  "vault.universal.passphrase": "パスフレーズ",
  "vault.universal.passphraseHint": "10 文字以上にしてください。紛失すると、同期された項目は復元できません。",
  "vault.universal.setUp": "設定する",
  "vault.universal.unlock": "ロック解除",
  "vault.universal.lockedHint":
    "このコンピューターでユニバーサル保管庫のロックを解除するには、パスフレーズを入力してください。",
  "vault.universal.syncing": "同期中…",
  "vault.universal.upToDate": "最新の状態です",
  "vault.universal.neverSynced": "まだ同期されていません",
  "vault.universal.pending": { other: "{count} 件の変更が同期を待っています" },
  "vault.universal.issueOffline": "アカウントサービスに接続できません。OpenBot は再試行します。",
  "vault.universal.issueLimit":
    "ユニバーサル保管庫がいっぱいです。さらに追加するには、一部の項目の同期を停止してください。",
  "vault.universal.issueData": "一部の項目を同期できませんでした。",
  "vault.universal.syncNow": "今すぐ同期",
  "vault.universal.changePassphrase": "パスフレーズを変更",
  "vault.universal.currentPassphrase": "現在のパスフレーズ",
  "vault.universal.newPassphrase": "新しいパスフレーズ",
  "vault.universal.applyChange": "変更",
  "vault.universal.dismiss": "キャンセル",
  "vault.universal.forget": "このデバイスから削除",
  "vault.universal.toggle": "ユニバーサル",
  "vault.universal.toggleHint": "この項目をすべてのコンピューターと同期する",
  "vault.universal.badge": "ユニバーサル",
  "vault.universal.unshareTitle": "この項目の同期を停止しますか？",
  "vault.universal.unshareBody": "ほかのコンピューターにあるコピーをどうするか選んでください。",
  "vault.universal.unshareEverywhere": "すべての場所で同期を停止",
  "vault.universal.unshareEverywhereHint": "各コンピューターが自分のコピーを保持します。",
  "vault.universal.unshareHere": "このコンピューターでのみ同期を停止",
  "vault.universal.unshareHereHint": "ほかのコンピューターでは同期が続きます。",
  "vault.universal.deleteNote": "このユニバーサル項目は、すべてのコンピューターで削除されます。",
  "vault.universal.conflictCopy": "（競合コピー）",
} as const satisfies PartialTranslation<typeof source>;
