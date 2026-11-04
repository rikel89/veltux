"use client";

import { useEffect, useState, useTransition } from "react";
import { LoaderCircle, Search, UserPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createQuickClient, searchMyClients } from "@/modules/clients/actions";
import type { ClientSummary } from "@/modules/clients/queries";

export type PickedClient = { id: string; fullName: string; phone: string };

/** Busca en la cartera propia o da de alta un cliente nuevo sin salir de la cita. */
export function ClientPicker({
  value,
  onChange,
  error,
}: {
  value: PickedClient | null;
  onChange: (client: PickedClient | null) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ fullName: "", phone: "", email: "" });
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    if (value || creating) return;
    let alive = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchMyClients(query)
        .then((rows) => alive && setResults(rows))
        .finally(() => alive && setSearching(false));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, value, creating]);

  if (value) {
    return (
      <div className="space-y-2">
        <Label>Cliente</Label>
        <input type="hidden" name="clientId" value={value.id} />
        <div className="flex items-center gap-3 rounded-xl border border-graphite bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{value.fullName}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{value.phone}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X /> Cambiar
          </Button>
        </div>
      </div>
    );
  }

  if (creating) {
    return (
      <fieldset className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-medium">Nuevo cliente</legend>
        <div className="space-y-1.5">
          <Label htmlFor="quick-name">Nombre</Label>
          <Input
            id="quick-name"
            value={draft.fullName}
            onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
            className="h-11 rounded-xl bg-white"
            aria-invalid={Boolean(draftErrors.fullName)}
          />
          {draftErrors.fullName && <p className="text-xs font-medium text-destructive">{draftErrors.fullName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quick-phone">Teléfono</Label>
          <Input
            id="quick-phone"
            type="tel"
            inputMode="tel"
            placeholder="600 000 000"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            className="h-11 rounded-xl bg-white"
            aria-invalid={Boolean(draftErrors.phone)}
          />
          {draftErrors.phone && <p className="text-xs font-medium text-destructive">{draftErrors.phone}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quick-email">Email (opcional)</Label>
          <Input
            id="quick-email"
            type="email"
            inputMode="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            className="h-11 rounded-xl bg-white"
            aria-invalid={Boolean(draftErrors.email)}
          />
          {draftErrors.email ? (
            <p className="text-xs font-medium text-destructive">{draftErrors.email}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Sin email no recibirá confirmaciones ni recordatorios.</p>
          )}
        </div>
        {draftErrors._ && <p className="text-xs font-medium text-destructive">{draftErrors._}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="dark"
            size="sm"
            disabled={saving}
            onClick={() =>
              startSaving(async () => {
                const result = await createQuickClient(draft);
                if ("client" in result) {
                  setCreating(false);
                  setDraft({ fullName: "", phone: "", email: "" });
                  setDraftErrors({});
                  onChange(result.client);
                } else {
                  setDraftErrors({ ...(result.fieldErrors ?? {}), ...(result.error ? { _: result.error } : {}) });
                }
              })
            }
          >
            {saving && <LoaderCircle className="animate-spin" />}
            Crear y seleccionar
          </Button>
        </div>
      </fieldset>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="client-search">Cliente</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="client-search"
          type="search"
          placeholder="Busca por nombre o teléfono"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 rounded-xl bg-white pl-10 text-base md:text-sm"
          aria-invalid={Boolean(error)}
          autoComplete="off"
        />
        {searching && <LoaderCircle className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-white" aria-label="Clientes encontrados">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
              onClick={() => onChange({ id: c.id, fullName: c.fullName, phone: c.phone })}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.fullName}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{c.phone}</span>
            </button>
          </li>
        ))}
        {!searching && results.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">{query ? "Sin resultados" : "Aún no tienes clientes"}</li>
        )}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="bg-white"
        onClick={() => {
          setCreating(true);
          setDraft({ fullName: /\d/.test(query) ? "" : query, phone: /\d/.test(query) ? query : "", email: "" });
        }}
      >
        <UserPlus /> Nuevo cliente
      </Button>
    </div>
  );
}
