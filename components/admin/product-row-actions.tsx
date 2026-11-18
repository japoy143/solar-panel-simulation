"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteProduct, setProductActive } from "@/app/admin/(dashboard)/products/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export function ProductRowActions({ id, name, active }: { id: string; name: string; active: boolean }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const result = await setProductActive(id, !active);
      if (!result.ok) return void toast.error(result.error);
      toast.success(active ? `${name} hidden from the site` : `${name} is live on the site`);
      router.refresh();
    });

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description:
        "It's removed from the site and simulator, and its photos are deleted. Saved customer layouts that use it will skip it. This can't be undone. To keep it but hide it, use Hide instead.",
      confirmLabel: "Delete product",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteProduct(id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${name} deleted`);
      router.refresh();
    });
  };

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={pending}
        onClick={toggle}
        aria-label={active ? `Hide ${name}` : `Show ${name}`}
        title={active ? "Hide from site" : "Show on site"}
      >
        {active ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
      <Link
        href={`/admin/products/${id}/edit`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8")}
        aria-label={`Edit ${name}`}
        title="Edit"
      >
        <PencilIcon />
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={remove}
        aria-label={`Delete ${name}`}
        title="Delete"
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
