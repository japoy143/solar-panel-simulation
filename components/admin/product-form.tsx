"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlusIcon, Loader2Icon, PlusIcon, StarIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  discardUploads,
  saveProduct,
  type ProductInput,
  type SaveProductState,
} from "@/app/admin/(dashboard)/products/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  categoryLabels,
  productCategories,
  productImageUrl,
  type Product,
  type ProductCategory,
} from "@/lib/products";
import { createClient } from "@/lib/supabase/browser";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Sensible simulator defaults per category (metres), used when creating a product. */
const defaults: Record<ProductCategory, { placement: "roof" | "wall"; w: string; h: string; d: string }> = {
  panel: { placement: "roof", w: "1.13", h: "1.72", d: "0.04" },
  inverter: { placement: "wall", w: "0.5", h: "0.6", d: "0.22" },
  battery: { placement: "wall", w: "0.6", h: "1.1", d: "0.25" },
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

type FormState = {
  name: string;
  slug: string;
  category: ProductCategory;
  summary: string;
  specs: { label: string; value: string }[];
  price: string;
  featured: boolean;
  active: boolean;
  sortOrder: string;
  placement: "roof" | "wall";
  w: string;
  h: string;
  d: string;
  rating: string;
  hybrid: boolean;
  /** Batteries only: max continuous output (kW). */
  outputKw: string;
  images: string[];
};

function initialState(p?: Product): FormState {
  if (!p) {
    return {
      name: "",
      slug: "",
      category: "panel",
      summary: "",
      specs: [{ label: "", value: "" }],
      price: "",
      featured: false,
      active: true,
      sortOrder: "0",
      ...defaults.panel,
      rating: "",
      hybrid: false,
      outputKw: "",
      images: [],
    };
  }
  return {
    name: p.name,
    slug: p.slug,
    category: p.category,
    summary: p.summary,
    specs: p.specs.length ? p.specs : [{ label: "", value: "" }],
    price: p.priceCents == null ? "" : (p.priceCents / 100).toFixed(2),
    featured: p.featured,
    active: p.active,
    sortOrder: String(p.sortOrder),
    placement: p.placement,
    w: String(p.size.w),
    h: String(p.size.h),
    d: String(p.size.d),
    rating: String((p.category === "panel" ? p.watts : p.category === "inverter" ? p.kw : p.kwh) ?? ""),
    hybrid: Boolean(p.hybrid),
    outputKw: p.category === "battery" && p.kw != null ? String(p.kw) : "",
    images: p.images,
  };
}

const ratingField = {
  panel: { key: "watts", label: "Power (W)", step: "1" },
  inverter: { key: "kw", label: "Output (kW)", step: "0.1" },
  battery: { key: "kwh", label: "Capacity (kWh)", step: "0.1" },
} as const;

const toNumber = (s: string) => (s.trim() === "" ? null : Number(s));

/** `nextSortOrder` places a new product after the existing ones. */
export function ProductForm({ product, nextSortOrder = 0 }: { product?: Product; nextSortOrder?: number }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    product ? initialState(product) : { ...initialState(), sortOrder: String(nextSortOrder) },
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [uploading, setUploading] = useState(0);
  const [state, action, pending] = useActionState<SaveProductState, { id?: string; product: ProductInput }>(
    saveProduct,
    { status: "idle" },
  );
  const fileInput = useRef<HTMLInputElement>(null);
  /** Photos uploaded in this session that aren't saved on the product yet. */
  const unsaved = useRef(new Set<string>());

  const errors = state.status === "error" ? state.fieldErrors : {};
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const rating = ratingField[form.category];

  // Toast once per submission; leave the page on success.
  const at = state.status === "idle" ? 0 : state.at;
  useEffect(() => {
    if (state.status === "success") {
      unsaved.current.clear();
      toast.success(state.message);
      router.push("/admin/products");
    } else if (state.status === "error") {
      toast.error("Couldn't save", { description: state.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per submission
  }, [at]);

  // Leaving without saving: delete photos uploaded during this visit.
  useEffect(() => {
    const pendingUploads = unsaved.current;
    return () => {
      if (pendingUploads.size > 0) discardUploads([...pendingUploads]).catch((err) => console.error("discardUploads failed", err));
    };
  }, []);

  function changeCategory(category: ProductCategory) {
    setForm((f) => ({
      ...f,
      category,
      // New products pick up the category's typical size and mounting.
      ...(product ? { placement: category === "panel" ? "roof" : f.placement } : defaults[category]),
    }));
  }

  async function addFiles(files: FileList | File[]) {
    const list = [...files];
    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) return toast.error(`Up to ${MAX_IMAGES} photos per product.`);
    const accepted = list.slice(0, room).filter((file) => {
      if (!TYPES[file.type]) {
        toast.error(`${file.name}: use JPEG, PNG or WebP.`);
        return false;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is over 5 MB.`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;

    const supabase = createClient();
    setUploading((n) => n + accepted.length);
    const id = toast.loading(`Uploading ${accepted.length} photo${accepted.length === 1 ? "" : "s"}…`);
    const results = await Promise.all(
      accepted.map(async (file) => {
        const path = `products/${crypto.randomUUID()}.${TYPES[file.type]}`;
        try {
          const { error } = await supabase.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
          if (error) {
            console.error(`Upload failed for ${file.name}:`, error.message);
            return null;
          }
          return path;
        } catch (err) {
          console.error(`Upload failed for ${file.name}:`, err); // e.g. network drop
          return null;
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    const ok = results.filter((p): p is string => p !== null);
    ok.forEach((p) => unsaved.current.add(p));
    setForm((f) => ({ ...f, images: [...f.images, ...ok] }));
    if (ok.length === accepted.length) toast.success(`Uploaded ${ok.length} photo${ok.length === 1 ? "" : "s"}`, { id });
    else toast.error(`${accepted.length - ok.length} upload${accepted.length - ok.length === 1 ? "" : "s"} failed`, { id });
  }

  function removeImage(path: string) {
    set("images", form.images.filter((p) => p !== path));
    // Brand-new uploads can go right away; saved photos are removed when the product is saved.
    if (unsaved.current.delete(path)) discardUploads([path]).catch((err) => console.error("discardUploads failed", err));
  }

  function makeCover(path: string) {
    set("images", [path, ...form.images.filter((p) => p !== path)]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading > 0) return toast.info("Wait for the photos to finish uploading.");
    const price = toNumber(form.price);
    const value = toNumber(form.rating);
    const payload: ProductInput = {
      name: form.name,
      slug: form.slug,
      category: form.category,
      summary: form.summary,
      specs: form.specs.filter((s) => s.label.trim() || s.value.trim()),
      priceCents: price == null || Number.isNaN(price) ? null : Math.round(price * 100),
      featured: form.featured,
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
      placement: form.placement,
      size: { w: Number(form.w), h: Number(form.h), d: Number(form.d) },
      watts: rating.key === "watts" ? value : null,
      kw: rating.key === "kw" ? value : form.category === "battery" ? toNumber(form.outputKw) : null,
      kwh: rating.key === "kwh" ? value : null,
      hybrid: form.hybrid,
      images: form.images,
    };
    startTransition(() => action({ id: product?.id, product: payload }));
  }

  const invalid = (key: string) => (errors[key] ? true : undefined);
  const error = (key: string) => errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>What customers see on the products page.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                className="h-10"
                value={form.name}
                aria-invalid={invalid("name")}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                }}
              />
              {error("name")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                className="h-10 font-mono"
                value={form.slug}
                aria-invalid={invalid("slug")}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
              />
              {error("slug") ?? (
                <p className="text-xs text-muted-foreground">
                  Used in saved simulator layouts{product ? "; changing it drops this product from them." : "."}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className={selectClass}
                value={form.category}
                onChange={(e) => changeCategory(e.target.value as ProductCategory)}
              >
                {productCategories.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabels[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                className="h-10"
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave empty for “Quoted”"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                rows={3}
                value={form.summary}
                aria-invalid={invalid("summary")}
                onChange={(e) => set("summary", e.target.value)}
              />
              {error("summary")}
            </div>

            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">Specs</legend>
              {form.specs.map((spec, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="h-9"
                    placeholder="Label (e.g. Efficiency)"
                    aria-label={`Spec ${i + 1} label`}
                    value={spec.label}
                    onChange={(e) =>
                      set("specs", form.specs.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))
                    }
                  />
                  <Input
                    className="h-9"
                    placeholder="Value (e.g. 21.3%)"
                    aria-label={`Spec ${i + 1} value`}
                    value={spec.value}
                    onChange={(e) =>
                      set("specs", form.specs.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    aria-label={`Remove spec ${i + 1}`}
                    onClick={() => set("specs", form.specs.filter((_, j) => j !== i))}
                  >
                    <XIcon />
                  </Button>
                </div>
              ))}
              {error("specs")}
              {form.specs.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-fit"
                  onClick={() => set("specs", [...form.specs, { label: "", value: "" }])}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add spec
                </Button>
              )}
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Simulator</CardTitle>
            <CardDescription>How the product is placed and sized in the 3D layout tool.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="placement">Mounts on</Label>
              <select
                id="placement"
                className={selectClass}
                value={form.placement}
                aria-invalid={invalid("placement")}
                onChange={(e) => set("placement", e.target.value as "roof" | "wall")}
              >
                <option value="roof">Roof</option>
                <option value="wall">Wall</option>
              </select>
              {error("placement")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rating">{rating.label}</Label>
              <Input
                id="rating"
                className="h-10"
                type="number"
                min="0"
                step={rating.step}
                value={form.rating}
                aria-invalid={invalid(rating.key)}
                onChange={(e) => set("rating", e.target.value)}
              />
              {error(rating.key)}
            </div>
            {form.category === "inverter" ? (
              <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.hybrid}
                  onChange={(e) => set("hybrid", e.target.checked)}
                />
                Hybrid (works with batteries)
              </label>
            ) : form.category === "battery" ? (
              <div className="grid gap-2">
                <Label htmlFor="output-kw">Max output (kW)</Label>
                <Input
                  id="output-kw"
                  className="h-10"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 5"
                  value={form.outputKw}
                  aria-invalid={invalid("kw")}
                  onChange={(e) => set("outputKw", e.target.value)}
                />
                {error("kw") ?? (
                  <p className="text-xs text-muted-foreground">Used to warn when too much runs at once.</p>
                )}
              </div>
            ) : (
              <span />
            )}
            {(["w", "h", "d"] as const).map((k) => (
              <div key={k} className="grid gap-2">
                <Label htmlFor={`size-${k}`}>{{ w: "Width", h: "Height", d: "Depth" }[k]} (m)</Label>
                <Input
                  id={`size-${k}`}
                  className="h-10"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form[k]}
                  aria-invalid={invalid(`size.${k}`)}
                  onChange={(e) => set(k, e.target.value)}
                />
                {error(`size.${k}`)}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>JPEG, PNG or WebP, up to 5 MB. The first photo is the cover.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.images.length > 0 && (
              <ul className="grid grid-cols-2 gap-2">
                {form.images.map((path, i) => (
                  <li key={path} className="group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                    <Image src={productImageUrl(path)} alt="" fill sizes="150px" className="object-cover" />
                    {i === 0 && (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium">
                        Cover
                      </span>
                    )}
                    <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      {i > 0 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7 bg-background/90"
                          aria-label="Make cover photo"
                          onClick={() => makeCover(path)}
                        >
                          <StarIcon />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-7 bg-background/90 text-destructive"
                        aria-label="Remove photo"
                        onClick={() => removeImage(path)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {form.images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void addFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5",
                  errors.images && "border-destructive",
                )}
              >
                {uploading > 0 ? (
                  <Loader2Icon className="size-5 animate-spin text-primary" />
                ) : (
                  <ImagePlusIcon className="size-5 text-primary" />
                )}
                <span>
                  <span className="font-medium text-foreground">Click to upload</span> or drop photos here
                </span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {error("images")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={form.active}
                onChange={(e) => set("active", e.target.checked)}
              />
              <span>
                <span className="block font-medium">Active</span>
                <span className="text-muted-foreground">Shown on the site and in the simulator.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={form.featured}
                onChange={(e) => set("featured", e.target.checked)}
              />
              <span>
                <span className="block font-medium">Featured</span>
                <span className="text-muted-foreground">Highlighted on the home page.</span>
              </span>
            </label>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Link href="/admin/products" className={cn(buttonVariants({ variant: "outline" }), "h-10 flex-1")}>
            Cancel
          </Link>
          <Button type="submit" className="h-10 flex-1" disabled={pending || uploading > 0}>
            {pending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
            {product ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}
