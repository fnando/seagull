#!/usr/bin/env node
/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import yargs from "yargs";
import glob from "glob";
// eslint-disable-next-line @fnando/consistent-import/consistent-import
import { compileToFunctionString, encodeHelper } from "./seagull";

function writeFile(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    ["/* eslint-disable */", "// @ts-nocheck", encodeHelper, contents, ""].join(
      "\n",
    ),
  );
}

yargs(process.argv.slice(2))
  .usage("Usage: $0 <command> [options]")
  .command(
    "compile",
    "Compile template files into exported JS functions",
    (yargs) =>
      yargs.options({
        input: { demandOption: true, describe: "A pattern like `**/*.sea`." },
        output: {
          demandOption: true,
          describe: "Either a directory path or a path ending with .js.",
        },
      }),
    (argv) => {
      const outputArg = path.resolve(argv.output as string);
      const inputArg = argv.input as string;
      const files: string[] = glob.sync(inputArg);
      let filePath = "";

      try {
        const exports = files.map((relativePath) => {
          filePath = path.resolve(relativePath);
          const name = path.basename(filePath).split(".")[0];
          const template = fs.readFileSync(filePath).toString("utf-8");
          const compiled =
            `module.exports.${name} = ` +
            compileToFunctionString(name, template, false);
          const outputPath = outputArg.endsWith(".js")
            ? outputArg
            : path.join(outputArg, `${name}.js`);

          return { compiled, relativePath, filePath, outputPath };
        });

        if (outputArg.endsWith(".js")) {
          const contents = exports.map((e) => e.compiled).join("\n\n");
          writeFile(outputArg, contents);
        } else {
          exports.forEach((e) => {
            writeFile(e.outputPath, e.compiled);
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (!("detail" in error)) {
          console.log("(error)", error?.message ?? error);
          process.exit(1);
        }

        const message = error.message.replace(
          /\(line: \d+, column: \d+\)$/,
          "",
        );
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(
          `(error) ${relativePath}:${error.detail.line}:${error.detail.column}`,
          message,
        );

        process.exit(1);
      }
    },
  )
  .help()
  .strictCommands()
  .demandCommand(1)
  .parse();
