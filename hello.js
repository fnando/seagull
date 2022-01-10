/* eslint-disable */
/* tslint:disable */

const _encode = (unsafe) =>
  String(unsafe).replace(
    /(?![0-9A-Za-z ])[\u0000-\u00FF]/g,
    (c) => "&#" + c.charCodeAt(0).toString().padStart(4, "0") + ";"
  );

module.exports.hello = function hello({name}) { return ("" + "Hello there, " + _encode(name) + ".\n"); }
