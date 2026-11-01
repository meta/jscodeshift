---
"jscodeshift": patch
---

Accept the source as a plain string in `applyTransform`

The README shows `applyTransform(transform, options, 'input')`, but the helper
passed the string straight to the transform as the file object, so transforms
that read `file.source` threw. A string input is now wrapped in
`{source: input}`.
