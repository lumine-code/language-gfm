((minus_metadata) @injection.owner @injection.content
  (#set! injection.language "yaml"))

((inline) @injection.owner @injection.content
  (#set! injection.language "markdown-inline-internal")
  (#set! injection.include-children)
  (#set! injection.language-scope "none"))

; Each cell is an independent inline context. Delimiters cannot cross cells.
((pipe_table_cell) @injection.owner @injection.content
  (#set! injection.language "markdown-inline-internal")
  (#set! injection.include-children)
  (#set! injection.language-scope "none"))

((html_block) @injection.owner @injection.content
  (#set! injection.language "html")
  (#set! injection.include-children))

((fenced_code_block
  (info_string (language) @injection.language)
  (code_fence_content) @injection.content) @injection.owner
  (#set! injection.include-children))
