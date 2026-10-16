import "./styles.css";
import { initializeApp } from "./ui";
import { initializeWebAnalytics } from "./web-analytics";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("#app was not found.");
}

initializeApp(app);
initializeWebAnalytics();
