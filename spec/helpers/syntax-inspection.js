exports.root = (editor, { types = [] } = {}) => {
  const root = editor.getRootSyntaxNode();
  return {
    hasError: root?.hasError ?? null,
    nodes: Object.fromEntries(
      types.map((type) => [type, root?.descendantsOfType(type).map((node) => node.text) ?? []]),
    ),
  };
};

exports.layers = (editor, { scopeName }) =>
  editor
    .getLanguageLayers()
    .filter((layer) => layer.scopeName === scopeName)
    .map((layer) => ({ scopeName: layer.scopeName, rangeCount: layer.ranges.length }));

exports.scopes = (editor, { position }) =>
  editor.scopeDescriptorForBufferPosition(position).getScopesArray();

exports.emphasis = (context) => {
  const inline = context
    .getLanguageLayers()
    .filter(({ scopeName }) => scopeName === "source.gfm.inline");
  const point = ({ row, column }) => [row, column];
  const nodes = inline.flatMap(({ rootNode }) =>
    rootNode.descendantsOfType(["emphasis", "strong_emphasis"]).map((node) => ({
      type: node.type,
      text: node.text,
      start: point(node.startPosition),
      end: point(node.endPosition),
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
              scope === "markup.italic.gfm" ||
              scope === "markup.bold.gfm" ||
              scope.startsWith("punctuation.definition.emphasis."),
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
