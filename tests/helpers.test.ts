import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { describeLayout } from "@/lib/data/bookings";
import { param, searchFilter } from "@/lib/data/search";
import { clientIdFromRecipients } from "@/lib/email";
import { parseFlash } from "@/lib/flash";
import { isClientStatus } from "@/lib/clients";
import { formatPrice, productImageUrl, productRating } from "@/lib/products";
import { maskEmail } from "@/lib/server/logger";
import { absoluteUrl, pageMetadata } from "@/lib/site";

describe("products helpers", () => {
  test("productRating picks the headline figure", () => {
    assert.equal(productRating({ watts: 410 }), "410 W");
    assert.equal(productRating({ kw: 5 }), "5 kW");
    assert.equal(productRating({ kwh: 10, kw: 5 }), "5 kW");
    assert.equal(productRating({ kwh: 10 }), "10 kWh");
    assert.equal(productRating({}), "—");
  });

  test("formatPrice", () => {
    assert.equal(formatPrice(null), "Quoted");
    assert.equal(formatPrice(0), "$0.00");
    assert.equal(formatPrice(123456), "$1,234.56");
  });

  test("productImageUrl encodes each path segment", () => {
    assert.match(productImageUrl("products/a b#.png"), /\/storage\/v1\/object\/public\/product-images\/products\/a%20b%23\.png$/);
  });
});

describe("searchFilter", () => {
  test("empty or punctuation-only queries search nothing", () => {
    assert.equal(searchFilter(undefined, ["name"]), null);
    assert.equal(searchFilter("   ", ["name"]), null);
    assert.equal(searchFilter("(),.", ["name"]), null);
  });

  test("builds an ilike OR filter across columns", () => {
    assert.equal(searchFilter(" Jane  Doe ", ["name", "email"]), "name.ilike.*Jane Doe*,email.ilike.*Jane Doe*");
  });

  test("PostgREST syntax characters become wildcards, so emails still match", () => {
    const f = searchFilter("jo.doe@mail.com", ["email"]);
    assert.equal(f, "email.ilike.*jo*doe@mail*com*");
    // Nothing that could close the filter or add another condition survives.
    const evil = searchFilter('a),id.eq.1,(name.ilike."x', ["name"])!;
    assert.doesNotMatch(evil.slice("name.ilike.".length), /[,()".:]/);
  });

  test("caps the term length", () => {
    const f = searchFilter("x".repeat(500), ["name"])!;
    assert.equal(f.length, "name.ilike.**".length + 100);
  });

  test("param takes the first value", () => {
    assert.equal(param(["a", "b"]), "a");
    assert.equal(param("a"), "a");
    assert.equal(param(undefined), undefined);
  });
});

describe("describeLayout", () => {
  test("summarises a usable layout", () => {
    assert.equal(
      describeLayout({ building: "medium-house", summary: { panels: 14, kwp: 5.74, batteryKwh: 10 } }),
      "Medium house · 14 panels · 5.7 kWp · 10 kWh battery",
    );
  });
  test("unknown building is omitted; no panels means no summary", () => {
    assert.equal(describeLayout({ building: "castle", summary: { panels: 2, kwp: 0.8 } }), "2 panels · 0.8 kWp");
    assert.equal(describeLayout({ summary: { panels: 0 } }), null);
    assert.equal(describeLayout(null), null);
  });
});

describe("email helpers", () => {
  test("clientIdFromRecipients finds a reply+<uuid> address", () => {
    const id = "3F2504E0-4F89-11D3-9A0C-0305E82C3301";
    assert.equal(clientIdFromRecipients(["x@y.com", `Reply <reply+${id}@in.example.com>`]), id.toLowerCase());
    assert.equal(clientIdFromRecipients(["reply+not-a-uuid@in.example.com"]), null);
    assert.equal(clientIdFromRecipients([]), null);
  });

  test("maskEmail", () => {
    assert.equal(maskEmail("jane@example.com"), "ja***@example.com");
    assert.equal(maskEmail("nope"), "***");
    assert.equal(maskEmail(null), undefined);
  });
});

describe("flash + client status", () => {
  test("parseFlash accepts valid flashes and truncates", () => {
    assert.deepEqual(parseFlash(JSON.stringify({ type: "info", message: "Hi" })), { type: "info", message: "Hi", description: undefined });
    assert.equal(parseFlash(JSON.stringify({ type: "info", message: "x".repeat(500) }))!.message.length, 200);
  });
  test("parseFlash rejects junk", () => {
    for (const raw of [undefined, "", "not json", "null", "42", '{"type":"evil","message":"x"}', '{"type":"info"}']) {
      assert.equal(parseFlash(raw), null, String(raw));
    }
  });
  test("isClientStatus", () => {
    assert.equal(isClientStatus("lead"), true);
    assert.equal(isClientStatus("LEAD"), false);
    assert.equal(isClientStatus(1), false);
  });
});

describe("site URL", () => {
  test("absoluteUrl and pageMetadata", () => {
    assert.equal(absoluteUrl("/booking"), new URL("/booking", absoluteUrl()).toString());
    const m = pageMetadata({ title: "T", description: "D", path: "/x" });
    assert.equal(m.title, "T");
    assert.equal(m.alternates?.canonical, "/x");
    const a = pageMetadata({ title: "T", description: "D", path: "/", absoluteTitle: true });
    assert.deepEqual(a.title, { absolute: "T" });
  });

  // siteUrl is computed once at import, so each environment runs in a fresh process.
  const register = fileURLToPath(new URL("./register.mjs", import.meta.url));
  const siteUrlWith = (env: Record<string, string>) => {
    const clean = { ...process.env };
    for (const k of ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]) delete clean[k];
    const r = spawnSync(
      process.execPath,
      ["--import", register, "--input-type=module", "-e", 'const m = await import("@/lib/site"); console.log(m.siteUrl);'],
      { env: { ...clean, ...env }, encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };

  test("resolution order and normalisation", () => {
    assert.equal(siteUrlWith({}), "http://localhost:3000");
    assert.equal(siteUrlWith({ VERCEL_URL: "app-git-x.vercel.app" }), "https://app-git-x.vercel.app");
    assert.equal(
      siteUrlWith({ VERCEL_URL: "preview.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "app.vercel.app" }),
      "https://app.vercel.app",
    );
    assert.equal(siteUrlWith({ NEXT_PUBLIC_SITE_URL: "https://example.com//", VERCEL_URL: "x.vercel.app" }), "https://example.com");
    assert.equal(siteUrlWith({ NEXT_PUBLIC_SITE_URL: "example.com" }), "https://example.com");
  });
});
