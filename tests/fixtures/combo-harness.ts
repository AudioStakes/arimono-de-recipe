import { createComboRegistry } from "../../src/combo-registry";

const form = document.querySelector<HTMLFormElement>("#harnessForm");
const values = document.querySelector<HTMLElement>("#values");

if (!form || !values) {
  throw new Error("Harness elements were not found.");
}

let registry: ReturnType<typeof createComboRegistry> | null = null;

const syncValues = (): void => {
  if (!registry) {
    return;
  }
  values.textContent = registry.getValues("materials").join("、");
};

registry = createComboRegistry(form, { onChange: syncValues });
registry.bind(form);
syncValues();
