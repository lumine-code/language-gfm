const path = require("path");

const packagePath = (name) => path.resolve(__dirname, "..", "..", name);

describe("GitHub Flavored Markdown tree-sitter grammar", () => {
  let editor;

  const scopesFor = (row, column) =>
    editor.analyzeSyntax(require.resolve("./helpers/syntax-inspection"), "scopes", {
      position: [row, column],
    });

  const root = (types = []) =>
    editor.analyzeSyntax(require.resolve("./helpers/syntax-inspection"), "root", { types });
  const layersFor = (scopeName) =>
    editor.analyzeSyntax(require.resolve("./helpers/syntax-inspection"), "layers", { scopeName });

  const setText = async (text) => {
    editor.setText(text);
    await editor.whenGrammarSettled();
  };

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-gfm");
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.gfm"));
  });

  afterEach(() => editor?.destroy());

  for (const comment of ["<!-->", "<!--->"]) {
    it(`ends the short ${comment} comment before the following heading`, async () => {
      await setText(`${comment}\n\n# Visible heading\n`);
      const syntax = await root(["atx_heading"]);
      expect(syntax.hasError).toBe(false);
      expect(syntax.nodes.atx_heading).toEqual(["# Visible heading\n"]);
      expect(await scopesFor(2, 3)).toContain("markup.heading.heading-1.gfm");
    });
  }

  it("bounds deep scanner state and preserves following headings after an edit", async () => {
    await setText(`${"> ".repeat(1800)}deep\n\n# Visible heading\n`);
    expect((await root()).hasError).toBe(false);
    editor.getBuffer().setTextInRange(
      [
        [2, 2],
        [2, 9],
      ],
      "Updated",
    );
    await editor.whenGrammarSettled();
    const syntax = await root(["atx_heading"]);
    expect(syntax.hasError).toBe(false);
    expect(syntax.nodes.atx_heading).toEqual(["# Updated heading\n"]);
  });

  it("keeps non-ASCII code points out of ordered-list markers", async () => {
    await setText("1\u0661. prose\n\n# Visible heading\n");
    const syntax = await root(["list_item", "atx_heading"]);
    expect(syntax.hasError).toBe(false);
    expect(syntax.nodes.list_item).toEqual([]);
    expect(syntax.nodes.atx_heading.length).toBe(1);
  });

  describe("inline content inside table cells", () => {
    const TABLE = [
      "| `verb` | means |",
      "| ------ | ----- |",
      "| `toggle-focus` | focus *this* surface |",
      "",
    ].join("\n");

    beforeEach(async () => {
      await setText(TABLE);
    });

    it("parses the table without error", async () => {
      expect((await root()).hasError).toBe(false);
    });

    it("highlights a code span in a header cell", async () => {
      expect(await scopesFor(0, 4)).toContain("markup.raw.inline.gfm");
      expect(await scopesFor(0, 2)).toContain(
        "punctuation.definition.begin.string.inline-code.gfm",
      );
    });

    it("highlights a code span in a data cell", async () => {
      expect(await scopesFor(2, 5)).toContain("markup.raw.inline.gfm");
    });

    it("highlights emphasis in a data cell", async () => {
      expect(await scopesFor(2, 26)).toContain("markup.italic.gfm");
    });

    it("keeps the cell scope underneath the inline scopes", async () => {
      expect(await scopesFor(2, 5)).toContain("markup.other.table-cell.data.gfm");
      expect(await scopesFor(0, 4)).toContain("markup.other.table-cell.header.gfm");
    });

    it("leaves the cell separators outside the inline layer", async () => {
      expect(await scopesFor(2, 0)).not.toContain("markup.raw.inline.gfm");
      expect(await scopesFor(2, 17)).not.toContain("markup.raw.inline.gfm");
    });

    it("keeps one inline language layer per cell", async () => {
      const layers = await layersFor("source.gfm.inline");
      expect(layers.length).toBe(4);
    });
  });

  describe("inline content outside tables", () => {
    beforeEach(async () => {
      await setText("A paragraph with `code` and *emphasis*.\n");
    });

    it("still highlights a code span in a paragraph", async () => {
      expect(await scopesFor(0, 18)).toContain("markup.raw.inline.gfm");
    });

    it("still highlights emphasis in a paragraph", async () => {
      expect(await scopesFor(0, 29)).toContain("markup.italic.gfm");
    });

    it("highlights command names with punctuation in a code span", async () => {
      await setText("A paragraph with `title-bar:toggle`.\n");
      expect(await scopesFor(0, 20)).toContain("markup.raw.inline.gfm");
    });
  });

  it("resolves fenced languages and replaces the child parser after an edit", async () => {
    await lumine.packages.activatePackage(packagePath("language-javascript"));
    await lumine.packages.activatePackage(packagePath("language-css"));
    await setText("```JS\nconst value = 1;\n```\n");
    expect(await scopesFor(1, 2)).toContain("source.js");
    const buffer = editor.getBuffer();
    buffer.setTextInRange(
      [
        [0, 3],
        [0, 5],
      ],
      "CSS",
    );
    buffer.setTextInRange(
      [
        [1, 0],
        [1, Infinity],
      ],
      ".card { color: red; }",
    );
    await editor.whenGrammarSettled();
    expect(await scopesFor(1, 2)).toContain("source.css");
    expect(await scopesFor(1, 2)).not.toContain("source.js");
    expect(await layersFor("source.js")).toEqual([]);
  });

  it("aggregates inline HTML tags within each paragraph and skips plain prose", async () => {
    await lumine.packages.activatePackage(packagePath("language-html"));
    await setText("A <b>bold</b> and <i>italic</i>.\n\nAnother <em>tag</em>.\n\nPlain prose.\n");
    const layers = await layersFor("text.html.basic");
    expect(layers.length).toBe(2);
    expect(layers.map((layer) => layer.rangeCount).sort()).toEqual([2, 4]);
    expect(await scopesFor(0, 3)).toContain("entity.name.tag.inline.b.html");
    expect(await scopesFor(0, 19)).toContain("entity.name.tag.inline.i.html");
  });
});
