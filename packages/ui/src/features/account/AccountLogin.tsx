import { AppLogo } from "@openbot/brand";
import { INPUT_LIMITS } from "@openbot/contracts/input-limits";
import type { AppVariant, CentralAuthIssue, CentralAuthState } from "@openbot/contracts/ipc";
import {
  formatAccountIdentity,
  normalizeAccountIdentity,
  phoneFromIdentityEmail,
} from "@openbot/contracts/phone-identity";
import { PRODUCT_NAME } from "@openbot/contracts/product";
import { normalizeOneTimeCode } from "@openbot/contracts/validation";
import type { TranslatedLocale } from "@openbot/i18n";
import { appLanguageOption } from "@openbot/i18n/languages";
import { ArrowLeft, Button, ErrorReference, Globe2, Input, Lock, RefreshCw } from "@openbot/ui";
import { errorReference, type UserErrorDetails } from "@openbot/user-errors";
import type { JSX } from "@solidjs/web";
import { createEffect, createMemo, createSignal, onCleanup, Show, untrack } from "solid-js";
import { QrCode } from "../../qr-code";
import { useText } from "../../text";
import { OtpInput, type OtpInputStatus } from "./OtpInput";

interface AccountLoginProps {
  variant: AppVariant;
  state: CentralAuthState;
  onRetry: () => Promise<void>;
  onRequestEmailCode: (email: string) => Promise<void>;
  onVerifyEmailCode: (challengeId: string, code: string) => Promise<void>;
  onReset: () => Promise<void>;
  /** Opens the WhatsApp link of a reverse sign-in. Without it, only the QR code is shown. */
  onOpenWhatsApp?: (url: string) => void;
  consent?: JSX.Element;
  notice?: JSX.Element;
  language?: TranslatedLocale;
  onChangeLanguage?: () => void;
  revealed?: boolean;
}

type PendingAction = "retry" | "send" | "check" | "verify" | "resend" | "reset";
type LoginStep = "email" | "code";
type LoginTransition = "none" | "forward" | "back";

const FIELD_ISSUES = new Set([
  "invalid_email",
  "invalid_sign_in_code",
  "sign_in_code_expired",
  "too_many_code_attempts",
]);
const NEW_CODE_ISSUES = new Set(["sign_in_code_expired", "too_many_code_attempts"]);
const UNCERTAIN_EMAIL_DELIVERY_ISSUES = new Set([
  "email_delivery_pending",
  "email_delivery_timeout",
  "email_delivery_unknown",
]);

const EMAIL_PLACEHOLDER = "+62 812 3456 7890";
const WHATSAPP_PENDING_ISSUE = "whatsapp_message_pending";
const WHATSAPP_CHECK_INTERVAL_MS = 3_000;
const EMAIL_MARKER = "\u0000";

export function AccountLogin(props: AccountLoginProps) {
  const { t, sourceText } = useText();
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [presentedEmailError, setPresentedEmailError] = createSignal<string | null>(null);
  const [emailErrorActive, setEmailErrorActive] = createSignal(false);
  const [emailShaking, setEmailShaking] = createSignal(false);
  const [codeError, setCodeError] = createSignal<string | null>(null);
  const [localError, setLocalError] = createSignal<UserErrorDetails | null>(null);
  const [pendingAction, setPendingAction] = createSignal<PendingAction | null>(null);
  const [issueVisible, setIssueVisible] = createSignal(true);
  const [issueBlockedUntil, setIssueBlockedUntil] = createSignal(0);
  const [now, setNow] = createSignal(Date.now());
  const [loginTransition, setLoginTransition] = createSignal<LoginTransition>("none");
  let emailInput: HTMLInputElement | undefined;
  let emailShakeTimer: number | undefined;
  let emailRevertTimer: number | undefined;
  let emailMessageTimer: number | undefined;

  onCleanup(clearEmailErrorTimers);

  const countdownUntil = createMemo(() => {
    const resendAt = props.state.status === "code_sent" ? props.state.resendAvailableAt : 0;
    return Math.max(resendAt, issueBlockedUntil());
  });

  createEffect(
    () => countdownUntil(),
    (until) => {
      setNow(Date.now());
      if (until <= Date.now()) return;
      const clock = window.setInterval(() => {
        setNow(Date.now());
        if (Date.now() >= until) window.clearInterval(clock);
      }, 1_000);
      return () => window.clearInterval(clock);
    },
  );

  const codeSent = () => props.state.status === "code_sent";
  const verified = () => props.state.status === "signed_in";
  const loginStep = (): LoginStep => (codeSent() || verified() ? "code" : "email");
  const challenge = () => (props.state.status === "code_sent" ? props.state : undefined);
  const whatsapp = () => challenge()?.whatsapp;
  const connecting = () => props.state.status === "loading";
  const keyringChanged = () => props.state.status === "signed_out" && props.state.reason === "keyring_changed";
  const currentIssue = (): CentralAuthIssue | undefined => {
    if (props.state.status === "error") return props.state.issue;
    if (props.state.status !== "code_sent") return undefined;
    // Waiting for the WhatsApp message is the normal state of a reverse sign-in, not a problem.
    return props.state.issue?.code === WHATSAPP_PENDING_ISSUE ? undefined : props.state.issue;
  };
  const displayedIssue = () => (issueVisible() ? currentIssue() : undefined);
  const unavailable = () => props.state.status === "error" && props.state.issue.code === "auth_api_unavailable";
  const unavailableIssue = () => (unavailable() && props.state.status === "error" ? props.state.issue : undefined);
  const codeNeedsReplacement = () => {
    const issue = currentIssue();
    return Boolean(issue && NEW_CODE_ISSUES.has(issue.code));
  };
  const resendAvailableIn = () => {
    if (props.state.status !== "code_sent") return 0;
    return secondsUntil(Math.max(props.state.resendAvailableAt, issueBlockedUntil()), now());
  };
  const emailRetryIn = () => {
    const issue = currentIssue();
    return issue?.retryAfterSeconds ? secondsUntil(issueBlockedUntil(), now()) : 0;
  };
  const emailDeliveryUncertain = () => {
    const issue = displayedIssue();
    return Boolean(issue && UNCERTAIN_EMAIL_DELIVERY_ISSUES.has(issue.code));
  };
  const emailSubmitLabel = () => {
    const retryIn = emailRetryIn();
    if (emailDeliveryUncertain()) {
      return retryIn > 0
        ? t("account.login.checkAgainIn", { time: formatTimer(retryIn) })
        : t("account.login.checkDelivery");
    }
    return retryIn > 0 ? t("account.login.tryAgainIn", { time: formatTimer(retryIn) }) : t("account.login.sendCode");
  };
  const emailBusy = () =>
    pendingAction() === "send" || pendingAction() === "check" || props.state.status === "signing_in";
  const codeBusy = () => pendingAction() === "verify";
  const resendBusy = () => pendingAction() === "resend";
  const formIssue = createMemo(() => {
    const issue = displayedIssue();
    return issue && !FIELD_ISSUES.has(issue.code) ? issue : undefined;
  });
  const displayedCodeError = () => {
    const visibleIssue = displayedIssue();
    const issue = currentIssue();
    if (codeError()) return codeError();
    if (visibleIssue?.code === "invalid_sign_in_code") return sourceText(visibleIssue.message);
    return issue && NEW_CODE_ISSUES.has(issue.code) ? sourceText(issue.message) : null;
  };
  const codeSentParts = () => {
    const [before = "", after = ""] = t(whatsapp() ? "account.login.whatsappHint" : "account.login.codeSent", {
      email: EMAIL_MARKER,
    }).split(EMAIL_MARKER);
    return [before, after] as const;
  };
  const emailFormShown = () => !connecting() && !unavailable() && loginStep() === "email";
  const languageButtonShown = () =>
    (props.state.status === "signed_out" || props.state.status === "error") && pendingAction() === null;
  const otpStatus = (): OtpInputStatus => {
    if (verified()) return "success";
    if (codeBusy()) return "verifying";
    if (displayedCodeError()) return "error";
    return "idle";
  };

  createEffect(
    () => loginStep(),
    (step, previousStep) => {
      if (!previousStep || step === previousStep) return;
      setLoginTransition(step === "email" ? "back" : "forward");
    },
  );

  createEffect(
    () => currentIssue(),
    (issue) => {
      setNow(Date.now());
      setIssueVisible(true);
      setIssueBlockedUntil(issue?.retryAfterSeconds ? Date.now() + issue.retryAfterSeconds * 1_000 : 0);
      if (issue?.code === "invalid_email") showEmailError(sourceText(issue.message));
    },
  );

  createEffect(
    () => (props.state.status === "code_sent" ? props.state.challengeId : null),
    (challengeId, previousChallengeId) => {
      if (!challengeId) return;
      setNow(Date.now());
      if (!previousChallengeId || challengeId === previousChallengeId) return;
      setCode("");
      setCodeError(null);
    },
  );

  createEffect(
    () => props.state.status,
    (status, previousStatus) => {
      if (status === previousStatus) return;
      if (status === "signed_out" || (status === "error" && !unavailable())) {
        queueMicrotask(() => emailInput?.focus());
      }
    },
  );

  function validateEmail(value: string): string | null {
    if (!value.trim()) return t("account.login.emailRequired");
    return phoneIdentity(value) ? null : t("account.login.emailInvalid");
  }

  function clearEmailErrorTimers(): void {
    if (emailShakeTimer !== undefined) window.clearTimeout(emailShakeTimer);
    if (emailRevertTimer !== undefined) window.clearTimeout(emailRevertTimer);
    if (emailMessageTimer !== undefined) window.clearTimeout(emailMessageTimer);
    emailShakeTimer = undefined;
    emailRevertTimer = undefined;
    emailMessageTimer = undefined;
  }

  function motionDuration(name: string, fallback: number): number {
    const value = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function hideEmailError(): void {
    clearEmailErrorTimers();
    setEmailErrorActive(false);
    setEmailShaking(false);
    emailMessageTimer = window.setTimeout(
      () => {
        emailMessageTimer = undefined;
        setPresentedEmailError(null);
      },
      motionDuration("--revert-dur", 280),
    );
  }

  function showEmailError(message: string): void {
    clearEmailErrorTimers();
    setPresentedEmailError(message);
    setEmailErrorActive(true);

    setEmailShaking(false);
    if (emailInput) void emailInput.offsetWidth;
    setEmailShaking(true);

    const shakeDuration = motionDuration("--shake-dur-a", 80) * 2 + motionDuration("--shake-dur-b", 60) * 2;
    emailShakeTimer = window.setTimeout(() => {
      emailShakeTimer = undefined;
      setEmailShaking(false);
    }, shakeDuration + 20);

    emailRevertTimer = window.setTimeout(() => {
      emailRevertTimer = undefined;
      setEmailErrorActive(false);
      emailMessageTimer = window.setTimeout(
        () => {
          emailMessageTimer = undefined;
          setPresentedEmailError(null);
        },
        motionDuration("--revert-dur", 280),
      );
    }, shakeDuration + motionDuration("--revert-hold", 3_000));
  }

  function showActionError(error: unknown, message: string, keepIssue: boolean): void {
    if (keepIssue && displayedIssue()) return;
    setLocalError({ message, reference: errorReference(error) });
  }

  function handleEmailInput(value: string): void {
    setEmail(value);
    setIssueVisible(false);
    setLocalError(null);
    hideEmailError();
  }

  function handleCodeInput(value: string): void {
    setCode(value);
    setIssueVisible(false);
    setLocalError(null);
    setCodeError(null);
  }

  async function submitEmail(): Promise<void> {
    if (pendingAction() || emailBusy() || emailRetryIn() > 0) return;
    const validationError = validateEmail(email());
    if (validationError) {
      showEmailError(validationError);
      emailInput?.focus();
      return;
    }
    const normalizedEmail = phoneIdentity(email());
    if (!normalizedEmail) return;
    const action: PendingAction = emailDeliveryUncertain() ? "check" : "send";
    setEmail(formatAccountIdentity(normalizedEmail));
    setIssueVisible(false);
    setLocalError(null);
    setPendingAction(action);
    try {
      await props.onRequestEmailCode(normalizedEmail);
    } catch (error) {
      showActionError(error, t("account.login.sendFailed"), true);
    } finally {
      setPendingAction(null);
    }
  }

  async function submitCode(value = code()): Promise<void> {
    if (props.state.status !== "code_sent" || pendingAction() || codeBusy() || codeNeedsReplacement()) return;
    const normalizedCode = normalizeOneTimeCode(value);
    if (!normalizedCode) {
      setCodeError(t("account.login.codeIncomplete"));
      return;
    }
    setCodeError(null);
    setIssueVisible(false);
    setLocalError(null);
    setPendingAction("verify");
    try {
      await props.onVerifyEmailCode(props.state.challengeId, formatCode(normalizedCode));
    } catch (error) {
      showActionError(error, t("account.login.verifyFailed"), true);
    } finally {
      setPendingAction(null);
    }
  }

  // A reverse sign-in finishes by itself: the screen asks again until the WhatsApp message arrived.
  createEffect(
    () => {
      const reverse = whatsapp();
      const current = challenge();
      return reverse && current && !codeNeedsReplacement() ? `${current.challengeId} ${reverse.code}` : null;
    },
    (target) => {
      if (!target) return;
      const [challengeId = "", reverseCode = ""] = target.split(" ");
      let asking = false;
      const timer = window.setInterval(() => {
        if (asking || pendingAction()) return;
        asking = true;
        void props
          .onVerifyEmailCode(challengeId, reverseCode)
          .catch(() => undefined)
          .finally(() => {
            asking = false;
          });
      }, WHATSAPP_CHECK_INTERVAL_MS);
      return () => window.clearInterval(timer);
    },
  );

  async function resendCode(): Promise<void> {
    if (props.state.status !== "code_sent" || pendingAction() || resendBusy() || resendAvailableIn() > 0) return;
    setIssueVisible(false);
    setLocalError(null);
    setPendingAction("resend");
    try {
      await props.onRequestEmailCode(props.state.email);
    } catch (error) {
      showActionError(error, t("account.login.resendFailed"), true);
    } finally {
      setPendingAction(null);
    }
  }

  async function retryConnection(): Promise<void> {
    if (pendingAction()) return;
    setPendingAction("retry");
    setLocalError(null);
    try {
      await props.onRetry();
    } catch (error) {
      showActionError(error, t("account.login.stillUnreachable"), false);
    } finally {
      setPendingAction(null);
    }
  }

  async function resetEmail(): Promise<void> {
    if (pendingAction()) return;
    setPendingAction("reset");
    setLocalError(null);
    try {
      await props.onReset();
      setCode("");
      setCodeError(null);
      setIssueVisible(false);
    } catch (error) {
      showActionError(error, t("account.login.resetFailed"), false);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main class="account-login-screen">
      <div class="account-login-shell">
        <header class="account-login-brand-lockup">
          <AppLogo variant={props.variant} animation="blink" interactive class="account-login-logo" />
          <span class="account-login-wordmark">{PRODUCT_NAME}</span>
        </header>

        <section
          class="account-login"
          data-step={loginStep()}
          data-transition={loginTransition()}
          aria-labelledby="account-login-title"
          aria-describedby="account-login-description"
        >
          <h1 id="account-login-title" class="account-login-title">
            {connecting()
              ? t("account.login.connectingTitle")
              : unavailable()
                ? t("account.login.unavailableTitle")
                : verified()
                  ? t("account.login.signedInTitle")
                  : codeSent()
                    ? t("account.login.checkInboxTitle")
                    : t("account.login.signInTitle")}
          </h1>
          <p id="account-login-description" class="account-login-description">
            <Show
              when={challenge() || verified()}
              fallback={
                connecting()
                  ? t("account.login.connectingDescription")
                  : unavailable()
                    ? sourceText(currentIssue()?.message ?? t("account.login.unavailableDescription"))
                    : keyringChanged()
                      ? t("account.login.keyringChangedDescription")
                      : t("account.login.signInDescription")
              }
            >
              {verified() ? (
                t("account.login.codeAccepted")
              ) : (
                <>
                  {codeSentParts()[0]}
                  <strong>{formatAccountIdentity(challenge()?.email ?? "")}</strong>
                  {codeSentParts()[1]}
                </>
              )}
            </Show>
          </p>

          <Show when={connecting()}>
            <div class="account-login-loader" role="status" aria-live="polite">
              <span class="account-login-spinner" aria-hidden="true" />
              <span>{t("account.login.connectingSecurely")}</span>
            </div>
          </Show>

          <Show when={unavailableIssue()}>
            {(issue) => (
              <>
                <ErrorReference reference={issue().reference} />
                <Show when={localError()}>
                  {(failure) => (
                    <p class="account-login-error" role="alert">
                      {failure().message}
                      <ErrorReference reference={failure().reference} />
                    </p>
                  )}
                </Show>
                <Button
                  variant="default"
                  type="button"
                  class="account-login-primary"
                  disabled={pendingAction() === "retry"}
                  onClick={() => void retryConnection()}
                >
                  <Show when={pendingAction() === "retry"} fallback={t("common.tryAgain")}>
                    <span class="account-login-button-spinner" aria-hidden="true" />
                    {t("common.connecting")}
                  </Show>
                </Button>
              </>
            )}
          </Show>

          <Show when={!connecting() && !unavailable()}>
            <Show
              when={challenge() || verified()}
              fallback={
                <form
                  class="account-login-form"
                  data-auth-panel="email"
                  aria-busy={emailBusy() ? "true" : "false"}
                  novalidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitEmail();
                  }}
                >
                  <label class="sr-only" for="account-email">
                    {t("account.login.email")}
                  </label>
                  <div class={`account-login-email-field t-input-wrap${emailErrorActive() ? " is-error" : ""}`}>
                    <Input
                      ref={(element) => (emailInput = element)}
                      class={`t-input${emailErrorActive() ? " is-error" : ""}${emailShaking() ? " is-shaking" : ""}`}
                      id="account-email"
                      type="tel"
                      autocomplete="tel"
                      autocapitalize="none"
                      inputmode="tel"
                      spellcheck={false}
                      placeholder={EMAIL_PLACEHOLDER}
                      maxlength={INPUT_LIMITS.email}
                      value={email()}
                      aria-invalid={emailErrorActive() ? "true" : undefined}
                      aria-describedby={emailErrorActive() ? "account-email-error" : undefined}
                      autofocus
                      onBlur={() => {
                        const value = untrack(email);
                        const validationError = value.trim() ? validateEmail(value) : null;
                        if (validationError) showEmailError(validationError);
                        else hideEmailError();
                      }}
                      onValueChange={handleEmailInput}
                    />
                    <p
                      id="account-email-error"
                      class="account-login-field-error t-error-msg"
                      role="alert"
                      aria-hidden={emailErrorActive() ? undefined : "true"}
                    >
                      {presentedEmailError()}
                    </p>
                  </div>
                  <Show when={formIssue()}>
                    {(issue) => (
                      <p class="account-login-error" role="alert">
                        {sourceText(issue().message)}
                        <ErrorReference reference={issue().reference} />
                      </p>
                    )}
                  </Show>
                  <Show when={localError()}>
                    {(failure) => (
                      <p class="account-login-error" role="alert">
                        {failure().message}
                        <ErrorReference reference={failure().reference} />
                      </p>
                    )}
                  </Show>

                  <Button
                    variant="default"
                    type="submit"
                    class="account-login-primary"
                    disabled={emailBusy() || !email().trim() || emailRetryIn() > 0}
                  >
                    <Show when={emailBusy()} fallback={emailSubmitLabel()}>
                      <span class="account-login-button-spinner" aria-hidden="true" />
                      {pendingAction() === "check"
                        ? t("account.login.checkingDelivery")
                        : t("account.login.sendingCode")}
                    </Show>
                  </Button>
                  {props.consent}
                </form>
              }
            >
              <div
                class="account-login-form"
                data-auth-panel="code"
                aria-busy={codeBusy() || resendBusy() ? "true" : "false"}
              >
                <Show
                  when={whatsapp()}
                  fallback={
                    <OtpInput
                      value={code()}
                      status={otpStatus()}
                      hint={t("account.login.codeHint")}
                      errorMessage={displayedCodeError()}
                      successMessage={t("account.login.verified")}
                      disabled={codeNeedsReplacement() || resendBusy()}
                      autofocus
                      onChange={handleCodeInput}
                      onComplete={(value) => void submitCode(value)}
                    />
                  }
                >
                  {(reverse) => (
                    <div class="account-login-whatsapp">
                      <QrCode value={reverse().url} size={176} label={t("account.login.whatsappOpen")} />
                      <Show when={props.onOpenWhatsApp}>
                        {(open) => (
                          <Button
                            variant="ghost"
                            type="button"
                            disabled={codeNeedsReplacement()}
                            onClick={() => open()(reverse().url)}
                          >
                            {t("account.login.whatsappOpen")}
                          </Button>
                        )}
                      </Show>
                      <Show when={!codeNeedsReplacement()}>
                        <p class="account-login-whatsapp-waiting" role="status">
                          <span class="account-login-button-spinner" aria-hidden="true" />
                          {t("account.login.whatsappWaiting")}
                        </p>
                      </Show>
                    </div>
                  )}
                </Show>

                <Show when={challenge()?.developmentCode}>
                  {(developmentCode) => (
                    <p class="account-login-development-code">
                      {t("account.login.developmentCode", { code: developmentCode() })}
                    </p>
                  )}
                </Show>
                <Show when={formIssue()}>
                  {(issue) => (
                    <p class="account-login-error" role="alert">
                      {sourceText(issue().message)}
                      <ErrorReference reference={issue().reference} />
                    </p>
                  )}
                </Show>
                <Show when={localError()}>
                  {(failure) => (
                    <p class="account-login-error" role="alert">
                      {failure().message}
                      <ErrorReference reference={failure().reference} />
                    </p>
                  )}
                </Show>

                <Show when={!verified()}>
                  <Show when={codeNeedsReplacement()}>
                    <Button
                      variant="default"
                      type="button"
                      class="account-login-primary"
                      disabled={pendingAction() !== null || resendAvailableIn() > 0}
                      onClick={() => void resendCode()}
                    >
                      <Show
                        when={resendBusy()}
                        fallback={
                          resendAvailableIn() > 0
                            ? t("account.login.sendNewCodeIn", { time: formatTimer(resendAvailableIn()) })
                            : t("account.login.sendNewCode")
                        }
                      >
                        <span class="account-login-button-spinner" aria-hidden="true" />
                        {t("account.login.sendingNewCode")}
                      </Show>
                    </Button>
                  </Show>

                  <div class="account-login-code-actions">
                    <Button
                      type="button"
                      class="account-login-code-action account-login-code-action-change"
                      variant="ghost"
                      size="sm"
                      disabled={pendingAction() !== null}
                      data-cuelume-tap="navigate"
                      onClick={() => void resetEmail()}
                    >
                      <ArrowLeft size={14} aria-hidden="true" />
                      {t("account.login.changeEmail")}
                    </Button>
                    <Show when={!codeNeedsReplacement()}>
                      <Button
                        type="button"
                        class="account-login-code-action account-login-code-action-resend"
                        variant="ghost"
                        size="sm"
                        disabled={pendingAction() !== null || resendAvailableIn() > 0}
                        loading={resendBusy()}
                        loadingLabel={t("common.sending")}
                        onClick={() => void resendCode()}
                      >
                        <RefreshCw size={14} aria-hidden="true" />
                        {resendAvailableIn() > 0
                          ? t("account.login.resendIn", { time: formatTimer(resendAvailableIn()) })
                          : t("account.login.resend")}
                      </Button>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </Show>
        </section>
      </div>

      <Show when={languageButtonShown() && props.onChangeLanguage && props.language}>
        {(language) => (
          <Button
            type="button"
            class="account-login-language"
            variant="ghost"
            size="sm"
            lang={appLanguageOption(language()).lang}
            title={t("account.language.change")}
            data-cuelume-tap="navigate"
            onClick={() => props.onChangeLanguage?.()}
          >
            <Globe2 size={14} aria-hidden="true" />
            {appLanguageOption(language()).label}
          </Button>
        )}
      </Show>
      <footer class="account-login-page-footer" data-shown={emailFormShown() ? "true" : undefined}>
        <div class="account-login-page-footer-start" />
        <div class="account-login-legal">
          <p class="account-login-local-data">
            <Lock size={13} aria-hidden="true" />
            {t("account.login.localData")}
          </p>
          {props.notice}
        </div>
      </footer>
    </main>
  );
}

function formatCode(value: string): string {
  const compact = normalizeOneTimeCode(value) ?? value.replaceAll("-", "");
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

function secondsUntil(timestamp: number, now: number): number {
  return Math.max(0, Math.ceil((timestamp - now) / 1_000));
}

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

/** The phone identity for a typed WhatsApp number, or null when it is not a phone number. */
function phoneIdentity(value: string): string | null {
  const identity = normalizeAccountIdentity(value);
  return identity && phoneFromIdentityEmail(identity) ? identity : null;
}
