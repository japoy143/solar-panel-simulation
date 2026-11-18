// Residential electricity price presets per country, in each country's own currency.
//
// These are starting points for the savings estimate, not quotes: real bills depend on tiers,
// time-of-use rates, fixed/standing charges (excluded here) and the provider. The UI lets the
// customer replace the price and currency with the numbers on their own bill.
//
// Sources, newest first (see TARIFF_SOURCES):
// - "eurostat-2026h1": Eurostat nrg_pc_204, January–June 2026, households using 2,500–4,999 kWh
//   a year, all taxes and levies included. Euro countries in EUR; others in national currency.
// - "ofgem-2026q4":   Ofgem price cap, 1 Oct–31 Dec 2026, average electricity unit rate
//   (Direct Debit), excluding the daily standing charge.
// - "eia-2026":       U.S. EIA Electric Power Monthly, average residential price, June 2026.
// - "meralco-2026-11": Meralco overall residential rate, November 2026 billing (Metro Manila).
// - "gpp-2026q1" / "gpp-2025-06": GlobalPetrolPrices household electricity price, local currency,
//   March 2026 / June 2025, incl. taxes, benchmarked to the country's typical household usage.

export type TariffSource = "eurostat-2026h1" | "ofgem-2026q4" | "eia-2026" | "meralco-2026-11" | "gpp-2026q1" | "gpp-2025-06";

export type Tariff = {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** ISO 4217. */
  currency: string;
  /** Price per kWh in `currency`. */
  price: number;
  source: TariffSource;
};

export const TARIFF_SOURCES: Record<TariffSource, { label: string; period: string; url: string }> = {
  "eurostat-2026h1": {
    label: "Eurostat",
    period: "Jan–Jun 2026",
    url: "https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204/default/table",
  },
  "ofgem-2026q4": {
    label: "Ofgem price cap",
    period: "Oct–Dec 2026",
    url: "https://ofgem.gov.uk/news/changes-energy-price-cap-between-1-october-and-31-december-2026",
  },
  "eia-2026": {
    label: "U.S. EIA (via electricrates.org)",
    period: "Jun 2026",
    url: "https://electricrates.org/states/report/2026-06/",
  },
  "meralco-2026-11": {
    label: "Meralco",
    period: "Nov 2026",
    url: "https://tribune.net.ph/2026/11/13/heat-higher-demand-push-up-meralco-november-bill",
  },
  "gpp-2026q1": {
    label: "GlobalPetrolPrices",
    period: "Mar 2026",
    url: "https://www.globalpetrolprices.com/Maldives/electricity_prices/",
  },
  "gpp-2025-06": {
    label: "GlobalPetrolPrices",
    period: "Jun 2025",
    url: "https://www.globalpetrolprices.com/electricity_prices/",
  },
};

export const TARIFFS: Tariff[] = [
  // Europe — Eurostat, H1 2026
  { code: "AL", name: "Albania", currency: "ALL", price: 11.4, source: "eurostat-2026h1" },
  { code: "AT", name: "Austria", currency: "EUR", price: 0.326, source: "eurostat-2026h1" },
  { code: "BE", name: "Belgium", currency: "EUR", price: 0.3575, source: "eurostat-2026h1" },
  { code: "BA", name: "Bosnia and Herzegovina", currency: "BAM", price: 0.1946, source: "eurostat-2026h1" },
  { code: "BG", name: "Bulgaria", currency: "EUR", price: 0.1341, source: "eurostat-2026h1" },
  { code: "HR", name: "Croatia", currency: "EUR", price: 0.1816, source: "eurostat-2026h1" },
  { code: "CY", name: "Cyprus", currency: "EUR", price: 0.2688, source: "eurostat-2026h1" },
  { code: "CZ", name: "Czechia", currency: "CZK", price: 7.0108, source: "eurostat-2026h1" },
  { code: "DK", name: "Denmark", currency: "DKK", price: 1.7748, source: "eurostat-2026h1" },
  { code: "EE", name: "Estonia", currency: "EUR", price: 0.2118, source: "eurostat-2026h1" },
  { code: "FI", name: "Finland", currency: "EUR", price: 0.2694, source: "eurostat-2026h1" },
  { code: "FR", name: "France", currency: "EUR", price: 0.2485, source: "eurostat-2026h1" },
  { code: "GE", name: "Georgia", currency: "GEL", price: 0.2292, source: "eurostat-2026h1" },
  { code: "DE", name: "Germany", currency: "EUR", price: 0.3618, source: "eurostat-2026h1" },
  { code: "GR", name: "Greece", currency: "EUR", price: 0.2401, source: "eurostat-2026h1" },
  { code: "HU", name: "Hungary", currency: "HUF", price: 42.4067, source: "eurostat-2026h1" },
  { code: "IS", name: "Iceland", currency: "ISK", price: 29.98, source: "eurostat-2026h1" },
  { code: "IE", name: "Ireland", currency: "EUR", price: 0.3871, source: "eurostat-2026h1" },
  { code: "IT", name: "Italy", currency: "EUR", price: 0.3142, source: "eurostat-2026h1" },
  { code: "XK", name: "Kosovo", currency: "EUR", price: 0.0869, source: "eurostat-2026h1" },
  { code: "LV", name: "Latvia", currency: "EUR", price: 0.2415, source: "eurostat-2026h1" },
  { code: "LI", name: "Liechtenstein", currency: "CHF", price: 0.2742, source: "eurostat-2026h1" },
  { code: "LT", name: "Lithuania", currency: "EUR", price: 0.2162, source: "eurostat-2026h1" },
  { code: "LU", name: "Luxembourg", currency: "EUR", price: 0.2023, source: "eurostat-2026h1" },
  { code: "MT", name: "Malta", currency: "EUR", price: 0.1268, source: "eurostat-2026h1" },
  { code: "MD", name: "Moldova", currency: "MDL", price: 3.7645, source: "eurostat-2026h1" },
  { code: "ME", name: "Montenegro", currency: "EUR", price: 0.1039, source: "eurostat-2026h1" },
  { code: "NL", name: "Netherlands", currency: "EUR", price: 0.244, source: "eurostat-2026h1" },
  { code: "MK", name: "North Macedonia", currency: "MKD", price: 7.2057, source: "eurostat-2026h1" },
  { code: "NO", name: "Norway", currency: "NOK", price: 2.2262, source: "eurostat-2026h1" },
  { code: "PL", name: "Poland", currency: "PLN", price: 1.2724, source: "eurostat-2026h1" },
  { code: "PT", name: "Portugal", currency: "EUR", price: 0.2367, source: "eurostat-2026h1" },
  { code: "RO", name: "Romania", currency: "RON", price: 1.4584, source: "eurostat-2026h1" },
  { code: "RS", name: "Serbia", currency: "RSD", price: 14.0541, source: "eurostat-2026h1" },
  { code: "SK", name: "Slovakia", currency: "EUR", price: 0.1985, source: "eurostat-2026h1" },
  { code: "SI", name: "Slovenia", currency: "EUR", price: 0.2118, source: "eurostat-2026h1" },
  { code: "ES", name: "Spain", currency: "EUR", price: 0.2509, source: "eurostat-2026h1" },
  { code: "SE", name: "Sweden", currency: "SEK", price: 3.3038, source: "eurostat-2026h1" },
  { code: "TR", name: "Türkiye", currency: "TRY", price: 3.4237, source: "eurostat-2026h1" },

  // Official national figures
  { code: "GB", name: "United Kingdom", currency: "GBP", price: 0.2632, source: "ofgem-2026q4" },
  { code: "US", name: "United States", currency: "USD", price: 0.183, source: "eia-2026" },
  { code: "PH", name: "Philippines", currency: "PHP", price: 15.551, source: "meralco-2026-11" },

  // Rest of the world — GlobalPetrolPrices
  { code: "MV", name: "Maldives", currency: "MVR", price: 1.4, source: "gpp-2026q1" },
  { code: "AR", name: "Argentina", currency: "ARS", price: 120, source: "gpp-2025-06" },
  { code: "AU", name: "Australia", currency: "AUD", price: 0.33, source: "gpp-2025-06" },
  { code: "BH", name: "Bahrain", currency: "BHD", price: 0.016, source: "gpp-2025-06" },
  { code: "BD", name: "Bangladesh", currency: "BDT", price: 7.74, source: "gpp-2025-06" },
  { code: "BR", name: "Brazil", currency: "BRL", price: 0.88, source: "gpp-2025-06" },
  { code: "CA", name: "Canada", currency: "CAD", price: 0.13, source: "gpp-2025-06" },
  { code: "CL", name: "Chile", currency: "CLP", price: 257.29, source: "gpp-2025-06" },
  { code: "CN", name: "China", currency: "CNY", price: 0.53, source: "gpp-2025-06" },
  { code: "CO", name: "Colombia", currency: "COP", price: 860, source: "gpp-2025-06" },
  { code: "EG", name: "Egypt", currency: "EGP", price: 1.07, source: "gpp-2025-06" },
  { code: "HK", name: "Hong Kong", currency: "HKD", price: 1.44, source: "gpp-2025-06" },
  { code: "IN", name: "India", currency: "INR", price: 6.47, source: "gpp-2025-06" },
  { code: "ID", name: "Indonesia", currency: "IDR", price: 1444.7, source: "gpp-2025-06" },
  { code: "IL", name: "Israel", currency: "ILS", price: 0.55, source: "gpp-2025-06" },
  { code: "JP", name: "Japan", currency: "JPY", price: 35.85, source: "gpp-2025-06" },
  { code: "KE", name: "Kenya", currency: "KES", price: 20, source: "gpp-2025-06" },
  { code: "MY", name: "Malaysia", currency: "MYR", price: 0.38, source: "gpp-2025-06" },
  { code: "MX", name: "Mexico", currency: "MXN", price: 2.05, source: "gpp-2025-06" },
  { code: "NZ", name: "New Zealand", currency: "NZD", price: 0.31, source: "gpp-2025-06" },
  { code: "NG", name: "Nigeria", currency: "NGN", price: 100, source: "gpp-2025-06" },
  { code: "PK", name: "Pakistan", currency: "PKR", price: 24.88, source: "gpp-2025-06" },
  { code: "QA", name: "Qatar", currency: "QAR", price: 0.1, source: "gpp-2025-06" },
  { code: "RU", name: "Russia", currency: "RUB", price: 5.86, source: "gpp-2025-06" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", price: 0.2, source: "gpp-2025-06" },
  { code: "SG", name: "Singapore", currency: "SGD", price: 0.2812, source: "gpp-2025-06" },
  { code: "ZA", name: "South Africa", currency: "ZAR", price: 3.71, source: "gpp-2025-06" },
  { code: "KR", name: "South Korea", currency: "KRW", price: 171.6, source: "gpp-2025-06" },
  { code: "LK", name: "Sri Lanka", currency: "LKR", price: 23.38, source: "gpp-2025-06" },
  { code: "CH", name: "Switzerland", currency: "CHF", price: 0.29, source: "gpp-2025-06" },
  { code: "TW", name: "Taiwan", currency: "TWD", price: 3.78, source: "gpp-2025-06" },
  { code: "TH", name: "Thailand", currency: "THB", price: 4.15, source: "gpp-2025-06" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", price: 0.293, source: "gpp-2025-06" },
  { code: "VN", name: "Vietnam", currency: "VND", price: 2204.06, source: "gpp-2025-06" },
].sort((a, b) => a.name.localeCompare(b.name)) as Tariff[];

const byCode = new Map(TARIFFS.map((t) => [t.code, t]));

export function getTariff(code: string | null | undefined): Tariff | undefined {
  return code ? byCode.get(code.toUpperCase()) : undefined;
}

/** Used when the visitor's country can't be detected or has no preset. */
export const FALLBACK_COUNTRY = "US";

/** The visitor's country from the browser's language settings (e.g. "en-PH" → "PH"), if we have a preset. */
export function detectCountry(): string {
  if (typeof navigator === "undefined") return FALLBACK_COUNTRY;
  for (const lang of navigator.languages ?? [navigator.language]) {
    try {
      const region = new Intl.Locale(lang).maximize().region;
      if (region && byCode.has(region)) return region;
    } catch {
      // Malformed language tag: try the next one.
    }
  }
  return FALLBACK_COUNTRY;
}

/** Every ISO 4217 currency the browser knows, for the currency picker. */
export function currencyCodes(): string[] {
  try {
    return Intl.supportedValuesOf("currency");
  } catch {
    return [...new Set(TARIFFS.map((t) => t.currency))].sort();
  }
}
