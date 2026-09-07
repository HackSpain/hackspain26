export function parseEventDetails(args: {
  dietaryRestrictions: string;
  dietaryDetails?: string;
  travelOrigin: string;
}): {
  dietaryRestrictions: string;
  dietaryDetails: string | undefined;
  travelOrigin: string;
} {
  const dietaryRestrictions = args.dietaryRestrictions.trim();
  if (!dietaryRestrictions) {
    throw new Error("Añade restricciones alimentarias, o escribe Ninguna");
  }
  const travelOrigin = args.travelOrigin.trim();
  if (!travelOrigin) {
    throw new Error("Dinos desde dónde viajas");
  }
  const dietaryDetails = args.dietaryDetails?.trim();
  return {
    dietaryDetails: dietaryDetails || undefined,
    dietaryRestrictions,
    travelOrigin,
  };
}
