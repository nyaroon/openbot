import { normalizePhoneNumber, phoneIdentityEmail } from "@openbot/contracts/phone-identity";

export interface OwnerPolicy {
  closed: boolean;
  owners: ReadonlySet<string>;
}

export const OPEN_REGISTRATION: OwnerPolicy = { closed: false, owners: new Set() };

export function readOwnerPolicy(value: string | undefined): OwnerPolicy {
  if (!value?.trim()) return OPEN_REGISTRATION;
  const owners = new Set<string>();
  for (const entry of value.split(",")) {
    const phone = normalizePhoneNumber(entry);
    if (phone) owners.add(phoneIdentityEmail(phone));
  }
  return { closed: true, owners };
}
