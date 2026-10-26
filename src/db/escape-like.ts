// ILIKE treats % and _ as wildcards: escape them so searching "50%" means "50%".
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
