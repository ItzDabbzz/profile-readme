/**
 * Capitalizes a string in a human-readable format.
 *
 * Converts underscores to spaces, trims extra spaces, and capitalizes
 * the first letter of each word recursively.
 *
 * Examples:
 * ```ts
 * capitalize("hello_world") // "Hello World"
 * capitalize("multiple   spaces") // "Multiple Spaces"
 * ```
 *
 * @param str The string to capitalize.
 * @returns The capitalized string.
 */
export function capitalize(str: string): string {
  str = str.replace(/_+/g, " ");
  str = str.replace(/\s+/g, " ");
  if (str.includes(" ")) {
    return str
      .split(" ")
      .reduce((a, b) => a + " " + capitalize(b), "")
      .trim();
  }
  return (str.slice(0, 1).toUpperCase() + str.slice(1)).trim();
}

/**
 * Randomly picks unique items from an array.
 *
 * Ensures no duplicate items are returned and validates the limit.
 *
 * Examples:
 * ```ts
 * pickRandomItems([1, 2, 3, 4], 2) // [2, 4] (random)
 * pickRandomItems(["a", "b", "c"], 1) // ["b"] (random)
 * ```
 *
 * @param items The array of items to pick from.
 * @param limit The number of items to pick (default is 2).
 * @throws Will throw an error if `limit` < 1 or if `limit` > items.length.
 * @returns An array containing `limit` unique random items.
 */
export function pickRandomItems<T>(items: T[], limit = 2): T[] {
  if (limit < 1) throw new Error("Pick at least 1 item");
  if (items.length < limit) {
    throw new Error("You can't pick more items than there are in the array.");
  }

  const indices: number[] = [];
  while (indices.length < limit) {
    const index = Math.floor(Math.random() * items.length);
    if (indices.indexOf(index) !== -1) continue;
    indices.push(index);
  }

  return indices.map(idx => items[idx]);
}