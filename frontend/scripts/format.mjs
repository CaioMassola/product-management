import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../', import.meta.url));
const write = process.argv.includes('--write');
const eslint = new ESLint({ cwd: root, fix: true });

const ignoredDirectories = new Set([
  'node_modules',
  '.next',
  '.git',
  'coverage',
]);

let differences = 0;

async function formatDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await formatDirectory(filePath);
      continue;
    }

    if (!entry.isFile()) continue;

    const info = await prettier.getFileInfo(filePath, {
      ignorePath: path.join(root, '.prettierignore'),
    });

    if (info.ignored || !info.inferredParser) continue;
    const original = await readFile(filePath, 'utf8');
    const options = await prettier.resolveConfig(filePath);
    let formatted = original;
    // Converge after adding JSX line breaks that can affect Prettier's wrapping.
    for (let attempt = 0; attempt < 5; attempt++) {
      const previous = formatted;
      formatted = await prettier.format(formatted, {
        ...options,
        filepath: filePath,
      });
      if (/\.(?:tsx?|m?js)$/.test(filePath)) {
        const [result] = await eslint.lintText(formatted, { filePath });
        formatted = result.output ?? formatted;
      }

      if (formatted === previous) break;
      if (attempt === 4)
        throw new Error(`Formatting did not converge: ${filePath}`);
    }

    if (formatted === original) continue;
    differences++;
    console.log(path.relative(root, filePath));
    if (write) await writeFile(filePath, formatted);
  }
}

await formatDirectory(root);
console.log(
  write
    ? `Formatted ${differences} files.`
    : `${differences} files need formatting.`,
);
if (!write && differences) process.exitCode = 1;
