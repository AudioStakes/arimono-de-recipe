import "./styles.css";
import { initializeApp } from "./ui";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("#app was not found.");
}

initializeApp(app);
