import Prism from "prismjs"

// @lexical/code (inside @mdxeditor/editor) loads prismjs language components
// that read the `Prism` global. The dev server's CJS interop happens to set
// it, but in the production chunk the components can evaluate before the core
// attaches itself, throwing "Prism is not defined" and killing the editor.
// Importing this module before @mdxeditor/editor pins the global first.
;(globalThis as typeof globalThis & { Prism?: typeof Prism }).Prism = Prism
