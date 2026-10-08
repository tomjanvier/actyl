export function parseCommissions(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter((v): v is string => typeof v === "string");
    if (typeof parsed === "string") return [parsed];
  } catch {
    return [value];
  }
  return [];
}
