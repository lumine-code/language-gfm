const STRUCTURED_LINKS = new Set([
  "inline_link",
  "image",
  "full_reference_link",
  "collapsed_reference_link",
  "shortcut_link",
  "uri_autolink",
  "email_autolink",
  "html_tag",
]);

// Native link captures own destinations, labels and titles. Annotate only the
// surrounding prose, retaining escapes and emphasis within each text fragment.
function contentRanges(node, excludedTypes) {
  const excluded = [];
  const visit = (parent) => {
    for (const child of parent.namedChildren) {
      if (excludedTypes.has(child.type)) excluded.push(child);
      else visit(child);
    }
  };
  visit(node);
  const ranges = [];
  let startIndex = node.startIndex;
  let startPosition = node.startPosition;
  for (const child of excluded) {
    if (child.startIndex > startIndex)
      ranges.push({
        startIndex,
        startPosition,
        endIndex: child.startIndex,
        endPosition: child.startPosition,
      });
    startIndex = child.endIndex;
    startPosition = child.endPosition;
  }
  if (startIndex < node.endIndex)
    ranges.push({
      startIndex,
      startPosition,
      endIndex: node.endIndex,
      endPosition: node.endPosition,
    });
  return ranges;
}

const CONTAINER_PREFIXES = new Set(["block_continuation"]);

module.exports = (grammars) => {
  const subscriptions = [
    grammars.addInjectionPoint("source.gfm.inline", {
      type: "inline",
      language: () => "hyperlink",
      content: (node) => contentRanges(node, STRUCTURED_LINKS),
      includeChildren: true,
      languageScope: null,
    }),
    grammars.addInjectionPoint("source.gfm", {
      type: "latex_block_content",
      language: () => "latex",
      content: (node) => contentRanges(node, CONTAINER_PREFIXES),
      includeChildren: true,
    }),
  ];
  return {
    dispose() {
      for (const subscription of subscriptions.splice(0)) subscription.dispose();
    },
  };
};
