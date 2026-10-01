; Aggregate the tags belonging to one inline context into one HTML document.
((inline
  (html_tag) @injection.content) @injection.owner
  (#set! injection.language "html")
  (#set! injection.include-children))

((inline) @injection.owner @injection.content
  (#set! injection.language "hyperlink")
  (#set! injection.language-scope "none")
  (#set! injection.include-children))
