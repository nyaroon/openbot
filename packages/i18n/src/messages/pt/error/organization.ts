import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "Entre na sua conta OpenBot para usar as organizações.",
  "error.organization.unreadable":
    "Os dados da organização neste computador estão ilegíveis. Eles serão buscados de novo no serviço de contas.",
  "error.organization.tooLarge":
    "Os itens compartilhados das suas organizações são grandes demais para ficar neste computador.",
  "error.organization.forbidden": "Você não tem permissão para fazer isso.",
  "error.organization.notFound": "Esta organização não existe mais ou você não é membro dela.",
  "error.organization.lastOwner": "Uma organização precisa de pelo menos um proprietário.",
  "error.organization.memberNotFound": "Esta pessoa não é membro da organização.",
  "error.organization.memberExists": "Esta pessoa já é membro da organização.",
  "error.organization.memberLimit": "A organização atingiu o número máximo de membros.",
  "error.organization.invalidPhone": "Informe um número de WhatsApp válido com o código do país.",
  "error.organization.organizationLimit": "O número máximo de organizações foi atingido.",
  "error.organization.notConfigured":
    "O cofre compartilhado ainda não está configurado no serviço de contas. Peça ao proprietário da plataforma que conclua a configuração.",
  "error.organization.itemConflict":
    "Este item foi alterado em outro computador. Ele foi atualizado, então tente de novo.",
  "error.organization.itemLimit": "O cofre da organização está cheio. Remova alguns itens e tente de novo.",
  "error.organization.itemMissing": "Este item não está mais no cofre da organização.",
  "error.organization.vaultUnreadable":
    "O serviço de contas não conseguiu ler o cofre da organização. Peça ao proprietário da plataforma que verifique a chave dele.",
  "error.organization.itemInvalid": "Este item não pode ser compartilhado com uma organização.",
  "error.organization.personalMissing": "Este item não está mais no seu cofre.",
  "error.organization.serverNotFound": "Este servidor não está vinculado à organização ou não existe mais.",
  "error.organization.serverTaken": "Este servidor já pertence a uma organização.",
  "error.organization.serverRevoked": "Um administrador do servidor removeu você. Peça um convite.",
  "error.organization.serverFull": "O servidor atingiu o número máximo de membros.",
} as const satisfies PartialTranslation<typeof source>;
