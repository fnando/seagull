type Scope = {
  globalCaptures: Set<string>;
  localCaptures: Set<string>[];
  blocks: string[];
  buffer: string;
};

type ExpressionParserResult = {
  output: string;
  globalCaptures: string[];
  localCaptures: string[];
  popBlock?: boolean;
};

type ExpressionParser = {
  match: RegExp;
  process(expression: string, scope: Scope): ExpressionParserResult;
};

type CompileToStringResult = {
  /**
   * The function body.
   * @type {string}
   */
  output: string;

  /**
   * The list of variables that must be provided to the template function.
   * @type {string[]}
   */
  captures: string[];
};

class UnmatchedBlockError extends Error {
  public detail: {
    /**
     * The template's line number that generated the error.
     * @type {number}
     */
    line: number;

    /**
     * The template's column number that generated the error.
     * @type {number}
     */
    column: number;

    /**
     * The expected block.
     * @type {string}
     */
    expected: string;

    /**
     * The actual block that was found.
     * @type {string}
     */
    actual: string;
  } = { line: 0, column: 0, expected: "", actual: "" };
}

class InvalidTemplateError extends Error {
  public detail: {
    template: string;
    output: string;
    captures: string[];
  } = { template: "", output: "", captures: [] };
}

export const encodeHelper = `
const _encode = (unsafe) =>
  String(unsafe).replace(
    /(?![0-9A-Za-z ])[\\u0000-\\u00FF]/g,
    (c) => "&#" + c.charCodeAt(0).toString().padStart(4, "0") + ";"
  );
`;

/**
 * Decode HTML entities into their character equivalent.
 * This is supposed to help with testing, not to bypass escaped values in
 * templates.
 *
 * @param {string} input The encoded string.
 * @return {string} The decoded string.
 */
export const decode = (input: string): string =>
  input.replace(/(&#(\d+);)/g, (_entity, _match, code) =>
    String.fromCharCode(parseInt(code, 10)),
  );

/**
 * Generate the tree for a template string.
 *
 * @param {string} template The template string.
 * @return {string[]} The template parsed into a tree. Each expression will be
 *                    isolated into its own array item.
 */
export const parse = (template: string): string[] => {
  let result = /{(.*?)}/g.exec(template);
  const tree = [];

  let position: number;

  while (result) {
    position = result.index;

    if (position !== 0) {
      tree.push(template.substring(0, position));
      template = template.slice(position);
    }

    tree.push(result[0]);
    template = template.slice(result[0].length);
    result = /{(.*?)}/g.exec(template);
  }

  if (template) {
    tree.push(template);
  }

  return tree;
};

const buildHelperChain = (
  input: string,
  rawHelpers: string,
): { output: string; captures: string[] } => {
  const helpers = rawHelpers.replace(/^ \| /, "").split(/ \| /);
  const output = helpers.reduce(
    (buffer, helper) => `${helper}(${buffer})`,
    input,
  );

  return {
    output,
    captures: helpers,
  };
};

const hasLocalCapture = (scope: Scope, capture: string): boolean =>
  scope.localCaptures
    .flatMap((captures) => Array.from(captures.values()))
    .includes(capture);

const validateClosingBlock = (scope: Scope, currentBlock: string) => {
  const expectedBlock = scope.blocks.pop() ?? "unknown";

  if (expectedBlock === currentBlock) {
    return;
  }

  const lines = scope.buffer.split(/\r?\n/);
  const line = lines.length;
  const column = (lines.pop() ?? "").length - currentBlock.length - 2;
  const error = new UnmatchedBlockError(
    `Expected {/${expectedBlock}}, got {/${currentBlock}} (line: ${line}, column: ${column})`,
  );

  error.detail = {
    line,
    column,
    expected: expectedBlock,
    actual: currentBlock,
  };

  throw error;
};

const variableExpressionParser = {
  match: /^{([a-z0-9._]+)((?: *\| *[a-z0-9_]+)+)?}$/i,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = expression.match(this.match);

    if (!matches) {
      throw new Error(
        `Running expression parser that didn't return any matches: ${expression}`,
      );
    }

    const capture = matches[1];
    let input = `${capture}`;

    const globalCaptures = [];

    if (matches[2]) {
      const chain = buildHelperChain(input, matches[2]);
      globalCaptures.push(...chain.captures);
      input = chain.output;
    }

    input = `_encode(${input})`;

    const captureTarget = capture.split(".")[0];
    const isLocalCapture = hasLocalCapture(scope, captureTarget);

    if (!isLocalCapture) {
      globalCaptures.push(captureTarget);
    }

    return {
      output: ` + ${input}`,
      globalCaptures,
      localCaptures: [isLocalCapture ? captureTarget : ""].filter(Boolean),
    };
  },
};

const stringPipingExpressionParser = {
  match: /^{((["']).*?(\1))( *\| *[a-z0-9_.]+)+}$/i,
  process(expression: string): ExpressionParserResult {
    const matches = expression.match(this.match);

    if (!matches) {
      throw new Error(
        `Running expression parser that didn't return any matches: ${expression}`,
      );
    }

    const capture = matches[1];
    let input = `${capture}`;

    const globalCaptures = [];

    if (matches[4]) {
      const chain = buildHelperChain(input, matches[4]);
      globalCaptures.push(...chain.captures);
      input = chain.output;
    }

    input = `_encode(${input})`;

    return {
      output: ` + ${input}`,
      globalCaptures,
      localCaptures: [].filter(Boolean),
    };
  },
};

const ifExpressionParser = {
  match: /^{if ([a-zA-z0-9._]+)((?: *\| *[a-zA-z0-9_]+)+)?}$/,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = expression.match(this.match);

    if (!matches) {
      throw new Error(
        `Running expression parser that didn't return any matches: ${expression}`,
      );
    }

    const capture = matches[1];
    let input = `${capture}`;
    const globalCaptures: string[] = [];

    scope.blocks.push("if");

    if (matches[2]) {
      const chain = buildHelperChain(input, matches[2]);
      input = chain.output;
      globalCaptures.push(...chain.captures);
    }

    const captureTarget = capture.split(".")[0];
    const isLocalCapture = hasLocalCapture(scope, captureTarget);

    if (!isLocalCapture) {
      globalCaptures.push(captureTarget);
    }

    return {
      output: ` + (${input} ? ( ""`,
      globalCaptures,
      localCaptures: [],
    };
  },
};

const ifClosingExpressionParser = {
  match: /^{\/if}$/,
  process(_expression: string, scope: Scope): ExpressionParserResult {
    validateClosingBlock(scope, "if");

    return {
      output: `) : "")`,
      globalCaptures: [],
      localCaptures: [],
    };
  },
};

const unlessExpressionParser = {
  match: /^{unless ([a-zA-z0-9._]+)((?: *\| *[a-zA-z0-9_]+)+)?}$/,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = expression.match(this.match);

    if (!matches) {
      throw new Error(
        `Running expression parser that didn't return any matches: ${expression}`,
      );
    }

    const capture = matches[1];
    let input = `${capture}`;
    const globalCaptures: string[] = [];

    scope.blocks.push("unless");

    if (matches[2]) {
      const chain = buildHelperChain(input, matches[2]);
      input = chain.output;
      globalCaptures.push(...chain.captures);
    }

    const captureTarget = capture.split(".")[0];
    const isLocalCapture = hasLocalCapture(scope, captureTarget);

    if (!isLocalCapture) {
      globalCaptures.push(captureTarget);
    }

    return {
      output: ` + (!${input} ? ( ""`,
      globalCaptures,
      localCaptures: [],
    };
  },
};

const unlessClosingExpressionParser = {
  match: /^{\/unless}$/,
  process(_expression: string, scope: Scope): ExpressionParserResult {
    validateClosingBlock(scope, "unless");

    return {
      output: `) : "")`,
      globalCaptures: [],
      localCaptures: [],
    };
  },
};

const eachArrayExpressionParser = {
  match:
    /^{each ([a-zA-z0-9_]+)(?:, *([a-z0-9_]+)(?:, *([a-z0-9_]+))?)? +in +([a-zA-z0-9_.]+)}$/,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = expression.match(this.match);

    if (!matches) {
      throw new Error(
        `Running expression parser that didn't return any matches: ${expression}`,
      );
    }

    const iteratee = matches[1];
    const index = matches[2] ?? "_index";
    const iterable = matches[4];

    scope.blocks.push("each");
    const isLocalCapture = hasLocalCapture(scope, iterable);

    return {
      output: ` + (${iterable}).map((${iteratee}, ${index}) => { return ""`,
      globalCaptures: [!isLocalCapture ? iterable : ""].filter(Boolean),
      localCaptures: [isLocalCapture ? iterable : ""].filter(Boolean),
    };
  },
};

const eachDictionaryExpressionParser = {
  match:
    /^{each ([a-zA-z0-9_]+) *=> *([a-zA-z0-9_]+)(?:, *([a-z0-9_]+))? +in +([a-zA-z0-9_.]+)}$/,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = expression.match(this.match);

    if (!matches) {
      throw new Error(
        `Running expression parser that didn't return any matches: ${expression}`,
      );
    }

    const key = matches[1];
    const value = matches[2];
    const index = matches[3] ?? "_index";
    const iterable = matches[4];

    scope.blocks.push("each");
    const isLocalCapture = hasLocalCapture(scope, iterable);

    return {
      output: ` + (Object.keys(${iterable}).map((_key) => [_key, ${iterable}[_key]])).map(([${key}, ${value}], ${index}) => { return ""`,
      globalCaptures: [!isLocalCapture ? iterable : ""].filter(Boolean),
      localCaptures: [isLocalCapture ? iterable : ""].filter(Boolean),
    };
  },
};

const eachClosingExpressionParser = {
  match: /^{\/each}$/,
  process(_expression: string, scope: Scope): ExpressionParserResult {
    validateClosingBlock(scope, "each");

    return {
      output: `; }).join("")`,
      globalCaptures: [],
      localCaptures: [],
      popBlock: true,
    };
  },
};

/**
 * List of expression parsers.
 * @type {ExpressionParser[]}
 */
export const expressionParsers: ExpressionParser[] = [
  variableExpressionParser,
  ifExpressionParser,
  ifClosingExpressionParser,
  unlessExpressionParser,
  unlessClosingExpressionParser,
  eachArrayExpressionParser,
  eachDictionaryExpressionParser,
  eachClosingExpressionParser,
  stringPipingExpressionParser,
];

const compileExpression = (
  expression: string,
  scope: Scope,
): ExpressionParserResult => {
  const parser = expressionParsers.find((exp) => exp.match.test(expression));

  if (!parser) {
    throw new Error(`Unknown expression: ${expression}`);
  }

  return parser.process(expression, scope);
};

/**
 * Convert a template tree generated by `parse` into a function body.
 *
 * @param {string[]} tree The template tree.
 * @return {CompileToStringResult} The result.
 */
export const compileToString = (tree: string[]): CompileToStringResult => {
  let fnStr = `""`;

  const scope: Scope = {
    globalCaptures: new Set<string>(),
    localCaptures: [],
    blocks: [],
    buffer: "",
  };

  const localScopes: string[][] = [];

  tree.forEach((node) => {
    scope.buffer += node;

    if (node.startsWith("{") && node.endsWith("}")) {
      const {
        output,
        globalCaptures: newGlobalCaptures,
        localCaptures: newLocalCaptures,
        popBlock,
      } = compileExpression(node, scope);

      newGlobalCaptures.forEach((capture) =>
        scope.globalCaptures.add(capture.split(".")[0]),
      );

      if (popBlock) {
        localScopes.pop();
      } else {
        localScopes.push(newLocalCaptures);
      }

      fnStr += output;
    } else {
      node = node
        .replace(/\n/gm, "\\n")
        .replace(/\r/gm, "\\r")
        .replace(/\t/gm, "\\t")
        .replace(/"/gm, '\\"');

      fnStr += ` + "${node}"`;
    }
  });

  return {
    output: `return (${fnStr});`,
    captures: Array.from<string>(scope.globalCaptures.values()),
  };
};

/**
 * Compile a template to a function string.
 *
 * @param {string} name The function name.
 * @param {string} template The template that will be parsed.
 * @param {boolean} includeEscapeHelper When `true`, the `_escape` helper will
 *                                      be embedded into the function.
 * @return {string} The function representation.
 */
export const compileToFunctionString = (
  name: string,
  template: string,
  includeEscapeHelper = true,
): string => {
  // eslint-disable-next-line prefer-const
  let { output, captures } = compileToString(parse(template));

  if (includeEscapeHelper) {
    output = `${encodeHelper}\n${output}`;
  }

  return `function ${name}({${captures.join(", ")}}) { ${output} }`;
};

/**
 * Compile a template to a function object.
 * This allows parsing and executing templates in runtime.
 * Notice that the resulting function wil be anonymous.
 *
 * @param {string} template The template that will be parsed.
 * @param {boolean} includeEscapeHelper When `true`, the `_escape` helper will
 *                                      be embedded into the function.
 * @return {function} The function representation.
 */
export const compile = (template: string, includeEscapeHelper = true) => {
  // eslint-disable-next-line prefer-const
  let { output, captures } = compileToString(parse(template));

  if (includeEscapeHelper) {
    output = `${encodeHelper}\n${output}`;
  }

  try {
    return new Function(`{${captures.join(", ")}}`, output);
  } catch (originalError) {
    const error = new InvalidTemplateError(
      "The template generated invalid JavaScript code.",
    );
    error.detail = { template, output, captures };

    throw error;
  }
};
