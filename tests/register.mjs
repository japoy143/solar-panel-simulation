// Test-only module hooks (no dependencies): resolve the `@/` path alias and extensionless
// relative imports (written for the bundler), and stub `server-only`. Node strips the TS types.
// Used by `npm test`: node --import ./tests/register.mjs --test
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);

function withExtension(url) {
  const path = fileURLToPath(url);
  if (existsSync(path) && statSync(path).isFile()) return url;
  for (const ext of [".ts", ".tsx", "/index.ts"]) {
    if (existsSync(path + ext)) return pathToFileURL(path + ext).href;
  }
  return url;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier.startsWith("@/")) {
      return { url: withExtension(new URL(specifier.slice(2), root).href), shortCircuit: true };
    }
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    const ownCode = context.parentURL?.startsWith(root.href) && !context.parentURL.includes("/node_modules/");
    if (relative && ownCode && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return { url: withExtension(new URL(specifier, context.parentURL).href), shortCircuit: true };
    }
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      // Packages without an exports map, e.g. `next/cache` → next/cache.js.
      if (err?.code === "ERR_MODULE_NOT_FOUND" && !specifier.startsWith(".")) return nextResolve(`${specifier}.js`, context);
      throw err;
    }
  },
});
