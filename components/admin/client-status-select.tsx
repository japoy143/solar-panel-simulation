"use client";

import { updateClientStatus } from "@/app/admin/(dashboard)/clients/actions";
import { clientStatuses, clientStatusLabels, type ClientStatus } from "@/lib/clients";
import { StatusSelect } from "./status-select";

export const clientStatusTones: Record<ClientStatus, string> = {
  lead: "border-primary/40 bg-primary/10 text-primary-strong",
  assessment: "border-foreground/20 bg-background",
  installing: "border-foreground/40 bg-foreground text-background",
  completed: "border-primary/30 bg-primary/15 text-primary-strong",
  maintenance: "border-foreground/20 bg-muted text-foreground",
  inactive: "border-transparent bg-muted text-muted-foreground",
};

const options = clientStatuses.map((s) => ({ value: s, label: clientStatusLabels[s] }));

export function ClientStatusSelect({ id, name, status }: { id: string; name: string; status: ClientStatus }) {
  return (
    <StatusSelect
      label={`Status for ${name}`}
      value={status}
      options={options}
      tones={clientStatusTones}
      onChange={async (next) => {
        const result = await updateClientStatus(id, next);
        return result.ok ? { ok: true, message: `${name}: ${clientStatusLabels[next].toLowerCase()}` } : result;
      }}
    />
  );
}
