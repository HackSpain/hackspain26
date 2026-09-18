import type { Id } from "@convex/_generated/dataModel";

export async function uploadToConvex(
  uploadUrl: string,
  file: File,
  errorMessage: string,
): Promise<Id<"_storage">> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(errorMessage);
  }
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("storageId" in value) ||
    typeof value.storageId !== "string"
  ) {
    throw new Error(errorMessage);
  }
  return value.storageId as Id<"_storage">;
}
