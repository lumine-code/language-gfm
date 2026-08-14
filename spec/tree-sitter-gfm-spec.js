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
    lumine.config.set("language.useTreeSitterParsers", true);
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

    it("parses the table without error", () => {
      expect(languageMode.tree.rootNode.hasError).toBe(false);
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
  });
});
