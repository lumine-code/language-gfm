const inspection = require.resolve("./helpers/syntax-inspection");

// Offsets are UTF-16 buffer indices. Each expected span includes its delimiters;
// the per-character expectations also distinguish punctuation from literal runs.
const span = (type, start, end, width = type === "strong_emphasis" ? 2 : 1) => ({
  type,
  start,
  end,
  width,
});
const emphasis = (start, end) => span("emphasis", start, end);
const strong = (start, end) => span("strong_emphasis", start, end);

const cases = [
  { name: "GFM 400: whitespace before a closing star run", source: "**foo bar **", spans: [] },
  { name: "GFM 401: punctuation before a non-closing star run", source: "**(**foo)", spans: [] },
  {
    name: "GFM 406: whitespace before a closing underscore run",
    source: "__foo bar __",
    spans: [],
  },
  {
    name: "GFM 421: a dual-purpose middle run remains literal",
    source: "*foo**bar*",
    spans: [emphasis(0, 10)],
  },
  {
    name: "nested star strong emphasis",
    source: "*foo **bar** baz*",
    spans: [emphasis(0, 17), strong(5, 12)],
  },
  {
    name: "nested underscore strong emphasis",
    source: "_foo __bar__ baz_",
    spans: [emphasis(0, 17), strong(5, 12)],
  },
  {
    name: "mixed underscore strong inside star emphasis",
    source: "*foo __bar__ baz*",
    spans: [emphasis(0, 17), strong(5, 12)],
  },
  {
    name: "mixed star strong inside underscore emphasis",
    source: "_foo **bar** baz_",
    spans: [emphasis(0, 17), strong(5, 12)],
  },
  {
    name: "triple stars share nested delimiters",
    source: "***foo***",
    spans: [emphasis(0, 9), strong(1, 8)],
  },
  {
    name: "triple underscores share nested delimiters",
    source: "___foo___",
    spans: [emphasis(0, 9), strong(1, 8)],
  },
  {
    name: "the rule of three preserves an inner strong pair",
    source: "*foo**bar**baz*",
    spans: [emphasis(0, 15), strong(4, 11)],
  },
  {
    name: "matching triples allow intraword star nesting",
    source: "foo***bar***baz",
    spans: [emphasis(3, 12), strong(4, 11)],
  },
  {
    name: "surplus closing stars stay outside emphasis",
    source: "*foo**",
    spans: [emphasis(0, 5)],
  },
  {
    name: "surplus opening stars stay outside emphasis",
    source: "**foo*",
    spans: [emphasis(1, 6)],
  },
  {
    name: "surplus opening stars stay outside strong emphasis",
    source: "***foo**",
    spans: [strong(1, 8)],
  },
  { name: "Unicode punctuation flanks emphasis", source: "«_λ_»", spans: [emphasis(1, 4)] },
  { name: "Unicode punctuation flanks strong emphasis", source: "«__λ__»", spans: [strong(1, 6)] },
  { name: "intraword Unicode underscores stay literal", source: "α_β_γ", spans: [] },
  { name: "intraword Unicode stars can emphasize", source: "α*β*γ", spans: [emphasis(1, 4)] },
  { name: "a nonbreaking space prevents opening", source: "*\u00a0foo*", spans: [] },
  { name: "an em space prevents closing", source: "*foo\u2003*", spans: [] },
  {
    name: "Greek letters and digits close underscore emphasis",
    source: "_λ1_",
    spans: [emphasis(0, 4)],
  },
  {
    name: "Greek letters and digits close underscore strong",
    source: "__λ1__",
    spans: [strong(0, 6)],
  },
  { name: "a code span keeps its stars literal", source: "`*foo*`", spans: [] },
  { name: "an escaped star cannot open emphasis", source: "\\*foo*", spans: [] },
  {
    name: "emphasis continues across a soft line break",
    source: "*foo\nbar*",
    spans: [emphasis(0, 9)],
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
    nodes: spans.map(({ type, start, end }) => ({
      type,
      text: source.slice(start, end),
      start: pointAt(source, start),
      end: pointAt(source, end),
    })),
    scopes: source.split("\n").map((line) => {
      const row = Array.from({ length: line.length }, (_, column) => {
        const index = offset + column;
        const scopes = new Set();
        for (const { type, start, end, width } of spans) {
          if (index < start || index >= end) continue;
          scopes.add(type === "emphasis" ? "markup.italic.gfm" : "markup.bold.gfm");
          if (index < start + width) scopes.add("punctuation.definition.emphasis.begin.gfm");
          if (index >= end - width) scopes.add("punctuation.definition.emphasis.end.gfm");
        }
        return [...scopes].sort();
      });
      offset += line.length + 1;
      return row;
    }),
  };
}

describe("GFM emphasis and strong emphasis boundaries", () => {
  let editor;
  const snapshot = (target = editor) => target.analyzeSyntax(inspection, "emphasis");

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-gfm");
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.gfm"));
  });

  afterEach(() => editor?.destroy());

  for (const { name, source, spans } of cases) {
    it(`keeps exact node ranges and scopes for ${name}`, async () => {
      editor.setText(source);
      expect(await editor.whenGrammarSettled()).toBe(true);
      expect(await snapshot()).toEqual(expectedSnapshot(source, spans));
    });
  }

  for (const change of [
    {
      initial: cases[0],
      start: 9,
      end: 10,
      text: "",
      source: "**foo bar**",
      spans: [strong(0, 11)],
    },
    {
      initial: cases[1],
      start: 3,
      end: 9,
      text: "foo)**",
      source: "**(foo)**",
      spans: [strong(0, 9)],
    },
    {
      initial: cases[2],
      start: 9,
      end: 10,
      text: "",
      source: "__foo bar__",
      spans: [strong(0, 11)],
    },
    {
      initial: cases[3],
      start: 4,
      end: 6,
      text: "*",
      source: "*foo*bar*",
      spans: [emphasis(0, 5)],
    },
  ]) {
    it(`updates exact scopes and restores them on undo for ${change.initial.name}`, async () => {
      const { initial, start, end, text, source, spans } = change;
      editor.setText(initial.source);
      expect(await editor.whenGrammarSettled()).toBe(true);
      const before = expectedSnapshot(initial.source, initial.spans);
      expect(await snapshot()).toEqual(before);
      const buffer = editor.getBuffer();
      buffer.clearUndoStack();
      buffer.setTextInRange([pointAt(initial.source, start), pointAt(initial.source, end)], text);
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
