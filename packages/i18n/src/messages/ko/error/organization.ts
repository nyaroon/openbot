import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "조직을 사용하려면 OpenBot 계정에 로그인하세요.",
  "error.organization.unreadable": "이 컴퓨터의 조직 데이터를 읽을 수 없습니다. 계정 서비스에서 다시 가져옵니다.",
  "error.organization.tooLarge": "조직의 공유 항목이 너무 커서 이 컴퓨터에 보관할 수 없습니다.",
  "error.organization.forbidden": "이 작업을 할 권한이 없습니다.",
  "error.organization.notFound": "이 조직이 더 이상 없거나 구성원이 아닙니다.",
  "error.organization.lastOwner": "조직에는 소유자가 한 명 이상 있어야 합니다.",
  "error.organization.memberNotFound": "이 사람은 조직의 구성원이 아닙니다.",
  "error.organization.memberExists": "이 사람은 이미 조직의 구성원입니다.",
  "error.organization.memberLimit": "조직의 구성원 수가 최대치에 도달했습니다.",
  "error.organization.invalidPhone": "국가 번호가 포함된 올바른 WhatsApp 번호를 입력하세요.",
  "error.organization.organizationLimit": "조직 수가 최대치에 도달했습니다.",
  "error.organization.notConfigured":
    "공유 보관함이 계정 서비스에 아직 설정되지 않았습니다. 플랫폼 소유자에게 설정을 마쳐 달라고 요청하세요.",
  "error.organization.itemConflict": "이 항목이 다른 컴퓨터에서 변경되었습니다. 새로 불러왔으니 다시 시도하세요.",
  "error.organization.itemLimit": "조직 보관함이 가득 찼습니다. 항목을 일부 제거한 뒤 다시 시도하세요.",
  "error.organization.itemMissing": "이 항목이 더 이상 조직 보관함에 없습니다.",
  "error.organization.vaultUnreadable":
    "계정 서비스가 조직 보관함을 읽지 못했습니다. 플랫폼 소유자에게 키를 확인해 달라고 요청하세요.",
  "error.organization.itemInvalid": "이 항목은 조직과 공유할 수 없습니다.",
  "error.organization.personalMissing": "이 항목이 더 이상 내 보관함에 없습니다.",
} as const satisfies PartialTranslation<typeof source>;
