const { Range } = require("lumine");

describe("Markdown link boundaries", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-hyperlink");
    await lumine.packages.activatePackage("language-gfm");
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.gfm"));
  });

  afterEach(() => editor.destroy());

  async function setText(text) {
    editor.setText(text);
    await editor.whenGrammarSettled();
  }

  function rangeFor(text) {
    const source = editor.getText();
    const index = source.indexOf(text);
    expect(index).toBeGreaterThanOrEqual(0);
    const buffer = editor.getBuffer();
    return new Range(
      buffer.positionForCharacterIndex(index),
      buffer.positionForCharacterIndex(index + text.length),
    );
  }

  async function expectLink(text) {
    const range = rangeFor(text);
    for (let index = 0; index < text.length; index++) {
      const position = editor
        .getBuffer()
        .positionForCharacterIndex(
          editor.getBuffer().characterIndexForPosition(range.start) + index,
        );
      expect(
        await editor.bufferRangeForScopeAtPosition(".markup.underline.link", position),
      ).toEqual(range);
    }
    if (range.end.isLessThan(editor.getBuffer().getEndPosition()))
      expect(
        await editor.bufferRangeForScopeAtPosition(".markup.underline.link", range.end),
      ).toBeUndefined();
  }

  for (const [name, source, destination] of [
    [
      "angle destination with spaces",
      '[guide](<https://example.com/my manual.pdf> "Title")',
      "https://example.com/my manual.pdf",
    ],
    [
      "escaped destination",
      String.raw`[guide](https://example.com/a\(b\)?x=1&amp;y=2)`,
      String.raw`https://example.com/a\(b\)?x=1&amp;y=2`,
    ],
    [
      "reference definition",
      '[guide][docs]\n\n[docs]: <https://example.com/my manual.pdf> "Title"',
      "https://example.com/my manual.pdf",
    ],
    ["email autolink", "<hello@example.com>", "hello@example.com"],
    [
      "authored terminal punctuation",
      "[guide](https://example.com/?q=*)",
      "https://example.com/?q=*",
    ],
  ]) {
    it(`scopes exactly the ${name}`, async () => {
      await setText(source);
      await expectLink(destination);
    });
  }

  it("does not annotate competing URLs in labels, image descriptions or titles", async () => {
    const destination = "https://destination.example/manual.pdf";
    await setText(
      `[https://label.example](${destination} "https://title.example")\n` +
        `![https://image-label.example](${destination} "https://image-title.example")`,
    );
    for (const text of [
      "https://label.example",
      "https://title.example",
      "https://image-label.example",
      "https://image-title.example",
    ])
      expect(
        await editor.bufferRangeForScopeAtPosition(".markup.underline.link", rangeFor(text).start),
      ).toBeUndefined();
    await expectLink(destination);
  });

  it("retains prose hyperlinks inside emphasis and code spans with literal escapes", async () => {
    const url = String.raw`https://example.com/?find=\*value`;
    await setText(`**${url}** and \`${url}\``);
    await expectLink(url);
  });

  it("does not join a URL across a structured link", async () => {
    await setText("https://first.example/[guide](https://second.example/)Tail");
    await expectLink("https://first.example/");
    await expectLink("https://second.example/");
    expect(
      await editor.bufferRangeForScopeAtPosition(".markup.underline.link", rangeFor("Tail").start),
    ).toBeUndefined();
  });

  it("rebuilds annotation ownership after an edit and package unload", async () => {
    const url = "https://example.com/manual.pdf";
    await setText(url);
    await expectLink(url);
    editor.setText(`[guide](<${url}>)`);
    await editor.languageMode.atTransactionEnd();
    await expectLink(url);
    await lumine.packages.deactivatePackage("language-gfm");
    await lumine.packages.unloadPackage("language-gfm");
    await lumine.packages.activatePackage("language-gfm");
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.gfm"));
    editor.setText(`**${url}**`);
    await editor.whenGrammarSettled();
    await expectLink(url);
  });
});
