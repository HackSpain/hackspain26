"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Field, Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { perkName, perkTypeLabel } from "@/lib/utils";

function lines(value: string): string[] {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AdminPerksPage() {
  const perks = useQuery(api.perks.adminList);
  const create = useMutation(api.perks.adminCreate);
  const update = useMutation(api.perks.adminUpdate);
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"email" | "code">("email");
  const [codes, setCodes] = useState("");
  const [extraCodes, setExtraCodes] = useState<Record<string, string>>({});

  return (
    <Page title="Admin de perks">
      <Card>
        <CardHeader>
          <CardTitle>Crear perk</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Empresa">
              <Input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </Field>
            <Field label="Título">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label="Valor">
              <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="100 créditos de Cursor"
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={type}
                onValueChange={(next) => setType(next as "email" | "code")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Solicitud por email</SelectItem>
                  <SelectItem value="code">Bolsa de códigos</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Descripción">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          {type === "code" ? (
            <Field label="Códigos (uno por línea)">
              <Textarea
                value={codes}
                onChange={(event) => setCodes(event.target.value)}
                className="font-mono"
              />
            </Field>
          ) : null}
          <Button
            className="w-full sm:w-auto"
            onClick={() =>
              void create({
                company,
                title,
                value,
                description,
                type,
                codes: type === "code" ? lines(codes) : undefined,
              }).then(() => {
                setCompany("");
                setTitle("");
                setValue("");
                setDescription("");
                setCodes("");
              })
            }
          >
            Crear perk
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {perks?.map((perk) => (
          <Card key={perk._id}>
            <CardHeader>
              <CardTitle>{perkName(perk.company, perk.title)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{perk.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge>{perkTypeLabel(perk.type)}</Badge>
                <Badge variant="gold">{perk.value}</Badge>
                <span>
                  {perk.claimCount} reclamaciones
                  {perk.type === "code"
                    ? ` · ${perk.availableCodes}/${perk.codeCount} códigos libres`
                    : ""}
                </span>
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() =>
                  void update({ perkId: perk._id, active: !perk.active })
                }
              >
                {perk.active ? "Desactivar" : "Activar"}
              </Button>
              {perk.type === "code" ? (
                <Field label="Añadir más códigos">
                  <Textarea
                    value={extraCodes[perk._id] ?? ""}
                    onChange={(event) =>
                      setExtraCodes((current) => ({
                        ...current,
                        [perk._id]: event.target.value,
                      }))
                    }
                    className="font-mono"
                  />
                  <Button
                    variant="teal"
                    className="mt-2 w-full sm:w-auto"
                    onClick={() =>
                      void update({
                        perkId: perk._id as Id<"perks">,
                        codesToAdd: lines(extraCodes[perk._id] ?? ""),
                      }).then(() =>
                        setExtraCodes((current) => ({
                          ...current,
                          [perk._id]: "",
                        }))
                      )
                    }
                  >
                    Añadir códigos
                  </Button>
                </Field>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </Page>
  );
}
