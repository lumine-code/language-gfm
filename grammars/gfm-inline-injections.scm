; Aggregate the tags belonging to one inline context into one HTML document.
((inline
  (html_tag) @injection.content) @injection.owner
  (#set! injection.language "html")
  (#set! injection.include-children))
