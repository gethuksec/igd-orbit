/**
 * Build a Prisma WHERE filter that performs per-word AND search across multiple fields.
 *
 * Example: search="budi jember" becomes:
 *   AND: [
 *     { OR: [ { name: { contains: "budi", mode: 'insensitive' } }, ... ] },
 *     { OR: [ { name: { contains: "jember", mode: 'insensitive' } }, ... ] },
 *   ]
 *
 * This means ALL words must match (AND between words), but each word can match
 * ANY of the specified fields (OR across fields).
 *
 * @param search - The raw search string from the user
 * @param fields - Array of field paths to search across (e.g. ['name', 'email'])
 * @returns Prisma WhereInput or undefined if search is empty
 */
export function buildPerWordSearch(
  search: string | undefined,
  fields: string[],
): Record<string, any> | undefined {
  if (!search) return undefined;

  const words = search.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return undefined;

  return {
    AND: words.map((word) => ({
      OR: fields.map((field) => ({
        [field]: { contains: word, mode: 'insensitive' as const },
      })),
    })),
  };
}
