const inspection = require.resolve("./helpers/strikethrough-inspection");

// The pinned cmark-gfm strikethrough oracle fixes the winning pair when
// different delimiter kinds cross. Each interval includes its delimiters.
const strike = (start, end, width) => ({ type: "strikethrough", start, end, width });
const emphasis = (start, end) => ({ type: "emphasis", start, end, width: 1 });
const strong = (start, end) => ({ type: "strong_emphasis", start, end, width: 2 });
const cases = [
  { name: "a single-tilde pair", source: "~a~", spans: [strike(0, 3, 1)] },
  { name: "a double-tilde pair", source: "~~a~~", spans: [strike(0, 5, 2)] },
  {
    name: "stars close before a crossing double tilde",
    source: "*a ~~b* c~~",
    spans: [emphasis(0, 7)],
  },
  {
    name: "double tildes close before a crossing star",
    source: "~~a *b~~ c*",
    spans: [strike(0, 8, 2)],
  },
  {
    name: "stars close before a crossing single tilde",
    source: "*a ~b* c~",
    spans: [emphasis(0, 6)],
  },
  {
    name: "single tildes close before a crossing star",
    source: "~a *b~ c*",
    spans: [strike(0, 6, 1)],
  },
  {
    name: "double tildes close before a crossing underscore",
    source: "~~a _b~~ c_",
    spans: [strike(0, 8, 2)],
  },
  {
    name: "underscores close before a crossing double tilde",
    source: "_a ~~b_ c~~",
    spans: [emphasis(0, 7)],
  },
  {
    name: "a single pair nested inside a double pair",
    source: "~~a ~b~ c~~",
    spans: [strike(0, 11, 2), strike(4, 7, 1)],
  },
  {
    name: "a double pair nested inside a single pair",
    source: "~a ~~b~~ c~",
    spans: [strike(0, 11, 1), strike(3, 8, 2)],
  },
  {
    name: "a single pair inside strong emphasis",
    source: "**a ~b~ c**",
    spans: [strong(0, 11), strike(4, 7, 1)],
  },
  {
    name: "emphasis inside a single pair",
    source: "~a *b* c~",
    spans: [strike(0, 9, 1), emphasis(3, 6)],
  },
  { name: "a triple run stays literal", source: "prefix ~~~a~~~ suffix", spans: [] },
  { name: "a double opener cannot use a single closer", source: "~~a~", spans: [] },
  { name: "a single opener cannot use a double closer", source: "~a~~", spans: [] },
  { name: "an escaped tilde stays literal", source: "\\~a~", spans: [] },
  { name: "code keeps both widths literal", source: "`~a~ ~~b~~`", spans: [] },
  {
    name: "an HTML attribute keeps tildes literal",
    source: 'A <span title="~a~">x</span>',
    spans: [],
  },
  {
    name: "underscore flanking looks past tildes to a letter",
    source: "_b_~~c",
    spans: [],
  },
  {
    name: "a closing tilde preserves the preceding letter for underscore flanking",
    source: "~a~_b_",
    spans: [strike(0, 3, 1)],
  },
  {
    name: "underscore flanking looks past an invalid tilde run to whitespace",
    source: "_b_~~~ c",
    spans: [emphasis(0, 3)],
  },
  {
    name: "star flanking looks past tildes to whitespace",
    source: "*~ b~*",
    spans: [],
  },
];

function pointAt(source, index) {
  const lines = source.slice(0, index).split("\n");
  return [lines.length - 1, lines.at(-1).length];
}

function expectedSnapshot(source, spans) {
  let offset = 0;
  return {
    hasError: false,
    nodes: spans.map(({ type, start, end, width }) => ({
      type,
      text: source.slice(start, end),
      start: pointAt(source, start),
      end: pointAt(source, end),
      delimiters: [
        [start, start + width],
        [end - width, end],
      ].map(([first, last]) => ({
        text: source.slice(first, last),
        start: pointAt(source, first),
        end: pointAt(source, last),
      })),
    })),
    scopes: source.split("\n").map((line) => {
      const result = Array.from({ length: line.length }, (_, column) => {
        const index = offset + column;
        const scopes = new Set();
        for (const { type, start, end, width } of spans) {
          if (index < start || index >= end) continue;
          const kind = type === "strikethrough" ? "strike" : "emphasis";
          scopes.add(
            type === "strikethrough"
              ? "markup.strike.gfm"
              : type === "emphasis"
                ? "markup.italic.gfm"
                : "markup.bold.gfm",
          );
          if (index < start + width) scopes.add(`punctuation.definition.${kind}.begin.gfm`);
          if (index >= end - width) scopes.add(`punctuation.definition.${kind}.end.gfm`);
        }
        return [...scopes].sort();
      });
      offset += line.length + 1;
      return result;
    }),
  };
}

function replacement(source, next) {
  let start = 0;
  while (start < Math.min(source.length, next.length) && source[start] === next[start]) start++;
  let suffix = 0;
  while (
    suffix < Math.min(source.length, next.length) - start &&
    source.at(-1 - suffix) === next.at(-1 - suffix)
  )
    suffix++;
  return {
    range: [pointAt(source, start), pointAt(source, source.length - suffix)],
    text: next.slice(start, next.length - suffix),
  };
}

describe("GFM single and double strikethrough boundaries", () => {
  let editor;
  const snapshot = (target = editor) => target.analyzeSyntax(inspection, "snapshot");

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-gfm");
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.gfm"));
  });

  afterEach(() => editor?.destroy());

  for (const { name, source, spans } of cases) {
    it(`keeps exact nodes, delimiter widths and scopes for ${name}`, async () => {
      editor.setText(source);
      expect(await editor.whenGrammarSettled()).toBe(true);
      expect(await snapshot()).toEqual(expectedSnapshot(source, spans));
    });
  }

  for (const [name, initial, source, spans] of [
    ["single to double width", cases[0], "~~a~~", [strike(0, 5, 2)]],
    ["closing stars before tildes", cases[2], "*a ~~b~~ c*", [emphasis(0, 11), strike(3, 8, 2)]],
    ["closing tildes before stars", cases[3], "~~a *b* c~~", [strike(0, 11, 2), emphasis(4, 7)]],
    ["swapping nested parent widths", cases[9], "~~a ~b~ c~~", [strike(0, 11, 2), strike(4, 7, 1)]],
  ]) {
    it(`updates the tree and scopes through edits, undo and redo for ${name}`, async () => {
      editor.setText(initial.source);
      expect(await editor.whenGrammarSettled()).toBe(true);
      const before = expectedSnapshot(initial.source, initial.spans);
      expect(await snapshot()).toEqual(before);
      const buffer = editor.getBuffer();
      buffer.clearUndoStack();
      const edit = replacement(initial.source, source);
      buffer.setTextInRange(edit.range, edit.text);
      expect(await editor.whenGrammarSettled()).toBe(true);
      expect(editor.getText()).toBe(source);
      const after = expectedSnapshot(source, spans);
      expect(await snapshot()).toEqual(after);

      const fresh = await lumine.workspace.open();
      try {
        fresh.setGrammar(editor.getGrammar());
        fresh.setText(source);
        expect(await fresh.whenGrammarSettled()).toBe(true);
        expect(await snapshot()).toEqual(await snapshot(fresh));
      } finally {
        fresh.destroy();
      }

      editor.undo();
      expect(await editor.whenGrammarSettled()).toBe(true);
      expect(editor.getText()).toBe(initial.source);
      expect(await snapshot()).toEqual(before);
      editor.redo();
      expect(await editor.whenGrammarSettled()).toBe(true);
      expect(editor.getText()).toBe(source);
      expect(await snapshot()).toEqual(after);
    });
  }
});
