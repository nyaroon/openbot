import { parseServerClaim, type ServerClaim } from "@openbot/contracts/server-install";
import { sourceText } from "@openbot/i18n/source";
import { Effect, type Layer } from "effect";
import { type AccountServiceFailure, AccountServicePlatform } from "./account-service-platform";

type ServerClaimAuth = Parameters<typeof AccountServicePlatform.layer>[0];
type ServerClaimOpenLink = Parameters<typeof AccountServicePlatform.layer>[1];

/** Mints the short-lived claim a freshly installed team server redeems to attach to this account. */
export class ServerClaimDesktopService {
  readonly #platform: Layer.Layer<AccountServicePlatform>;

  constructor(
    auth: ServerClaimAuth,
    openExternal: ServerClaimOpenLink,
    private readonly onClaim: (expiresAt: number) => void = () => {},
  ) {
    this.#platform = AccountServicePlatform.layer(auth, openExternal);
  }

  createServerClaim(): Effect.Effect<ServerClaim, AccountServiceFailure> {
    return AccountServicePlatform.use((platform) =>
      platform.request("/v2/server-claims", { method: "POST" }, decodeServerClaim),
    ).pipe(
      Effect.tap((claim) => Effect.sync(() => this.onClaim(claim.expiresAt))),
      Effect.provide(this.#platform),
    );
  }
}

function decodeServerClaim(value: unknown): ServerClaim {
  const claim = parseServerClaim(value);
  if (!claim) throw new Error(sourceText("error.auth.invalidServerClaim"));
  return claim;
}
