"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PRODUCTS_TAG } from "@/lib/data/products";
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
    kw: p.category === "inverter" ? p.kw : null,
    kwh: p.category === "battery" ? p.kwh : null,
    hybrid: p.category === "inverter" && p.hybrid,
    images: p.images,
  };
}

async function removeImages(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
  if (error) console.error("[products] couldn't remove images:", error.message);
}

/** Create (no id) or update a product. */
export async function saveProduct(
  _prev: SaveProductState,
  input: { id?: string; product: ProductInput },
): Promise<SaveProductState> {
  await requireAdmin();
  const at = Date.now();

  const parsed = productSchema.safeParse(input.product);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, at };
  }

  const supabase = await createClient();
  const row = toRow(parsed.data);

  let previousImages: string[] = [];
  if (input.id) {
    const { data } = await supabase.from("products").select("images").eq("id", input.id).maybeSingle();
    previousImages = (data?.images as string[] | null) ?? [];
  }

  const { data, error } = input.id
    ? await supabase.from("products").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("products").insert(row).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "That slug is already used.", fieldErrors: { slug: "Already used by another product." }, at };
    }
    console.error("[products] save failed:", error.message);
    return { status: "error", message: "Couldn't save the product. Please try again.", fieldErrors: {}, at };
  }

  await removeImages(previousImages.filter((p) => !row.images.includes(p)));
  updateTag(PRODUCTS_TAG);
  return {
    status: "success",
    id: data.id as string,
    message: input.id ? `${row.name} updated.` : `${row.name} created.`,
    at,
  };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").delete().eq("id", id).select("images").maybeSingle();
  if (error) return { ok: false, error: "Couldn't delete the product." };
  if (!data) return { ok: false, error: "That product no longer exists." };
  await removeImages((data.images as string[] | null) ?? []);
  updateTag(PRODUCTS_TAG);
  return { ok: true };
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ active }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update the product." };
  updateTag(PRODUCTS_TAG);
  return { ok: true };
}

/** Deletes photos uploaded in a form that was then abandoned, so Storage doesn't fill with orphans. */
export async function discardUploads(paths: string[]): Promise<void> {
  await requireAdmin();
  const valid = paths.filter((p) => imagePath.safeParse(p).success);
  if (valid.length === 0) return;
  // Never delete a photo that a saved product still references.
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("images").overlaps("images", valid);
  const inUse = new Set((data ?? []).flatMap((r) => (r.images as string[]) ?? []));
  await removeImages(valid.filter((p) => !inUse.has(p)));
}
