import { compile, decode } from "walrus";

const context = {
  people: [{ name: "John" }, { name: "Jane" }],
  name: "Mary",
  upcase: (input: unknown) =>
    typeof input === "string" ? input.toUpperCase() : "",
  downcase: (input: unknown) =>
    typeof input === "string" ? input.toLowerCase() : "",
  reverse: (input: unknown) =>
    String(input || "")
      .split("")
      .reduce((buffer, char) => [char, ...buffer], [] as string[])
      .join(""),
  emptyList: [],
  isEmpty: (list: unknown[]) => list.length === 0,
  colors: {
    red: "#f00",
    green: "#0f0",
  },
  undef: undefined,
  nulled: null,
  falsy: false,
  truthy: true,
};

describe("walrus", () => {
  test("compiles template with escaping strings", () => {
    const render = compile(`"\n\r\t`);
    expect(render(context)).toEqual(`"\n\r\t`);
  });

  test("compiles variable", () => {
    const render = compile(`Hello there, {name}.`);
    expect(render(context)).toEqual("Hello there, Mary.");
  });

  test("compiles piped variable", () => {
    let render = compile(`{name | upcase}`);
    expect(render(context)).toEqual("MARY");

    render = compile(`{name | upcase | downcase | reverse}`);
    expect(render(context)).toEqual("yram");

    render = compile(`{undef | upcase}`);
    expect(render(context)).toEqual("");

    render = compile(`{nulled | upcase}`);
    expect(render(context)).toEqual("");

    render = compile(`{falsy | upcase}`);
    expect(render(context)).toEqual("");

    render = compile(`{truthy | upcase}`);
    expect(render(context)).toEqual("");
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

  test("escapes values", () => {
    const render = compile(`{text}`);
    const output = decode(render({ text: "<script>alert('pwd');</script>" }));
    expect(output).toEqual("<script>alert('pwd');</script>");
  });

  test("raise error when blocks are closed in wrong order", () => {
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
  });
});
