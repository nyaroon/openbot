import { createFileRoute } from "@tanstack/solid-router";
import { handleBrowserApi } from "../../../server/browser-api";
import { readHostLogo } from "../../../server/host-logo";
import {
  browserApiErrorResponse,
  requestAccountAttribution,
  requestAuthService,
  requestAvatarBucket,
  requestBillingService,
  requestCustomServerOffers,
  requestExtensionSignIn,
  requestOwnerTransferEmailDelivery,
  requestRemoteControlPlane,
  requestTeamInviteEmailDelivery,
  schedule,
} from "../../../server/request-auth";
import { requestSourceIp } from "../../../server/source-ip";

function handle({ request }: { request: Request }) {
  return handleBrowserApi(request, {
    auth: requestAuthService(),
    remote: requestRemoteControlPlane(),
    extensionSignIn: requestExtensionSignIn,
    hostLogo: (hostId, version) => readHostLogo(requestAvatarBucket(), hostId, version),
    customServerOffers: requestCustomServerOffers,
    inviteEmailDelivery: requestTeamInviteEmailDelivery,
    ownerTransferEmailDelivery: requestOwnerTransferEmailDelivery,
    schedule,
    attribution: requestAccountAttribution,
    billing: requestBillingService,
    avatarBucket: requestAvatarBucket,
    sourceIp: requestSourceIp,
    errorResponse: browserApiErrorResponse,
  });
}

export const Route = createFileRoute("/api/browser/$")({ server: { handlers: { ANY: handle } } });
