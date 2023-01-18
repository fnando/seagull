/* eslint-disable */
// @ts-nocheck

const _encode = (unsafe) =>
  String(unsafe).replace(
    /(?![0-9A-Za-z ])[\u0000-\u00FF]/g,
    (c) => "&#" + c.charCodeAt(0).toString().padStart(4, "0") + ";"
  );

module.exports.goodbye = function goodbye({lastName}) { return ("" + "<p>Goodbye, Mr " + _encode(lastName) + "!</p>\n"); }

module.exports.hello = function hello({name}) { return ("" + "<p>Hello there, " + _encode(name) + "!</p>\n"); }
