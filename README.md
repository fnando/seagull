# @fnando/walrus

[![Tests](https://github.com/fnando/walrus/workflows/node-tests/badge.svg)](https://github.com/fnando/walrus)
[![Code Climate](https://codeclimate.com/github/fnando/walrus/badges/gpa.svg)](https://codeclimate.com/github/fnando/walrus)
[![NPM](https://img.shields.io/npm/v/walrus.svg)](https://npmjs.org/packages/walrus)
[![NPM](https://img.shields.io/npm/dt/walrus.svg)](https://npmjs.org/packages/walrus)

Minimal template engine with compiled output for JavaScript.

## Installation

This package is available as a NPM package. To install it, use the following
command:

```bash
npm install @fnando/walrus --save
```

If you're using Yarn (and you should):

```bash
yarn add @fnando/walrus
```

## Usage

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
function. Walrus doesn't bundle any helpers.

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
import { compile, decode } from "@fnando/walrus";

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

- https://github.com/fnando/walrus/contributors

## Contributing

For more details about how to contribute, please read
https://github.com/fnando/walrus/blob/main/CONTRIBUTING.md.

## License

The gem is available as open source under the terms of the
[MIT License](https://opensource.org/licenses/MIT). A copy of the license can be
found at https://github.com/fnando/walrus/blob/main/LICENSE.md.

## Code of Conduct

Everyone interacting in the walrus project's codebases, issue trackers, chat
rooms and mailing lists is expected to follow the
[code of conduct](https://github.com/fnando/walrus/blob/main/CODE_OF_CONDUCT.md).
