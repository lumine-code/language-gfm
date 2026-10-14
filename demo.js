// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: [],
  viewport: { width: 1100, height: 820 },
  async before() {},
  async prepare(context) {
    const { lumine, state, open } = context;
    state.editor = await open("example.md");

    if (!lumine.grammars.assignLanguageMode(state.editor.getBuffer(), "source.gfm"))
      throw new Error("Grammar unavailable");
    await state.editor.getBuffer().getLanguageMode().ready;
    await state.editor.getBuffer().getLanguageMode().atGrammarSettlement?.();
    if (state.editor.getGrammar().scopeName !== "source.gfm") throw new Error("Wrong grammar");
    state.editor.setCursorBufferPosition([0, 0]);
    state.editor.scrollToBufferPosition([0, 0]);
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "GitHub Markdown syntax highlighting at the default editor font size.",
      timeout: 60000,
      async run() {
        {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      },
      ready(context) {
        const { state } = context;
        return Boolean(
          state.editor.getBuffer().getLanguageMode() &&
          state.editor.getElement().getBoundingClientRect().height > 0,
        );
      },
    },
  ],
  async cleanup() {},
};
