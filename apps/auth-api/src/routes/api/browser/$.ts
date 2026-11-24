import { createFileRoute } from "@tanstack/solid-router";
import { handleBrowserApi } from "../../../server/browser-api";
import { readHostLogo } from "../../../server/host-logo";
import {
  hostedServerErrorResponse,
  requestAccountAttribution,
  requestAuthService,
  requestAvatarBucket,
  requestBillingService,
  requestCustomServerOffers,
  requestExtensionSignIn,
  requestHostedServerService,
  requestHostedSiteService,
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
    hosting: requestHostedServerService,
    customServerOffers: requestCustomServerOffers,
    inviteEmailDelivery: requestTeamInviteEmailDelivery,
    ownerTransferEmailDelivery: requestOwnerTransferEmailDelivery,
    schedule,
    attribution: requestAccountAttribution,
    billing: requestBillingService,
    avatarBucket: requestAvatarBucket,
    hostedSites: requestHostedSiteService,
    sourceIp: requestSourceIp,
    errorResponse: hostedServerErrorResponse,
  });
}

export const Route = createFileRoute("/api/browser/$")({ server: { handlers: { ANY: handle } } });
