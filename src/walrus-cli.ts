#!/usr/bin/env node
import fs from "fs";
import path from "path";
import yargs from "yargs";
import glob from "glob";
import { compileToFunctionString, encodeHelper } from "./walrus";

function writeFile(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    [
      "/* eslint-disable */",
      "/* tslint:disable */",
      encodeHelper,
      contents,
      "",
    ].join("\n"),
  );
}

yargs(process.argv.slice(2))
  .usage("Usage: $0 <command> [options]")
  .command(
    "compile",
    "Compile template files into exported JS functions",
    (yargs) =>
      yargs.options({
        input: { demandOption: true, describe: "A pattern like `**/*.wrs`." },
        output: {
          demandOption: true,
          describe: "Either a directory path or a path ending with .js.",
        },
      }),
    (argv) => {
      const outputArg = path.resolve(argv.output as string);
      const inputArg = argv.input as string;
      const files: string[] = glob.sync(inputArg);

      const exports = files.map((relativePath) => {
        const filePath = path.resolve(relativePath);
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
    },
  )
  .help()
  .strictCommands()
  .demandCommand(1)
  .parse();
