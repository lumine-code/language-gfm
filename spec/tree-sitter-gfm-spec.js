const path = require("path");

const packagePath = (name) => path.resolve(__dirname, "..", "..", name);

describe("GitHub Flavored Markdown tree-sitter grammar", () => {
  let editor, languageMode;

  const scopesFor = (row, column) =>
    editor.scopeDescriptorForBufferPosition([row, column]).getScopesArray();

  const setText = async (text) => {
    editor.setText(text);
    languageMode = editor.getBuffer().getLanguageMode();
    await languageMode.ready;
    await languageMode.atTransactionEnd();
  };

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-gfm");
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.gfm"));
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
      expect(editor.languageMode.tree.rootNode.hasError).toBe(false);
    });

    it("highlights a code span in a header cell", () => {
      expect(scopesFor(0, 4)).toContain("markup.raw.inline.gfm");
      expect(scopesFor(0, 2)).toContain("punctuation.definition.begin.string.inline-code.gfm");
    });

    it("highlights a code span in a data cell", () => {
      expect(scopesFor(2, 5)).toContain("markup.raw.inline.gfm");
    });

    it("highlights emphasis in a data cell", () => {
      expect(scopesFor(2, 26)).toContain("markup.italic.gfm");
    });

    it("keeps the cell scope underneath the inline scopes", () => {
      expect(scopesFor(2, 5)).toContain("markup.other.table-cell.data.gfm");
      expect(scopesFor(0, 4)).toContain("markup.other.table-cell.header.gfm");
    });

    it("leaves the cell separators outside the inline layer", () => {
      expect(scopesFor(2, 0)).not.toContain("markup.raw.inline.gfm");
      expect(scopesFor(2, 17)).not.toContain("markup.raw.inline.gfm");
    });

    it("keeps one inline language layer per cell", () => {
      const layers = languageMode
        .getAllInjectionLayers()
        .filter((layer) => layer.grammar.scopeName === "source.gfm.inline");
      expect(layers.length).toBe(4);
    });
  });

  describe("inline content outside tables", () => {
    beforeEach(async () => {
      await setText("A paragraph with `code` and *emphasis*.\n");
    });

    it("still highlights a code span in a paragraph", () => {
      expect(scopesFor(0, 18)).toContain("markup.raw.inline.gfm");
    });

    it("still highlights emphasis in a paragraph", () => {
      expect(scopesFor(0, 29)).toContain("markup.italic.gfm");
    });

    it("highlights command names with punctuation in a code span", async () => {
      await setText("A paragraph with `title-bar:toggle`.\n");
      expect(scopesFor(0, 20)).toContain("markup.raw.inline.gfm");
    });
  });

  it("resolves fenced languages and replaces the child parser after an edit", async () => {
    await lumine.packages.activatePackage(packagePath("language-javascript"));
    await lumine.packages.activatePackage(packagePath("language-css"));
    await setText("```JS\nconst value = 1;\n```\n");
    expect(scopesFor(1, 2)).toContain("source.js");
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
    await languageMode.atTransactionEnd();
    expect(scopesFor(1, 2)).toContain("source.css");
    expect(scopesFor(1, 2)).not.toContain("source.js");
    expect(
      languageMode
        .getAllInjectionLayers()
        .filter((layer) => layer.grammar.scopeName === "source.js"),
    ).toEqual([]);
  });

  it("aggregates inline HTML tags within each paragraph and skips plain prose", async () => {
    await lumine.packages.activatePackage(packagePath("language-html"));
    await setText("A <b>bold</b> and <i>italic</i>.\n\nAnother <em>tag</em>.\n\nPlain prose.\n");
    const layers = languageMode
      .getAllInjectionLayers()
      .filter((layer) => layer.grammar.scopeName === "text.html.basic");
    expect(layers.length).toBe(2);
    expect(layers.map((layer) => layer.getCurrentRanges().length).sort()).toEqual([2, 4]);
    expect(scopesFor(0, 3)).toContain("entity.name.tag.inline.b.html");
    expect(scopesFor(0, 19)).toContain("entity.name.tag.inline.i.html");
  });
});
