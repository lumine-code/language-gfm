exports.snapshot = (context) => {
  const inline = context
    .getLanguageLayers()
    .filter(({ scopeName }) => scopeName === "source.gfm.inline");
  const point = ({ row, column }) => [row, column];
  const nodes = inline.flatMap(({ rootNode }) =>
    rootNode.descendantsOfType(["emphasis", "strong_emphasis", "strikethrough"]).map((node) => ({
      type: node.type,
      text: node.text,
      start: point(node.startPosition),
      end: point(node.endPosition),
      delimiters: node.namedChildren
        .filter(({ type }) => type === "emphasis_delimiter")
        .map((delimiter) => ({
          text: delimiter.text,
          start: point(delimiter.startPosition),
          end: point(delimiter.endPosition),
        })),
    })),
  );
  const scopes = context
    .getText()
    .split("\n")
    .map((line, row) =>
      Array.from({ length: line.length }, (_, column) =>
        [...new Set(context.scopeDescriptorForBufferPosition([row, column]).getScopesArray())]
          .filter(
            (scope) =>
              ["markup.italic.gfm", "markup.bold.gfm", "markup.strike.gfm"].includes(scope) ||
              scope.startsWith("punctuation.definition.emphasis.") ||
              scope.startsWith("punctuation.definition.strike."),
          )
          .sort(),
      ),
    );
  return {
    hasError:
      context.getRootSyntaxNode().hasError || inline.some(({ rootNode }) => rootNode.hasError),
    nodes,
    scopes,
  };
};
