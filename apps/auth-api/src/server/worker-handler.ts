import { Effect, Result } from "effect";
import { type AuthRetentionResult, pruneExpiredAuthData } from "./auth-data-retention";
import { BillingSales } from "./billing-sales";
import { captureBillingSnapshot } from "./billing-snapshots";
import { canonicalHostRedirect, permanentTrailingSlashRedirect } from "./canonical-redirect";
import { runApiEffect } from "./effect-runtime";
import { enforceMarketplaceIngress, MarketplaceRateLimitError } from "./marketplace-request-policy";
import { observedD1 } from "./observed-d1";
import { createOperatorAlert } from "./operator-alert";
import { pageMarkdownResponse } from "./page-markdown";
import { deliverPendingRemoteAuthEvents, type RemoteAuthEventBindings } from "./remote-control-plane";
import { SalesAnalyticsDelivery } from "./sales-analytics-delivery";
import { checkSignalEntry, SIGNAL_ENTRY_CRON, type SignalEntryBindings } from "./signal-entry-failover";
import type { WorkerBindings } from "./types";

type WorkerFetch = (request: Request) => Response | Promise<Response>;
type AuthDataPruner = typeof pruneExpiredAuthData;
type RetentionLogger = (result: AuthRetentionResult) => void;
type WorkerExecutionContext = Pick<ExecutionContext, "waitUntil">;
type RemoteAuthEventDelivery = typeof deliverPendingRemoteAuthEvents;

export function createWorkerHandler(
  fetchHandler: WorkerFetch,
  prune: AuthDataPruner = pruneExpiredAuthData,
  log: RetentionLogger = logRetentionResult,
  deliverRemoteAuthEvents: RemoteAuthEventDelivery = deliverPendingRemoteAuthEvents,
) {
  return {
    async fetch(
      request: Request,
      workerBindings: Pick<WorkerBindings, "MARKETPLACE_INGRESS_RATE_LIMITER"> &
        Partial<Pick<WorkerBindings, "DB" | "OPENPANEL_CLIENT_ID" | "OPENPANEL_CLIENT_SECRET">>,
      context?: WorkerExecutionContext,
    ) {
      const bindings = workerBindings.DB ? { ...workerBindings, DB: observedD1(workerBindings.DB) } : workerBindings;
      const hostRedirect = canonicalHostRedirect(request);
      if (hostRedirect) return hostRedirect;
      if (request.method === "GET" && new URL(request.url).pathname === "/billing/checkout-return") {
        return runApiEffect(checkoutReturnResponse(request, bindings));
      }
      const earlyResponse = await runApiEffect(
        Effect.gen(function* () {
          yield* enforceMarketplaceIngress(request, bindings);
          return null;
        }).pipe(
          Effect.catchIf(
            (error) => error instanceof MarketplaceRateLimitError,
            (error) =>
              Effect.succeed(
                Response.json(
                  { error: { code: error.code, message: error.message } },
                  {
                    status: error.status,
                    headers: {
                      "Cache-Control": "no-store",
                      "Retry-After": String(error.retryAfterSeconds),
                      "X-Content-Type-Options": "nosniff",
                    },
                  },
                ),
              ),
          ),
        ),
      );
      if (earlyResponse) return earlyResponse;
      const markdown = await pageMarkdownResponse(request, fetchHandler);
      if (markdown) return markdown;
      const response = Promise.resolve(fetchHandler(request)).then((result) =>
        permanentTrailingSlashRedirect(request, result),
      );
      if (context && isEmailSignInStart(request)) {
        context.waitUntil(
          response.then(
            () => undefined,
            () => undefined,
          ),
        );
      }
      return response;
    },
    async scheduled(
      controller: Pick<ScheduledController, "scheduledTime"> & Partial<Pick<ScheduledController, "cron">>,
      workerBindings: RemoteAuthEventBindings &
        Partial<SignalEntryBindings & Pick<WorkerBindings, "OPENPANEL_CLIENT_ID" | "OPENPANEL_CLIENT_SECRET">>,
    ) {
      const bindings = { ...workerBindings, DB: observedD1(workerBindings.DB) };
      if (controller.cron === SIGNAL_ENTRY_CRON) {
        await runSignalEntryCheck(bindings);
        return;
      }
      const now = controller.scheduledTime;
      const [retention] = await runApiEffect(
        Effect.all(
          [
            Effect.exit(isDailyRetentionRun(now) ? prune(bindings.DB, now) : Effect.succeed(null)),
            Effect.exit(deliverRemoteAuthEvents(bindings, now)),
            Effect.exit(tickSalesAnalytics(bindings, now)),
          ],
          { concurrency: "unbounded" },
        ).pipe(
          Effect.flatMap(([retentionExit, deliveryExit, salesExit]) =>
            Effect.all([retentionExit, deliveryExit, salesExit]),
          ),
        ),
      );
      if (retention) log(retention);
    },
  } satisfies ExportedHandler<WorkerBindings>;
}

async function runSignalEntryCheck(bindings: Partial<SignalEntryBindings>): Promise<void> {
  const result = await Effect.runPromise(
    Effect.result(checkSignalEntry(bindings, { fetch: (input, init) => fetch(input, init) })),
  );
  if (Result.isFailure(result)) {
    console.error("Signal entry check failed.", { operation: result.failure.operation, status: result.failure.status });
    return;
  }
  const check = result.success;
  if (check.status === "moved") console.warn("Signal entry moved.", check);
  else if (check.status === "kept" || check.status === "unknown") console.warn("Signal entry not changed.", check);
}

type SalesBindings = Pick<WorkerBindings, "DB"> &
  Partial<
    Pick<
      WorkerBindings,
      "STRIPE_SECRET_KEY" | "OPENPANEL_CLIENT_ID" | "OPENPANEL_CLIENT_SECRET" | "OPERATOR_ALERT_WEBHOOK_URL"
    >
  >;

const tickSalesAnalytics = Effect.fn("SalesAnalytics.tick")(function* (bindings: SalesBindings, now: number) {
  if (!bindings.OPENPANEL_CLIENT_ID?.trim() || !bindings.OPENPANEL_CLIENT_SECRET?.trim()) return;
  const options = {
    database: bindings.DB,
    clientId: bindings.OPENPANEL_CLIENT_ID,
    clientSecret: bindings.OPENPANEL_CLIENT_SECRET,
    fetch: (input: string, init: RequestInit) => fetch(input, init),
  };
  const saleAlert = createOperatorAlert(bindings.OPERATOR_ALERT_WEBHOOK_URL, options.fetch);
  const payments = yield* Effect.exit(new BillingSales({ ...options, saleAlert }).processPending());
  const snapshot = yield* Effect.exit(captureBillingSnapshot(bindings, now));
  const result = yield* new SalesAnalyticsDelivery(options).drain();
  console.info("Sales analytics delivery completed.", result);
  yield* payments;
  yield* snapshot;
});

const checkoutReturnResponse = Effect.fn("BillingSales.returnResponse")(function* (
  request: Request,
  bindings: Partial<SalesBindings>,
) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  let destination = "/billing/return?kind=plan";
  if (token && bindings.DB && bindings.OPENPANEL_CLIENT_ID && bindings.OPENPANEL_CLIENT_SECRET) {
    const sales = new BillingSales({
      database: bindings.DB,
      clientId: bindings.OPENPANEL_CLIENT_ID,
      clientSecret: bindings.OPENPANEL_CLIENT_SECRET,
      fetch: (input, init) => fetch(input, init),
    });
    destination =
      (yield* sales.returned(token).pipe(
        Effect.catch(() =>
          Effect.sync(() => {
            console.warn("Checkout return analytics failed.");
            return null;
          }),
        ),
      )) ?? destination;
  }
  const location = new URL(destination, url.origin);
  location.searchParams.set("cancelled", "1");
  return new Response(null, {
    status: 303,
    headers: {
      Location: location.href,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
});

function isEmailSignInStart(request: Request): boolean {
  return (
    request.method === "POST" &&
    ["/v1/auth/email/start", "/api/browser/email/start"].includes(new URL(request.url).pathname)
  );
}

function isDailyRetentionRun(scheduledTime: number): boolean {
  const scheduled = new Date(scheduledTime);
  return scheduled.getUTCHours() === 0 && scheduled.getUTCMinutes() === 0;
}

function logRetentionResult(result: AuthRetentionResult): void {
  console.info("Auth data retention completed.", result);
}
