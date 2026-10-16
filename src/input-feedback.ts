export function setMaterialInputError(form: HTMLFormElement, invalid: boolean): void {
  const input = form.querySelector<HTMLInputElement>('[data-testid="combo-input-materials"]');
  const feedback = form.querySelector<HTMLElement>('[data-testid="materials-error"]');
  if (!input || !feedback) return;
  feedback.hidden = !invalid;
  feedback.setAttribute("role", "alert");
  const descriptions = (input.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter((id) => id && id !== feedback.id);
  if (invalid) {
    input.setAttribute("aria-invalid", "true");
    descriptions.push(feedback.id);
  } else {
    input.removeAttribute("aria-invalid");
  }
  if (descriptions.length) input.setAttribute("aria-describedby", descriptions.join(" "));
  else input.removeAttribute("aria-describedby");
}

export function focusInputWithFeedback(
  input: HTMLInputElement,
  feedback: HTMLElement | null,
  footer: HTMLElement,
): void {
  input.focus({ preventScroll: true });
  const inputBounds = input.getBoundingClientRect();
  const feedbackBottom = feedback && !feedback.hidden ? feedback.getBoundingClientRect().bottom : 0;
  const footerBounds = footer.getBoundingClientRect();
  const visibleBottom =
    window.innerWidth < 1024 && footerBounds.height > 0
      ? Math.min(window.innerHeight, footerBounds.top)
      : window.innerHeight;
  const gap = 12;
  const bottom = Math.max(inputBounds.bottom, feedbackBottom);
  const delta =
    bottom > visibleBottom - gap
      ? bottom - visibleBottom + gap
      : inputBounds.top < gap
        ? inputBounds.top - gap
        : 0;
  if (delta) window.scrollBy({ top: delta, behavior: "instant" });
}
