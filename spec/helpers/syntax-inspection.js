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
