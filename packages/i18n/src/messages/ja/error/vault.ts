import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "パスフレーズが正しくありません。",
  "error.vault.universalPassphraseShort": "10 文字以上のパスフレーズを使用してください。",
  "error.vault.universalSignIn": "ユニバーサル保管庫を使うには、OpenBot アカウントにサインインしてください。",
  "error.vault.universalNotSetUp": "ユニバーサル保管庫はまだ設定されていません。",
  "error.vault.universalLocked": "先にユニバーサル保管庫のロックを解除してください。",
  "error.vault.universalExists":
    "このアカウントにはすでにユニバーサル保管庫があります。パスフレーズでロックを解除してください。",
  "error.vault.universalChanged": "パスフレーズがほかのコンピューターで変更されました。もう一度お試しください。",
  "error.vault.universalUnavailable": "このコンピューターでユニバーサル保管庫を読み取れませんでした。",
  "error.vault.universalSkillUnsupported":
    "このスキルは共有できません。組み込みスキルとホームフォルダーのスキルはこのコンピューターに残ります。",
} as const satisfies PartialTranslation<typeof source>;
