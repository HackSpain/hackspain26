const DIETARY_LABELS: Record<string, string> = {
  allergies: "Alergias",
  gluten_free: "Sin gluten",
  halal: "Halal",
  kosher: "Kosher",
  lactose_free: "Sin lactosa",
  other: "Otra",
  vegan: "Vegana",
  vegetarian: "Vegetariana",
};

export function formatDietaryRestrictions(ids: string[] | undefined): string {
  const labels = (ids ?? [])
    .map((id) => DIETARY_LABELS[id] ?? id.trim())
    .filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "Ninguna";
}
