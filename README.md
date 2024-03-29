# @fnando/seagull

[![Tests](https://github.com/fnando/seagull/workflows/node-tests/badge.svg)](https://github.com/fnando/seagull)
[![NPM](https://img.shields.io/npm/v/@fnando/seagull.svg)](https://npmjs.org/package/@fnando/seagull)
[![NPM](https://img.shields.io/npm/dt/@fnando/seagull.svg)](https://npmjs.org/package/@fnando/seagull)

Minimal template engine with compiled output for JavaScript.

## Installation

This package is available as a NPM package. To install it, use the following
command:

```bash
npm install @fnando/seagull --save
```

If you're using Yarn (and you should):

```bash
yarn add @fnando/seagull
```

## Usage

### Syntax Highlighting

- Sublime Text: <https://sublime.fnando.com>

### Precompiling templates

To compile templates into JavaScript, use the CLI:

```console
# You can use either a file path (e.g. src/templates/hello.sea) or a glob
# pattern (e.g. src/**/*.sea) as the input source.
$ seagull compile --input hello.sea --output hello.js

# To export individual files, use a directory path without the `.js` extension.
$ seagull compile --input 'src/**/*.sea' --output 'src/helpers'
```

### Compiling templates in runtime

```js
import { compile } from "@fnando/seagull";

const render = compile("Hello there, {name}.");

render({ name: "John" });
//=> Hello there, John.
```

### Syntax

#### Variables

```seagull
Hello there, {name}.
Hello there, {person.name}.
```

#### Conditionals

```seagull
{if isReady}
  Ready!
{/if}

{unless isReady}
  Pending!
{/unless}

{when status="ready"}Ready!{/when}
{when status='ready'}Ready!{/when}
{when status=readyStatus}Ready!{/when}
{when status=statuses.ready}Ready!{/when}
```

#### Iteration

Iterating arrays:

```seagull
{each person in people}
  Hi there, {person.name}.
{/each}

{each person, index in people}
  {index}: {person.name}
{/each}
```

Iterating dictionaries (objects with key value):

```seagull
{each id => person in peopleMap}
  Hello, {person.name}. Your id is {id}.
{/each}

{each id => person, index in peopleMap}
  {index}: {person.name} ({id})
{/each}
```

#### Helpers

Helpers that receive one single positional argument must be called by pipeling
the parameter into the helper.

```seagull
You're name in reverse is {name | upcase | reverse}.
```

Helpers need to be registered as part of the context when calling the rendering
function. **Seagull doesn't bundle any helpers.**

```js
template({
  name: "John",
  upcase: (input) => input.toUpperCase(),
  reverse: (input) =>
    input
      .split("")
      .reduce((memo, char) => [char].concat(memo), [])
      .join(""),
});
```

The `if` and `unless` blocks also accept helper piping.

```seagull
{if emails | isEmpty}
  You have no mail!
{/if}
```

```js
template({
  emails: [],
  isEmpty: (input) =>
    input &&
    typeof input !== "boolean" &&
    "length" in input &&
    input.length === 0,
});
```

Finally, you can also pipe strings to helpers.

```seagull
{"seagull_is_nice" | i18n}
{'seagull_is_nice' | i18n}
```

If you're function requires multiple parameters, then you can use the named
parameter call.

```seagull
{i18n path="messages.hello" name=user.name}
```

This will translate to a call like
`i18n({path: "message.hello", name: user.name})`.

#### HTML Escaping

All interpolations are escaped by default. If you need to decode the output for
tests, you can import the `decode` function.

```js
import { compile, decode } from "@fnando/seagull";

test("renders template", () => {
  const template = compile(`{message}`);
  const output = template({ message: "<script>alert(1);</script>" });

  expect(output).toEqual(
    "&#0060;script&#0062;alert&#0040;1&#0041;&#0059;&#0060;&#0047;script&#0062;",
  );
  expect(decode(output)).toEqual("<script>alert(1);</script>");
});
```

### Using TypeScript

Seagull doesn't have direct TypeScript support, but that doesn't mean you can't
use typed template functions.

The way I like to do it is by creating a file called `templates.d.ts` somewhere
(e.g. if I export the templates to `src/helpers/templates.js`, then I use
`src/helpers/templates.d.ts`). This file will hold all function types.

Let's say I have a template function that works like `hello({name: "John"})`; in
this case, my module declaration would look like this:

```typescript
declare module "src/helpers/templates" {
  export function hello(params: { firstName: string }): string;
  export function goodbye(params: { lastName: string }): string;
}
```

If you're using helpers, tem you can also type an intermediary `template`
function.

```typescript
import * as templates from "src/helpers/templates";

// Add your helpers here
// You don't have to inline them (e.g. use `const helpers = {helper}` instead).
const helpers = {};

export function template<
  T extends keyof typeof templates,
  P = Parameters<typeof templates[T]>[0],
>(name: T, params: P): string {
  // @ts-expect-error injecting helpers
  return templates[name]({ ...params, ...helpers });
}
```

To call the templates using this function:

```typescript
import { template } from "src/helpers/template;

console.log(template("hello", {firstName: "John"}));
console.log(template("goodbye", {lastName: "Doe"}));
```

## Maintainer

- [Nando Vieira](https://github.com/fnando)

## Contributors

- <https://github.com/fnando/seagull/contributors>

## Contributing

For more details about how to contribute, please read
<https://github.com/fnando/seagull/blob/main/CONTRIBUTING.md>.

## License

The gem is available as open source under the terms of the
[MIT License](https://opensource.org/licenses/MIT). A copy of the license can be
found at <https://github.com/fnando/seagull/blob/main/LICENSE.md>.

## Code of Conduct

Everyone interacting in the seagull project's codebases, issue trackers, chat
rooms and mailing lists is expected to follow the
[code of conduct](https://github.com/fnando/seagull/blob/main/CODE_OF_CONDUCT.md).
