export function hasConfiguredValue(
  value: string | undefined,
  markers: string[] = ['replace-me'],
): value is string {
  if (!value?.trim()) return false;
  const normalized = value.toLowerCase();
  return !markers.some((marker) => normalized.includes(marker));
}
