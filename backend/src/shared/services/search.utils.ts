/**
 * Build a Prisma WHERE filter that performs per-word OR search across multiple fields.
 *
 * Example: search="budi jember" becomes:
 *   OR: [
 *     { OR: [ { name: { contains: "budi", mode: 'insensitive' } }, ... ] },
 *     { OR: [ { name: { contains: "jember", mode: 'insensitive' } }, ... ] },
 *   ]
 *
 * This means ANY word can match (OR between words), and each word can match
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
    OR: words.map((word) => ({
      OR: fields.map((field) => ({
        [field]: { contains: word, mode: 'insensitive' as const },
      })),
    })),
  };
}
