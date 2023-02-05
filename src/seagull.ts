type Scope = {
  globalCaptures: Set<string>;
  localCaptures: Set<string>[];
  blocks: string[];
  buffer: string;
};

type Location = { line: number; column: number };

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
  } = { line: 1, column: 1, expected: "", actual: "" };
}

class InvalidTemplateError extends Error {
  public detail: {
    template: string;
    output: string;
    captures: string[];
  } = { template: "", output: "", captures: [] };
}

class UnknownExpressionError extends Error {
  public detail: {
    line: number;
    column: number;
    expression: string;
  } = { expression: "", line: 1, column: 1 };
}

class GenericExpressionError extends Error {
  public detail: {
    line: number;
    column: number;
    expression: string;
  } = { expression: "", line: 1, column: 1 };
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

const extractLocation = (scope: Scope): Location => {
  const lines = scope.buffer.split(/\r?\n/);
  const line = Math.max(1, lines.length);
  const column = Math.max(1, (lines.pop() ?? "").length);

  return { line, column };
};

const hasLocalCapture = (scope: Scope, capture: string): boolean =>
  scope.localCaptures
    .flatMap((captures) => Array.from(captures.values()))
    .includes(capture);

const validateKnownExpressionParser = (
  expression: string,
  location: Location,
  parser: ExpressionParser | undefined,
): ExpressionParser | never => {
  if (parser) {
    return parser;
  }

  const { line, column } = location;

  const error = new UnknownExpressionError(
    `Unknown expression: ${expression} (line: ${line}, column: ${column})`,
  );

  error.detail = { line, column, expression };

  throw error;
};

const validateExpressionMatches = (
  scope: Scope,
  expression: string,
  matches: RegExpMatchArray | null,
): RegExpMatchArray | never => {
  if (matches) {
    return matches;
  }

  const error = new GenericExpressionError(
    `Cannot run expression parser without matches: ${expression}`,
  );

  let { line, column } = extractLocation(scope);
  column -= expression.length;

  error.detail = { line, column, expression };

  throw error;
};

const validateClosingBlock = (
  scope: Scope,
  currentBlock: string,
): void | never => {
  const expectedBlock = scope.blocks.pop() ?? "unknown";

  if (expectedBlock === currentBlock) {
    return;
  }

  let { line, column } = extractLocation(scope);
  column -= currentBlock.length + 2;

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
    const matches = validateExpressionMatches(
      scope,
      expression,
      expression.match(this.match),
    );

    const [, capture, piping] = matches;
    let input = `${capture}`;

    const globalCaptures = [];

    if (piping) {
      const chain = buildHelperChain(input, piping);
      globalCaptures.push(...chain.captures);
      input = chain.output;
    }

    input = `_encode(${input})`;

    const [captureTarget] = capture.split(".");
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
  match: /^{((["']).*?\2)( *\| *[a-z0-9_.]+)+}$/i,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = validateExpressionMatches(
      scope,
      expression,
      expression.match(this.match),
    );

    const [, capture, , piping] = matches;
    let input = `${capture}`;
    const globalCaptures = [];

    if (piping) {
      const chain = buildHelperChain(input, piping);
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
    const matches = validateExpressionMatches(
      scope,
      expression,
      expression.match(this.match),
    );

    const [, capture, piping] = matches;
    let input = `${capture}`;
    const globalCaptures: string[] = [];

    scope.blocks.push("if");

    if (piping) {
      const chain = buildHelperChain(input, piping);
      input = chain.output;
      globalCaptures.push(...chain.captures);
    }

    const [captureTarget] = capture.split(".");
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

const whenExpressionParser = {
  match:
    /^{when ([a-zA-z0-9._]+)=([a-zA-z0-9._]+|'[^\t\r\n']+'|"[^\t\r\n']+")}$/,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = validateExpressionMatches(
      scope,
      expression,
      expression.match(this.match),
    );

    const [, capture, value] = matches;
    const globalCaptures: string[] = [];

    scope.blocks.push("when");

    const [captureTarget] = capture.split(".");
    const isLocalCapture = hasLocalCapture(scope, captureTarget);

    if (!isLocalCapture) {
      globalCaptures.push(captureTarget);
    }

    return {
      output: ` + (${capture} === ${value} ? ( ""`,
      globalCaptures,
      localCaptures: [],
    };
  },
};

const whenClosingExpressionParser = {
  match: /^{\/when}$/,
  process(_expression: string, scope: Scope): ExpressionParserResult {
    validateClosingBlock(scope, "when");

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
    const matches = validateExpressionMatches(
      scope,
      expression,
      expression.match(this.match),
    );

    const [, capture, piping] = matches;
    let input = `${capture}`;
    const globalCaptures: string[] = [];

    scope.blocks.push("unless");

    if (piping) {
      const chain = buildHelperChain(input, piping);
      input = chain.output;
      globalCaptures.push(...chain.captures);
    }

    const [captureTarget] = capture.split(".");
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
    /^{each ([a-zA-z0-9_]+)(?:, *([a-zA-z0-9_]+))? +in +([a-zA-z0-9_.]+)}$/,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = validateExpressionMatches(
      scope,
      expression,
      expression.match(this.match),
    );

    const [, iteratee, index, iterable] = matches;

    scope.blocks.push("each");
    const isLocalCapture = hasLocalCapture(scope, iterable);

    return {
      output: ` + (${iterable}).map((${iteratee}, ${
        index ?? "_index"
      }) => { return ""`,
      globalCaptures: [!isLocalCapture ? iterable : ""].filter(Boolean),
      localCaptures: [isLocalCapture ? iterable : ""].filter(Boolean),
    };
  },
};

const eachDictionaryExpressionParser = {
  match:
    /^{each ([a-zA-z0-9_]+) *=> *([a-zA-z0-9_]+)(?:, *([a-z0-9_]+))? +in +([a-zA-z0-9_.]+)}$/,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = validateExpressionMatches(
      scope,
      expression,
      expression.match(this.match),
    );

    const [, key, value, index, iterable] = matches;

    scope.blocks.push("each");
    const isLocalCapture = hasLocalCapture(scope, iterable);

    return {
      output: ` + (Object.keys(${iterable}).map((_key) => [_key, ${iterable}[_key]])).map(([${key}, ${value}], ${
        index ?? "_index"
      }) => { return ""`,
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

const functionCallExpressionParser = {
  match: /^{([a-z0-9._]+)((?: +[a-z0-9_]+=(?:'.*?'|".*?"|[a-z0-9_.]+))+)}$/i,
  process(expression: string, scope: Scope): ExpressionParserResult {
    const matches = validateExpressionMatches(
      scope,
      expression,
      expression.match(this.match),
    );

    let [, capture, rawAttrs] = matches;
    rawAttrs = rawAttrs.trim();
    const globalCaptures = [];
    const regex = /([a-z0-9_]+)=(".*?"|'.*?'|[a-z0-9_.]+)/i;
    let result = regex.exec(rawAttrs);
    const attrs: string[] = [];

    while (result) {
      const [, key, value] = result;

      attrs.push(key === value ? key : `${key}: ${value}`);

      const isPrimitive =
        value.match(/^\d+|\d+\.\d+$/) ||
        ["true", "false", "null", "undefined"].includes(value);

      if (!isPrimitive && !value.match(/^["']/)) {
        const [valueTarget] = value.split(".");
        const isLocalCapture = hasLocalCapture(scope, valueTarget);

        if (!isLocalCapture) {
          globalCaptures.push(valueTarget);
        }
      }

      rawAttrs = rawAttrs.substring(result[0].length).trim();
      result = regex.exec(rawAttrs);
    }

    const input = `_encode(${capture}({${attrs.join(", ")}}))`;

    const [captureTarget] = capture.split(".");
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

/**
 * List of expression parsers.
 * @type {ExpressionParser[]}
 */
export const expressionParsers: ExpressionParser[] = [
  variableExpressionParser,
  whenExpressionParser,
  whenClosingExpressionParser,
  ifExpressionParser,
  ifClosingExpressionParser,
  unlessExpressionParser,
  unlessClosingExpressionParser,
  eachArrayExpressionParser,
  eachDictionaryExpressionParser,
  eachClosingExpressionParser,
  stringPipingExpressionParser,
  functionCallExpressionParser,
];

const compileExpression = (
  expression: string,
  scope: Scope,
  location: Location,
): ExpressionParserResult => {
  const parser = validateKnownExpressionParser(
    expression,
    location,
    expressionParsers.find((exp) => exp.match.test(expression)),
  );

  return parser.process(expression, scope);
};

/**
 * Convert a template tree generated by `parse` into a function body.
 *
 * @param {string[]} tree The template tree.
 * @return {CompileToStringResult} The result.
 */
export const compileToString = (
  tree: string[],
  { includeEscapeHelper }: { includeEscapeHelper: boolean },
): CompileToStringResult => {
  let fnStr = `""`;

  const scope: Scope = {
    globalCaptures: new Set<string>(),
    localCaptures: [],
    blocks: [],
    buffer: "",
  };

  const localScopes: string[][] = [];

  tree.forEach((node) => {
    const location = extractLocation(scope);
    scope.buffer += node;

    if (node.startsWith("{") && node.endsWith("}")) {
      const {
        output,
        globalCaptures: newGlobalCaptures,
        localCaptures: newLocalCaptures,
        popBlock,
      } = compileExpression(node, scope, location);

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

  const captures = Array.from<string>(scope.globalCaptures.values());

  const output = [
    includeEscapeHelper ? encodeHelper : null,
    `const {${captures.join(", ")}} = context || {};`,
    `return (${fnStr});`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    output,
    captures,
  };
};

// const compileFunctionArguments = () => {};

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
  const { output } = compileToString(parse(template), {
    includeEscapeHelper,
  });

  return `function ${name}(context) { ${output} }`;
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
  const { output, captures } = compileToString(parse(template), {
    includeEscapeHelper,
  });

  try {
    return new Function("context", output);
  } catch (originalError) {
    const error = new InvalidTemplateError(
      "The template generated invalid JavaScript code.",
    );
    error.detail = { template, output, captures };

    throw error;
  }
};
