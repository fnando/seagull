declare module "src/helpers/templates" {
  export function hello(params: { firstName: string }): string;
  export function goodbye(params: { lastName: string }): string;
}
