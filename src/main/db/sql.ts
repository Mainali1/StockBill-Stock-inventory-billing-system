/**
 * Escapes a user search term for use with `LIKE ? ESCAPE '\'`.
 * A literal backslash, `%` and `_` are each prefixed with a backslash.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}
