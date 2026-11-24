export function celsiusToFahrenheit(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? (value * 9 / 5 + 32).toFixed(1)
    : null;
}
