export const INTERNAL_UNCATEGORIZED_CATEGORY_NAME = "미분류";

export function isInternalUncategorizedCategory(name: string) {
  return name.trim() === INTERNAL_UNCATEGORIZED_CATEGORY_NAME;
}

export function filterVisibleCategoryNames(names: readonly string[]) {
  return names.filter((name) => !isInternalUncategorizedCategory(name));
}
