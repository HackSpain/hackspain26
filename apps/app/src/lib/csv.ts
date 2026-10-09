export type CsvValue = string | number | boolean | null | undefined;

const BOM = "\uFEFF";
const NEEDS_QUOTES = /[",;\r\n]/;

function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** UTF-8 BOM so Excel reads accents, CRLF because that is what it writes. */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
