import { Contact } from "@/lib/types";

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function contactsToCsv(contacts: Contact[]): string {
  if (!contacts.length) return "";
  const headers = Object.keys(contacts[0]) as (keyof Contact)[];
  const rows = contacts.map((contact) => headers.map((header) => escapeCsv(contact[header])).join(","));
  return [headers.join(","), ...rows].join("\r\n");
}

export function downloadFile(filename: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
