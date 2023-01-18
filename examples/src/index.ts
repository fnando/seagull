import { template } from "src/helpers/template";

console.log(template("hello", { firstName: "John" }));
console.log(template("goodbye", { lastName: "Doe" }));
