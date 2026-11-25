import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "登录 OpenBot 账户以使用组织。",
  "error.organization.unreadable": "此电脑上的组织数据无法读取，将重新从账户服务获取。",
  "error.organization.tooLarge": "你的组织的共享项目太大，无法保存在此电脑上。",
  "error.organization.forbidden": "你没有执行此操作的权限。",
  "error.organization.notFound": "该组织已不存在，或你不是它的成员。",
  "error.organization.lastOwner": "组织至少需要一位所有者。",
  "error.organization.memberNotFound": "此人不是该组织的成员。",
  "error.organization.memberExists": "此人已经是该组织的成员。",
  "error.organization.memberLimit": "该组织的成员数已达上限。",
  "error.organization.invalidPhone": "请输入带国家区号的有效 WhatsApp 号码。",
  "error.organization.organizationLimit": "组织数量已达上限。",
  "error.organization.notConfigured": "账户服务尚未设置共享保险库。请让平台所有者完成设置。",
  "error.organization.itemConflict": "此项目已在另一台电脑上更改。已为你刷新，请重试。",
  "error.organization.itemLimit": "组织保险库已满。请移除一些项目后重试。",
  "error.organization.itemMissing": "此项目已不在组织保险库中。",
  "error.organization.vaultUnreadable": "账户服务无法读取组织保险库。请让平台所有者检查其密钥。",
  "error.organization.itemInvalid": "此项目无法与组织共享。",
  "error.organization.personalMissing": "此项目已不在你的保险库中。",
} as const satisfies PartialTranslation<typeof source>;
