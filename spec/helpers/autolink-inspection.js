// This inspection runs beside either parser owner and returns plain data.
exports.snapshot = (context) => {
  const inline = context
    .getLanguageLayers()
    .filter(({ scopeName }) => scopeName === "source.gfm.inline");
  const point = ({ row, column }) => [row, column];
  const nodes = (types) =>
    inline.flatMap(({ rootNode }) =>
      rootNode.descendantsOfType(types).map((node) => ({
        type: node.type,
        text: node.text,
        start: point(node.startPosition),
        end: point(node.endPosition),
      })),
    );
  return {
    hasError:
      context.getRootSyntaxNode().hasError || inline.some(({ rootNode }) => rootNode.hasError),
    bare: nodes(["bare_uri_autolink", "bare_email_autolink"]),
    angle: nodes(["uri_autolink", "email_autolink"]),
    atoms: nodes(["code_span", "html_tag", "inline_link"]),
    annotationRanges: context
      .getLanguageLayers()
      .filter(({ scopeName }) => scopeName === "text.hyperlink")
      .flatMap(({ ranges }) => ranges.map((range) => range.serialize())),
  };
};
