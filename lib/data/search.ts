import "server-only";

/**
 * A PostgREST `.or()` filter matching `q` (case-insensitive, substring) in any of `columns`,
 * or null when there's nothing to search for.
 *
 * The query string is user input spliced into filter syntax, so every character that means
 * something to PostgREST (`,` `(` `)` `.` `:` quotes, and the `%` `*` `_` `\` wildcards) is
 * replaced with the `*` wildcard first. A wildcard (not a space) keeps searches containing them
 * working: "jo.doe@mail.com" becomes `jo*doe@mail*com`, which still matches the address.
 */
export function searchFilter(q: string | undefined, columns: string[]): string | null {
  const term = (q ?? "")
    .replace(/[,().:"'%*_\\]/g, "*")
    .replace(/\s+/g, " ")
    .replace(/\*+/g, "*")
    .trim()
    .replace(/^\*+|\*+$/g, "")
    .trim()
    .slice(0, 100);
  if (!term) return null;
  return columns.map((c) => `${c}.ilike.*${term}*`).join(",");
}

/** A single string value from searchParams (`?q=a&q=b` → "a"). */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
