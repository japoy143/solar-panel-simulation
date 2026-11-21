import { CircleDashedIcon } from "lucide-react";

/** Shown instead of an estimate until the system is fully assembled (see `missingParts`). */
export function SetupSteps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step} className="flex items-center gap-2 text-sm font-medium">
            <CircleDashedIcon className="size-3.5 shrink-0 text-muted-foreground" />
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}
