import fs from "fs";
import { compile, decode } from "seagull";

const context = {
  isEmpty: (list: unknown[]) => list.length === 0,
  upcase: (input: string) => input.toUpperCase(),
  downcase: (input: string) => input.toLowerCase(),
  people: [{ name: "John" }, { name: "Jane" }],
  name: "Mary",
  emptyList: [],
  colors: { red: "#f00", green: "#0f0" },
};

describe("seagull", () => {
  test("compiles reference template", () => {
    expect(() =>
      compile(
        fs.readFileSync("./reference.sea", { encoding: "utf-8" }).toString(),
      ),
    ).not.toThrow();
  });

  test("compiles template with escaping strings", () => {
    const render = compile(`"\n\r\t`);
    expect(render(context)).toEqual(`"\n\r\t`);
  });

  test("compiles variable", () => {
    expect(compile(`{name}`)(context)).toEqual("Mary");
    expect(compile(`{user.name}`)({ user: { name: "Jane" } })).toEqual("Jane");
  });

  test("compiles piped variable", () => {
    let render = compile(`{name | upcase}`);
    expect(render(context)).toEqual("MARY");

    render = compile(`{name | upcase | downcase}`);
    expect(render(context)).toEqual("mary");
  });

  test("compiles each for array", () => {
    const render = compile(`
      {each person in people}
        <p>{person.name}</p>
      {/each}
    `);
    const output = render(context);

    expect(output).toContain("<p>John</p>");
    expect(output).toContain("<p>Jane</p>");
  });

  test("compiles each for array with index", () => {
    const render = compile(
      `{each person, index in people}{index}: {person.name}\n{/each}`,
    );
    const output = render(context);

    expect(output).toContain("0: John\n");
    expect(output).toContain("1: Jane\n");
  });

  test("compiles each for array with named index", () => {
    const render = compile(
      `{each person, position in people}{position}: {person.name}\n{/each}`,
    );
    const output = decode(render(context));

    expect(output).toContain("0: John\n");
    expect(output).toContain("1: Jane\n");
  });

  test("compiles each for dict", () => {
    const render = compile(
      `{each color => hex in colors}{color}: {hex}\n{/each}`,
    );
    const output = decode(render(context));

    expect(output).toContain("red: #f00\n");
    expect(output).toContain("green: #0f0\n");
  });

  test("compiles each for dict with index", () => {
    const render = compile(
      `{each color => hex, index in colors}({index}) {index}: {color} => {hex}\n{/each}`,
    );
    const output = decode(render(context));

    expect(output).toContain("0: red => #f00\n");
    expect(output).toContain("1: green => #0f0\n");
  });

  test("compiles if", () => {
    const render = compile(`{if isReady}Ready!{/if}`);
    expect(render({ isReady: true })).toEqual("Ready!");
    expect(render({ isReady: false })).toEqual("");
  });

  test("compiles if with filters", () => {
    let render = compile(`{if emptyList | isEmpty}Empty!{/if}`);
    expect(render(context)).toEqual("Empty!");

    render = compile(`{if people | isEmpty}Empty!{/if}`);
    expect(render(context)).toEqual("");
  });

  test("compiles unless", () => {
    const render = compile(`{unless isReady}Pending!{/unless}`);
    expect(render({ isReady: true })).toEqual("");
    expect(render({ isReady: false })).toEqual("Pending!");
  });

  test("compiles unless with filters", () => {
    let render = compile(`{unless emptyList | isEmpty}Have items!{/unless}`);
    expect(render(context)).toEqual("");

    render = compile(`{unless people | isEmpty}Have items!{/unless}`);
    expect(render(context)).toEqual("Have items!");
  });

  test("compiles when", () => {
    const render = compile(`
      {when status="ready"}Ready!{/when}
      {when status="pending"}Pending!{/when}
    `);

    let output = render({ status: "ready" });
    expect(output).toContain("Ready!");
    expect(output).not.toContain("Pending!");

    output = render({ status: "pending" });
    expect(output).not.toContain("Ready!");
    expect(output).toContain("Pending!");
  });

  test("escapes values", () => {
    const render = compile(`{text}`);
    const output = render({ text: "<script>alert('pwd');</script>" });

    expect(output).toEqual(
      "&#0060;script&#0062;alert&#0040;&#0039;pwd&#0039;&#0041;" +
        "&#0059;&#0060;&#0047;script&#0062;",
    );
    expect(decode(output)).toEqual("<script>alert('pwd');</script>");
  });

  test("pipes strings into helpers", () => {
    expect(compile(`{"hello" | upcase}`)(context)).toEqual("HELLO");
    expect(compile(`{'hello' | upcase}`)(context)).toEqual("HELLO");
    expect(compile(`{'hello' | upcase | downcase}`)(context)).toEqual("hello");
  });

  test("calls helper passing variable as the value", () => {
    const calls: unknown[] = [];
    const name = "John";
    const fn = (...args: unknown[]) => {
      calls.push(args);
      return "called";
    };

    expect(compile(`{fn name=name}`)({ fn, name })).toEqual("called");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([{ name }]);
  });

  test("calls helper passing property as the value", () => {
    const calls: unknown[] = [];
    const user = { name: "John" };
    const fn = (...args: unknown[]) => {
      calls.push(args);
      return "called";
    };

    expect(compile(`{fn name=user.name}`)({ fn, user })).toEqual("called");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([{ name: user.name }]);
  });

  test("calls helper passing double quoted string as the value", () => {
    const calls: unknown[] = [];
    const fn = (...args: unknown[]) => {
      calls.push(args);
      return "called";
    };

    expect(compile(`{fn name="John"}`)({ fn })).toEqual("called");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([{ name: "John" }]);
  });

  test("raises error when blocks are closed in wrong order", () => {
    expect(() => {
      compile(`
            {if isReady}
              {each person in people}
                <p>{person.name}</p>
              {/if}
            {/each}
          `);
    }).toThrow("Expected {/each}, got {/if} (line: 5, column: 15)");

    expect(() => {
      compile(`
            {unless isReady}
              {each person in people}
                <p>{person.name}</p>
              {/unless}
            {/each}
          `);
    }).toThrow("Expected {/each}, got {/unless} (line: 5, column: 15)");

    expect(() => {
      compile(`
        {each person in people}
          {unless isReady}
            <p>{person.name}</p>
          {/each}
        {/unless}
      `);
    }).toThrow("Expected {/unless}, got {/each} (line: 5, column: 11)");

    expect(() => {
      compile(`
        {each person in people}
          {if isReady}
            <p>{person.name}</p>
          {/each}
        {/if}
      `);
    }).toThrow("Expected {/if}, got {/each} (line: 5, column: 11)");

    expect(() => {
      compile(`
        {each person in people}
          {unless isReady}
            {if isReady}
              <p>{person.name}</p>
            {/unless}
          {/each}
        {/if}
      `);
    }).toThrow("Expected {/if}, got {/unless} (line: 6, column: 13)");

    expect(() => {
      compile(`
        {each person in people}
          {when status="ready"}
            {if isReady}
              <p>{person.name}</p>
            {/when}
          {/each}
        {/if}
      `);
    }).toThrow("Expected {/if}, got {/when} (line: 6, column: 13)");

    expect(() => {
      compile(`
        {each person in people}
          {when status="ready"}
            {if isReady}
              <p>{person.name}</p>
            {/if}
          {/if}
        {/when}
      `);
    }).toThrow("Expected {/when}, got {/if} (line: 7, column: 11)");
  });
});
