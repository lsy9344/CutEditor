import { readFileSync } from "node:fs";
import ts from "typescript";

export async function loadTsModule(modulePath) {
  const source = readFileSync(modulePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  });

  const dataUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
  return import(`${dataUrl}#${Date.now()}`);
}
