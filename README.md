# @fnando/seagull

[![Tests](https://github.com/fnando/seagull/workflows/node-tests/badge.svg)](https://github.com/fnando/seagull)
[![Code Climate](https://codeclimate.com/github/fnando/seagull/badges/gpa.svg)](https://codeclimate.com/github/fnando/seagull)
[![NPM](https://img.shields.io/npm/v/@fnando/seagull.svg)](https://npmjs.org/packages/@fnando/seagull)
[![NPM](https://img.shields.io/npm/dt/@fnando/seagull.svg)](https://npmjs.org/packages/@fnando/seagull)

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

```
Hello there, {name}.
Hello there, {person.name}.
```

#### Conditionals

```
{if isReady}
  Ready!
{/if}

{unless isReady}
  Pending!
{/unless}
```

#### Iteration

Iterating arrays:

```
{each person in people}
  Hi there, {person.name}.
{/each}

{each person, index in people}
  {index}: {person.name}
{/each}
```

Iterating dictionaries (objects with key value):

```
{each id => person in peopleMap}
  Hello, {person.name}. Your id is {id}.
{/each}

{each id => person, index in peopleMap}
  {index}: {person.name} ({id})
{/each}
```

#### Helpers

```
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

```
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

## Maintainer

- [Nando Vieira](https://github.com/fnando)

## Contributors

- https://github.com/fnando/seagull/contributors

## Contributing

For more details about how to contribute, please read
https://github.com/fnando/seagull/blob/main/CONTRIBUTING.md.

## License

The gem is available as open source under the terms of the
[MIT License](https://opensource.org/licenses/MIT). A copy of the license can be
found at https://github.com/fnando/seagull/blob/main/LICENSE.md.

## Code of Conduct

Everyone interacting in the seagull project's codebases, issue trackers, chat
rooms and mailing lists is expected to follow the
[code of conduct](https://github.com/fnando/seagull/blob/main/CODE_OF_CONDUCT.md).
