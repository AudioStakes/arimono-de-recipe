export function updateComboValues(values: string[], oldValue: string, newValue: string): string[] {
  const nextValue = newValue.trim();

  if (!nextValue || nextValue === oldValue || !values.includes(oldValue)) {
    return values;
  }

  if (values.includes(nextValue)) {
    return values.filter((value) => value !== oldValue);
  }

  return values.map((value) => (value === oldValue ? nextValue : value));
}
