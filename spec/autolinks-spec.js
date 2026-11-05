const { Range } = require("lumine");
const inspection = require.resolve("./helpers/autolink-inspection");
const syntaxInspection = require.resolve("./helpers/syntax-inspection");

describe("Native GFM bare autolinks", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-hyperlink");
    await lumine.packages.activatePackage("language-gfm");
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.gfm"));
  });

  afterEach(() => editor?.destroy());

  const snapshot = (target = editor) => target.analyzeSyntax(inspection, "snapshot");
  const scopesAt = (position) => editor.analyzeSyntax(syntaxInspection, "scopes", { position });

  async function setText(source) {
    editor.setText(source);
    expect(await editor.whenGrammarSettled()).toBe(true);
  }

  function rangeFor(text) {
    const index = editor.getText().indexOf(text);
    expect(index).toBeGreaterThanOrEqual(0);
    const buffer = editor.getBuffer();
    return new Range(
      buffer.positionForCharacterIndex(index),
      buffer.positionForCharacterIndex(index + text.length),
    );
  }

  async function expectLink(text) {
    const range = rangeFor(text);
    const buffer = editor.getBuffer();
    const start = buffer.characterIndexForPosition(range.start);
    for (let index = 0; index < text.length; index++) {
      const position = buffer.positionForCharacterIndex(start + index);
      expect(
        await editor.bufferRangeForScopeAtPosition(".markup.underline.link", position),
      ).toEqual(range);
      expect(await scopesAt(position)).toContain("markup.underline.link.gfm");
    }
    if (range.end.isLessThan(buffer.getEndPosition()))
      expect(await scopesAt(range.end)).not.toContain("markup.underline.link.gfm");
    return range;
  }

  async function expectNativeLink(type, text) {
    const range = await expectLink(text);
    const syntax = await snapshot();
    expect(syntax.hasError).toBe(false);
    expect(syntax.bare).toContain({
      type,
      text,
      start: range.start.toArray(),
      end: range.end.toArray(),
    });
    // The native capture owns every character. The prose annotation grammar
    // must not produce a competing or differently trimmed range over it.
    for (const annotation of syntax.annotationRanges)
      expect(new Range(...annotation).intersectsWith(range, true)).toBe(false);
    return syntax;
  }

  for (const [name, source, type, text] of [
    [
      "HTTP URL with its first and last characters",
      "Visit https://example.com/path.",
      "bare_uri_autolink",
      "https://example.com/path",
    ],
    [
      "www URL surrounded by parentheses",
      "Visit (www.example.com/path).",
      "bare_uri_autolink",
      "www.example.com/path",
    ],
    [
      "email address",
      "Contact local+tag@example.com.",
      "bare_email_autolink",
      "local+tag@example.com",
    ],
    [
      "mailto protocol",
      "mailto:local@example.com",
      "bare_email_autolink",
      "mailto:local@example.com",
    ],
    [
      "XMPP resource",
      "xmpp:local@example.com/resource@host.com/path",
      "bare_email_autolink",
      "xmpp:local@example.com/resource@host.com",
    ],
    [
      "URL inside emphasis",
      "*https://example.com/a(b)*",
      "bare_uri_autolink",
      "https://example.com/a(b)",
    ],
  ]) {
    it(`highlights the complete native ${name}`, async () => {
      await setText(source);
      await expectNativeLink(type, text);
    });
  }

  it("preserves existing angle-autolink delimiter boundaries", async () => {
    await setText("<https://example.com/path> <local@example.com>");
    const syntax = await snapshot();
    expect(syntax.hasError).toBe(false);
    expect(syntax.bare).toEqual([]);
    expect(syntax.angle.map(({ type }) => type)).toEqual(["uri_autolink", "email_autolink"]);
    await expectLink("https://example.com/path");
    await expectLink("local@example.com");
    const source = editor.getText();
    for (let column = 0; column < source.length; column++) {
      if (source[column] === "<" || source[column] === ">")
        expect(await scopesAt([0, column])).not.toContain("markup.underline.link.gfm");
    }
  });

  it("keeps a quoted URL in code opaque to native autolinking", async () => {
    const url = "https://code.example/p*literal*";
    await setText(`A \`"${url}"\` span.`);
    const syntax = await snapshot();
    expect(syntax.hasError).toBe(false);
    expect(syntax.bare).toEqual([]);
    expect(syntax.atoms.some(({ type }) => type === "code_span")).toBe(true);
    const position = rangeFor(url).start;
    expect(await scopesAt(position)).toContain("markup.raw.inline.gfm");
    expect(await scopesAt(position)).not.toContain("markup.underline.link.gfm");
    expect(await scopesAt(position)).not.toContain("markup.italic.gfm");
  });

  it("keeps a quoted HTML attribute under its HTML parser owner", async () => {
    await lumine.packages.activatePackage("language-html");
    const url = "https://attribute.example/p*literal*";
    await setText(`A <span title="${url}">text</span>.`);
    const syntax = await snapshot();
    expect(syntax.hasError).toBe(false);
    expect(syntax.bare).toEqual([]);
    expect(syntax.atoms.some(({ type }) => type === "html_tag")).toBe(true);
    const scopes = await scopesAt(rangeFor(url).start);
    expect(scopes.some((scope) => scope.startsWith("string.quoted."))).toBe(true);
    expect(scopes).not.toContain("markup.underline.link.gfm");
    expect(scopes).not.toContain("markup.italic.gfm");
  });

  it("retains authored destinations rather than creating nested bare-link owners", async () => {
    const destination = "https://target.example/path*";
    await setText(`[guide](${destination})`);
    const syntax = await snapshot();
    expect(syntax.hasError).toBe(false);
    expect(syntax.bare).toEqual([]);
    expect(syntax.atoms.some(({ type }) => type === "inline_link")).toBe(true);
    await expectLink(destination);
  });

  it("updates native link ranges after edits and restores them through undo and redo", async () => {
    const initial = "www.example.com/path.";
    await setText(initial);
    await expectNativeLink("bare_uri_autolink", "www.example.com/path");
    const before = await snapshot();
    const buffer = editor.getBuffer();
    buffer.clearUndoStack();
    const next = "local+tag@example.com.";
    buffer.setTextInRange(buffer.getRange(), next);
    expect(await editor.whenGrammarSettled()).toBe(true);
    await expectNativeLink("bare_email_autolink", "local+tag@example.com");
    const after = await snapshot();

    const fresh = await lumine.workspace.open();
    try {
      fresh.setGrammar(editor.getGrammar());
      fresh.setText(next);
      expect(await fresh.whenGrammarSettled()).toBe(true);
      expect(after).toEqual(await snapshot(fresh));
    } finally {
      fresh.destroy();
    }

    editor.undo();
    expect(await editor.whenGrammarSettled()).toBe(true);
    expect(editor.getText()).toBe(initial);
    expect(await snapshot()).toEqual(before);
    await expectNativeLink("bare_uri_autolink", "www.example.com/path");
    editor.redo();
    expect(await editor.whenGrammarSettled()).toBe(true);
    expect(await snapshot()).toEqual(after);
    await expectNativeLink("bare_email_autolink", "local+tag@example.com");
  });
});
