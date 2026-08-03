---
title: Sample
tags: [gfm, fixture]
---

# A GitHub Flavored Markdown sample

Kept idiomatic so it is worth opening in the editor.

## Inline styles

Plain text with *emphasis*, **strong**, ***both***, `inline code`,
~~strikethrough~~, a footnote[^1], and an autolink <https://example.com>.

A [link](https://example.com "with a title"), a [reference link][ref], and an
![image](sample.png).

[ref]: https://example.com/reference
[^1]: The footnote body.

## Lists

- An unordered item
- Another, with a nested list:
  - nested
  - also nested
- [ ] an unchecked task
- [x] a checked task

1. First
2. Second
   1. Nested ordered

Term
: A definition-style continuation.

## Quotes and rules

> A block quote.
>
> > Nested one level deeper.

---

## Code

    An indented code block.

```js
// A fenced block, highlighted by the injected grammar.
const answer = 42;
console.log(`the answer is ${answer}`);
```

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

## Table

| Language | Extension | Bundled |
| :------- | :-------: | ------: |
| Markdown | `.md`     |     yes |
| TOML     | `.toml`   |     yes |

## HTML

<div align="center">
  <strong>Raw HTML passes through.</strong>
</div>
