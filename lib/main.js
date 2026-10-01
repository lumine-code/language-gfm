exports.consumeHyperlinkInjection = (hyperlink) => {
  return hyperlink.addInjectionPoint("source.gfm.inline", {
    types: ["inline"],
    content: (node) => node,
    includeChildren: true,
  });
};
