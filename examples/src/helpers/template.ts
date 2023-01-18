import * as templates from "src/helpers/templates";

const helpers = {};

export function template<
  T extends keyof typeof templates,
  P = Parameters<typeof templates[T]>[0],
>(name: T, params: P): string {
  // @ts-expect-error injecting helpers
  return templates[name]({ ...params, ...helpers });
}
