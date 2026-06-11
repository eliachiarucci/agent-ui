import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor"
import "@mdxeditor/editor/style.css"
import { MARKDOWN_CLASSES } from "@/components/files/file-viewer"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

type NoteMarkdownEditorProps = {
  // Initial content only: MDXEditor manages its own document; changes flow out
  // through onChange. The caller remounts (keys) the editor per note.
  value: string
  onChange: (markdown: string) => void
  autoFocus?: boolean
}

// Notes are markdown, so the WYSIWYG editor reads and writes the same plain
// markdown the agent's note tools and the read-mode renderer use.
export function NoteMarkdownEditor({ value, onChange, autoFocus }: NoteMarkdownEditorProps) {
  const { resolvedTheme } = useTheme()

  return (
    <MDXEditor
      markdown={value}
      onChange={onChange}
      autoFocus={autoFocus}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        thematicBreakPlugin(),
        // Fenced code blocks the agent may have written must parse; CodeMirror
        // renders them editable, falling back to plain text for odd languages.
        codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
        codeMirrorPlugin({
          codeBlockLanguages: {
            "": "Plain text",
            bash: "Bash",
            css: "CSS",
            html: "HTML",
            js: "JavaScript",
            json: "JSON",
            python: "Python",
            ts: "TypeScript",
          },
        }),
        markdownShortcutPlugin(),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <Separator />
              <BlockTypeSelect />
              <BoldItalicUnderlineToggles />
              <CodeToggle />
              <Separator />
              <ListsToggle />
              <Separator />
              <CreateLink />
              <InsertTable />
              <InsertThematicBreak />
            </>
          ),
        }),
      ]}
      // dark-theme flips MDXEditor's own CSS variables to match the app theme.
      className={cn("h-full", resolvedTheme === "dark" && "dark-theme")}
      contentEditableClassName={cn("min-h-40 p-4", MARKDOWN_CLASSES)}
    />
  )
}
