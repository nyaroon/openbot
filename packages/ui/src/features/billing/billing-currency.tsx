import type { BillingCurrency } from "@openbot/contracts/billing";
import { RadioGroup } from "@openbot/ui";
import { Show } from "solid-js";
import { useText } from "../../text";

export type BillingPeriod = "monthly" | "yearly";

export const BILLING_CURRENCY_CODES = ["EUR", "USD", "PLN", "BRL"] as const;
export type BillingCurrencyCode = (typeof BILLING_CURRENCY_CODES)[number];
type BaseCurrencyCode = Exclude<BillingCurrencyCode, "BRL">;
const BASE_CURRENCY_CODES: readonly BaseCurrencyCode[] = ["EUR", "USD", "PLN"];

export const BILLING_CURRENCY_BY_CODE = {
  EUR: "eur",
  USD: "usd",
  PLN: "pln",
  BRL: "brl",
} as const satisfies Record<BillingCurrencyCode, BillingCurrency>;

const BRAZIL_TIME_ZONES = new Set([
  "America/Araguaina",
  "America/Bahia",
  "America/Belem",
  "America/Boa_Vista",
  "America/Campo_Grande",
  "America/Cuiaba",
  "America/Eirunepe",
  "America/Fortaleza",
  "America/Maceio",
  "America/Manaus",
  "America/Noronha",
  "America/Porto_Velho",
  "America/Recife",
  "America/Rio_Branco",
  "America/Santarem",
  "America/Sao_Paulo",
  "Brazil/Acre",
  "Brazil/DeNoronha",
  "Brazil/East",
  "Brazil/West",
]);

export function guessBillingCurrencyCode(
  offered: readonly BillingCurrencyCode[] = BASE_CURRENCY_CODES,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): BillingCurrencyCode {
  if (timeZone === "Europe/Warsaw") return "PLN";
  if (timeZone.startsWith("Europe/")) return "EUR";
  if (BRAZIL_TIME_ZONES.has(timeZone) && offered.includes("BRL")) return "BRL";
  return "USD";
}

const BILLING_OPTIONS: readonly BillingPeriod[] = ["monthly", "yearly"];

interface BillingPeriodSwitchProps {
  billing: BillingPeriod;
  discountPercent: number;
  onChange: (billing: BillingPeriod) => void;
  disabled?: boolean | undefined;
}

export function BillingPeriodSwitch(props: BillingPeriodSwitchProps) {
  const { t } = useText();
  return (
    <RadioGroup.Root
      class="hosted-billing"
      data-billing={props.billing}
      aria-label={t("server.add.billing.label")}
      value={props.billing}
      disabled={props.disabled ?? false}
      onChange={(value) => {
        const billing = BILLING_OPTIONS.find((option) => option === value);
        if (billing) props.onChange(billing);
      }}
    >
      <RadioGroup.Item class="hosted-billing-option" value="monthly">
        <RadioGroup.ItemInput />
        <RadioGroup.ItemControl class="hosted-billing-control">
          <RadioGroup.ItemLabel>{t("server.add.billing.monthly")}</RadioGroup.ItemLabel>
        </RadioGroup.ItemControl>
      </RadioGroup.Item>
      <RadioGroup.Item class="hosted-billing-option" value="yearly">
        <RadioGroup.ItemInput />
        <RadioGroup.ItemControl class="hosted-billing-control">
          <RadioGroup.ItemLabel>{t("server.add.billing.yearly")}</RadioGroup.ItemLabel>
          <Show when={props.discountPercent > 0}>
            <span class="hosted-billing-save">{t("server.add.billing.save", { percent: props.discountPercent })}</span>
          </Show>
        </RadioGroup.ItemControl>
      </RadioGroup.Item>
    </RadioGroup.Root>
  );
}
