import { decodeHTMLAttribute } from "entities";
import { Rule } from "html-validate";

// Preserve the previous HTML gate's prohibition of inline executable content.
class NoInlineScript extends Rule {
  setup() {
    this.on("attr", (event) => {
      const name = event.key.toLowerCase();
      const isEventHandler = name.startsWith("on");
      const url = decodeHTMLAttribute(String(event.value ?? "")).replace(/[\t\n\r]/g, "");
      const isScriptUrl =
        ["href", "src", "xlink:href", "action", "formaction"].includes(name) &&
        /^\s*javascript:/i.test(url);
      if (isEventHandler || isScriptUrl) {
        this.report(event.target, "Inline executable content is forbidden.", event.keyLocation);
      }
    });
  }
}

export default {
  name: "project",
  rules: { "project/no-inline-script": NoInlineScript },
};
