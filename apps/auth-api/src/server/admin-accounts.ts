import { normalizePhoneNumber, phoneIdentityEmail } from "@openbot/contracts/phone-identity";
import { type DynamicRecord, isString } from "@openbot/contracts/runtime-values";
import { Effect } from "effect";
import { type AuthService, AuthServiceError } from "./auth-service";
import { type OrganizationActor, OrganizationError, type Organizations, readOrganizationName } from "./organizations";

interface AdminAccountInput {
  phone: string;
  name?: string;
  /** Where the account goes: an existing organization, or a new one that it owns. */
  place: { organizationId: string; role: "admin" | "member" } | { organizationName: string } | null;
}

const invalid = (code: string, message: string) => new AuthServiceError(400, code, message);

function readAdminAccountInput(body: DynamicRecord): AdminAccountInput | AuthServiceError {
  if (!isString(body.phone)) return invalid("invalid_phone", "Enter a valid WhatsApp number.");
  if (body.name !== undefined && !isString(body.name)) {
    return invalid("invalid_profile_name", "Enter a valid display name.");
  }
  const name = body.name === undefined ? {} : { name: body.name };
  if (body.organizationId !== undefined && body.organizationName !== undefined) {
    return invalid("invalid_organization", "Choose one organization.");
  }
  if (body.organizationName !== undefined) {
    const organizationName = readOrganizationName(body.organizationName);
    if (!organizationName) return invalid("invalid_organization", "The organization is not valid.");
    return { phone: body.phone, ...name, place: { organizationName } };
  }
  if (body.organizationId !== undefined) {
    const role = body.role === undefined ? "member" : body.role;
    if (!isString(body.organizationId) || (role !== "admin" && role !== "member")) {
      return invalid("invalid_organization", "The organization is not valid.");
    }
    return { phone: body.phone, ...name, place: { organizationId: body.organizationId, role } };
  }
  return { phone: body.phone, ...name, place: null };
}

/**
 * An owner adds a person. With an organization, the account becomes a member of it (or the owner of
 * a new one), and a number that already has an account is simply placed there.
 */
export const createAdminAccount = Effect.fn("createAdminAccount")(function* (
  services: {
    auth: Pick<AuthService, "createAccount" | "listAccounts">;
    organizations: Organizations;
  },
  token: string,
  actor: OrganizationActor,
  body: DynamicRecord,
) {
  const input = readAdminAccountInput(body);
  if (input instanceof AuthServiceError) return yield* input;
  const { place } = input;
  const created = yield* services.auth
    .createAccount(token, { phone: input.phone, name: input.name })
    .pipe(
      Effect.catch((error) =>
        place && error instanceof AuthServiceError && error.code === "account_exists"
          ? Effect.succeed(null)
          : Effect.fail(error),
      ),
    );
  if (!place) {
    if (created) return created;
    return yield* new AuthServiceError(409, "account_exists", "This number already has an account.");
  }
  yield* "organizationName" in place
    ? settled(services.organizations.create(actor, { name: place.organizationName, ownerNumber: input.phone }))
    : settled(services.organizations.addMember(actor, place.organizationId, { number: input.phone, role: place.role }));
  const accounts = yield* services.auth.listAccounts(token);
  if (created) return accounts.find((item) => item.id === created.id) ?? created;
  // The number had an account before, so the list is the only place its row can come from.
  const phone = normalizePhoneNumber(input.phone);
  const email = phone ? phoneIdentityEmail(phone) : null;
  const existing = accounts.find((item) => item.email === email);
  if (existing) return existing;
  return yield* new AuthServiceError(409, "account_exists", "This number already has an account.");
});

/** Turns an organization refusal into an account one. Already being a member is not a refusal. */
function settled<Value, Failure, Needs>(placed: Effect.Effect<Value, Failure, Needs>) {
  return placed.pipe(
    Effect.catch((error): Effect.Effect<null, Failure | AuthServiceError> => {
      if (!(error instanceof OrganizationError)) return Effect.fail(error);
      if (error.code === "member_exists") return Effect.succeed(null);
      return Effect.fail(new AuthServiceError(error.status, error.code, error.message));
    }),
  );
}
