import { createFileRoute } from "@tanstack/solid-router";
import { handleBrowserApi } from "../../../server/browser-api";
import { readHostLogo } from "../../../server/host-logo";
import {
  browserApiErrorResponse,
  requestAuthService,
  requestAvatarBucket,
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
    inviteEmailDelivery: requestTeamInviteEmailDelivery,
    ownerTransferEmailDelivery: requestOwnerTransferEmailDelivery,
    schedule,
    avatarBucket: requestAvatarBucket,
    sourceIp: requestSourceIp,
    errorResponse: browserApiErrorResponse,
  });
}

export const Route = createFileRoute("/api/browser/$")({ server: { handlers: { ANY: handle } } });
