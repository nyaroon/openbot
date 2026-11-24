import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "암호 문구가 올바르지 않습니다.",
  "error.vault.universalPassphraseShort": "10자 이상의 암호 문구를 사용하세요.",
  "error.vault.universalSignIn": "범용 보관함을 사용하려면 OpenBot 계정에 로그인하세요.",
  "error.vault.universalNotSetUp": "범용 보관함이 아직 설정되지 않았습니다.",
  "error.vault.universalLocked": "먼저 범용 보관함의 잠금을 해제하세요.",
  "error.vault.universalExists": "이 계정에는 이미 범용 보관함이 있습니다. 암호 문구로 잠금을 해제하세요.",
  "error.vault.universalChanged": "다른 컴퓨터에서 암호 문구가 변경되었습니다. 다시 시도하세요.",
  "error.vault.universalUnavailable": "이 컴퓨터에서 범용 보관함을 읽을 수 없습니다.",
  "error.vault.universalSkillUnsupported":
    "이 스킬은 공유할 수 없습니다. 기본 제공 스킬과 홈 폴더 스킬은 이 컴퓨터에 남습니다.",
} as const satisfies PartialTranslation<typeof source>;
