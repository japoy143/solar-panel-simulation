"use server";

import { updateTag } from "next/cache";
import type { Logger } from "pino";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PRODUCTS_TAG } from "@/lib/data/products";
import { runAction, unexpected } from "@/lib/server/action";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const imagePath = z.string().regex(/^products\/[a-z0-9-]+\.(jpe?g|png|webp)$/i, "Invalid image path");
const positive = (label: string) =>
  z.number({ error: `Enter the ${label}.` }).positive(`${label[0].toUpperCase()}${label.slice(1)} must be above 0.`);

const productSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes."),
    category: z.enum(["panel", "inverter", "battery"]),
    summary: z.string().trim().max(500, "Keep the summary under 500 characters."),
    specs: z
      .array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(60) }))
      .max(6, "Up to 6 specs."),
    priceCents: z.number().int().min(0).nullable(),
    featured: z.boolean(),
    active: z.boolean(),
    sortOrder: z.number().int(),
    placement: z.enum(["roof", "wall"]),
    size: z.object({ w: positive("width"), h: positive("height"), d: positive("depth") }),
    watts: z.number().positive().nullable(),
    kw: z.number().positive().nullable(),
    kwh: z.number().positive().nullable(),
    hybrid: z.boolean(),
    images: z.array(imagePath).max(8, "Up to 8 photos."),
  })
  .superRefine((p, ctx) => {
    // The simulator needs the rating that matches the category.
    const need = { panel: "watts", inverter: "kw", battery: "kwh" } as const;
    const key = need[p.category];
    if (p[key] == null) ctx.addIssue({ code: "custom", path: [key], message: "Required for this category." });
    if (p.category === "panel" && p.placement !== "roof")
      ctx.addIssue({ code: "custom", path: ["placement"], message: "Panels mount on roofs." });
  });

export type ProductInput = z.input<typeof productSchema>;

export type SaveProductState =
  | { status: "idle" }
  | { status: "success"; id: string; message: string; at: number }
  | { status: "error"; message: string; fieldErrors: Record<string, string>; at: number };

function toRow(p: z.output<typeof productSchema>) {
  return {
    name: p.name,
    slug: p.slug,
    category: p.category,
    summary: p.summary,
    specs: p.specs,
    price_cents: p.priceCents,
    featured: p.featured,
    active: p.active,
    sort_order: p.sortOrder,
    placement: p.placement,
    size_w: p.size.w,
    size_h: p.size.h,
    size_d: p.size.d,
    // Only keep the rating that applies to the category.
    watts: p.category === "panel" ? p.watts : null,
    // Inverters: rated output. Batteries: max continuous output (optional).
    kw: p.category === "panel" ? null : p.kw,
    kwh: p.category === "battery" ? p.kwh : null,
    hybrid: p.category === "inverter" && p.hybrid,
    images: p.images,
  };
}

const UUID = z.uuid();

/** Best effort: a leftover file in Storage must never fail the user's action. */
async function removeImages(paths: string[], log: Logger) {
  if (paths.length === 0) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
    if (error) log.warn({ paths, msg: error.message }, "couldn't remove product images");
    else log.debug({ count: paths.length }, "removed product images");
  } catch (err) {
    log.warn({ err, paths }, "couldn't remove product images");
  }
}

/** Create (no id) or update a product. */
export async function saveProduct(
  _prev: SaveProductState,
  input: { id?: string; product: ProductInput },
): Promise<SaveProductState> {
  const at = Date.now();
  return runAction(
    input.id ? "updateProduct" : "createProduct",
    async ({ log, ref }) => {
      await requireAdmin();
      if (input.id && !UUID.safeParse(input.id).success) {
        log.warn({ id: input.id }, "rejected: invalid product id");
        return { status: "error", message: "That product doesn't exist.", fieldErrors: {}, at };
      }

      const parsed = productSchema.safeParse(input.product);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
        log.info({ productId: input.id, invalidFields: Object.keys(fieldErrors) }, "rejected: validation");
        return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, at };
      }

      const supabase = await createClient();
      const row = toRow(parsed.data);

      let previousImages: string[] = [];
      if (input.id) {
        const { data, error } = await supabase.from("products").select("images").eq("id", input.id).maybeSingle();
        if (error) log.warn({ productId: input.id, msg: error.message }, "couldn't read previous images");
        if (!error && !data) {
          log.warn({ productId: input.id }, "rejected: product no longer exists");
          return { status: "error", message: "That product no longer exists.", fieldErrors: {}, at };
        }
        previousImages = (data?.images as string[] | null) ?? [];
      }

      const { data, error } = input.id
        ? await supabase.from("products").update(row).eq("id", input.id).select("id").single()
        : await supabase.from("products").insert(row).select("id").single();

      if (error) {
        if (error.code === "23505") {
          log.info({ slug: row.slug }, "rejected: duplicate slug");
          return {
            status: "error",
            message: "That slug is already used.",
            fieldErrors: { slug: "Already used by another product." },
            at,
          };
        }
        log.error({ productId: input.id, slug: row.slug, code: error.code, msg: error.message }, "product save failed");
        return { status: "error", message: `Couldn't save the product. (Reference: ${ref})`, fieldErrors: {}, at };
      }

      await removeImages(previousImages.filter((p) => !row.images.includes(p)), log);
      updateTag(PRODUCTS_TAG);
      log.info({ productId: data.id, slug: row.slug, images: row.images.length }, input.id ? "product updated" : "product created");
      return {
        status: "success",
        id: data.id as string,
        message: input.id ? `${row.name} updated.` : `${row.name} created.`,
        at,
      };
    },
    (ref) => ({ status: "error", message: unexpected(ref), fieldErrors: {}, at }),
  );
}

export type ActionResult = { ok: true } | { ok: false; error: string };

const failure = (ref: string): ActionResult => ({ ok: false, error: unexpected(ref) });

export async function deleteProduct(id: string): Promise<ActionResult> {
  return runAction(
    "deleteProduct",
    async ({ log, ref }) => {
      await requireAdmin();
      if (!UUID.safeParse(id).success) return { ok: false, error: "That product doesn't exist." };
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)
        .select("slug, images")
        .maybeSingle();
      if (error) {
        log.error({ productId: id, code: error.code, msg: error.message }, "product delete failed");
        return { ok: false, error: `Couldn't delete the product. (Reference: ${ref})` };
      }
      if (!data) {
        log.warn({ productId: id }, "delete: product no longer exists");
        return { ok: false, error: "That product no longer exists." };
      }
      await removeImages((data.images as string[] | null) ?? [], log);
      updateTag(PRODUCTS_TAG);
      log.info({ productId: id, slug: data.slug }, "product deleted");
      return { ok: true };
    },
    failure,
  );
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  return runAction(
    "setProductActive",
    async ({ log, ref }) => {
      await requireAdmin();
      if (!UUID.safeParse(id).success) return { ok: false, error: "That product doesn't exist." };
      const supabase = await createClient();
      const { data, error } = await supabase.from("products").update({ active }).eq("id", id).select("id");
      if (error) {
        log.error({ productId: id, active, code: error.code, msg: error.message }, "product visibility update failed");
        return { ok: false, error: `Couldn't update the product. (Reference: ${ref})` };
      }
      if (!data?.length) return { ok: false, error: "That product no longer exists." };
      updateTag(PRODUCTS_TAG);
      log.info({ productId: id, active }, "product visibility changed");
      return { ok: true };
    },
    failure,
  );
}

/** Re-reads the catalog for the public site, e.g. after editing products directly in Supabase. */
export async function refreshCatalog(): Promise<ActionResult> {
  return runAction(
    "refreshCatalog",
    async ({ log }) => {
      await requireAdmin();
      updateTag(PRODUCTS_TAG);
      log.info("catalog cache refreshed");
      return { ok: true };
    },
    failure,
  );
}

/** Deletes photos uploaded in a form that was then abandoned, so Storage doesn't fill with orphans. */
export async function discardUploads(paths: string[]): Promise<void> {
  await runAction(
    "discardUploads",
    async ({ log }) => {
      await requireAdmin();
      const valid = paths.filter((p) => imagePath.safeParse(p).success);
      if (valid.length !== paths.length) log.warn({ rejected: paths.length - valid.length }, "ignored invalid image paths");
      if (valid.length === 0) return;
      // Never delete a photo that a saved product still references.
      const supabase = await createClient();
      const { data, error } = await supabase.from("products").select("images").overlaps("images", valid);
      if (error) {
        // Unsure what's referenced, so keep everything rather than risk deleting a live photo.
        log.warn({ msg: error.message }, "couldn't check image usage; kept uploads");
        return;
      }
      const inUse = new Set((data ?? []).flatMap((r) => (r.images as string[]) ?? []));
      await removeImages(valid.filter((p) => !inUse.has(p)), log);
    },
    () => undefined,
  );
}
