# Changelog

<!--
Prefix your message with one of the following:

- [Added] for new features.
- [Changed] for changes in existing functionality.
- [Deprecated] for soon-to-be removed features.
- [Removed] for now removed features.
- [Fixed] for any bug fixes.
- [Security] in case of vulnerabilities.
-->

## v0.0.8 - 2023-02-04

- [Fixed] Fix helper call with primitives values (`true`, `false`, `null`,
  `undefined`, numbers).
- [Fixed] Fix helper call with multiple arguments.

## v0.0.7 - 2023-01-17

- [Fixed] Just pack a subset of files.

## v0.0.6 - 2023-01-17

- [Changed] Compiled function now respects templates without captures and set
  arguments properly.

## v0.0.5 - 2022-01-11

- [Fixed] Previous release didn't include exported files properly.

## v0.0.4 - 2022-01-11

- [Added] `{when}` blocks, similar to `if(a === b) {}`.

## v0.0.3 - 2022-01-10

- [Added] Support for piping strings into helpers (e.g. `{"hello" | upcase}`).
- [Added] Support for function calls using named parameters (e.g.
  `{i18n path="message.hello" name=user.name}`).

## v0.0.2 - 2022-01-09

- Add `@ts-nocheck` to compiled files.

## v0.0.1 - 2022-01-09

- Initial release.
