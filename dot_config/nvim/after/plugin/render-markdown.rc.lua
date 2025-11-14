local status, render_markdown = pcall(require, "render-markdown")
if not status then return end

render_markdown.setup({
  -- Enable the plugin
  enabled = true,

  -- Maximum file size in MB to render
  max_file_size = 10.0,

  -- Debounce time in milliseconds for rendering updates
  debounce = 100,

  -- Modes in which to show rendered markdown (normal, command, terminal)
  -- Insert and visual modes will show raw markdown for easier editing
  render_modes = { 'n', 'c', 't' },

  -- File types to enable rendering for
  file_types = { 'markdown' },

  -- Heading configuration
  heading = {
    enabled = true,
    -- Icons for different heading levels (H1-H6)
    icons = { '󰲡 ', '󰲣 ', '󰲥 ', '󰲧 ', '󰲩 ', '󰲫 ' },
    -- Highlight groups for heading backgrounds
    backgrounds = {
      'RenderMarkdownH1Bg',
      'RenderMarkdownH2Bg',
      'RenderMarkdownH3Bg',
      'RenderMarkdownH4Bg',
      'RenderMarkdownH5Bg',
      'RenderMarkdownH6Bg',
    },
    -- Highlight groups for heading foregrounds
    foregrounds = {
      'RenderMarkdownH1',
      'RenderMarkdownH2',
      'RenderMarkdownH3',
      'RenderMarkdownH4',
      'RenderMarkdownH5',
      'RenderMarkdownH6',
    },
  },

  -- Code block configuration
  code = {
    enabled = true,
    -- Style options: 'full', 'normal', 'language', 'none'
    -- 'full' shows background and language indicator
    style = 'full',
    left_pad = 2,
    right_pad = 2,
    -- Highlight group for code block background
    highlight = 'RenderMarkdownCode',
  },

  -- Inline code configuration
  code_inline = {
    enabled = true,
    highlight = 'RenderMarkdownCodeInline',
  },

  -- Bullet list configuration
  bullet = {
    enabled = true,
    -- Icons for different list levels
    icons = { '●', '○', '◆', '◇' },
    -- Ordered list icons
    ordered_icons = {},
    -- Highlight group for bullets
    highlight = 'RenderMarkdownBullet',
  },

  -- Checkbox configuration
  checkbox = {
    enabled = true,
    unchecked = {
      icon = '󰄱 ',
      highlight = 'RenderMarkdownUnchecked',
    },
    checked = {
      icon = '󰱒 ',
      highlight = 'RenderMarkdownChecked',
    },
    -- Custom state for partially completed tasks
    custom = {
      todo = { raw = '[-]', rendered = '󰥔 ', highlight = 'RenderMarkdownTodo' },
    },
  },

  -- Blockquote configuration
  quote = {
    enabled = true,
    icon = '▋',
    highlight = 'RenderMarkdownQuote',
  },

  -- Table configuration
  pipe_table = {
    enabled = true,
    style = 'full',
    cell = 'padded',
    border = {
      '┌', '┬', '┐',
      '├', '┼', '┤',
      '└', '┴', '┘',
      '│', '─',
    },
    head = 'RenderMarkdownTableHead',
    row = 'RenderMarkdownTableRow',
  },

  -- Callout configuration (GitHub/Obsidian style)
  callout = {
    note = { raw = '[!NOTE]', rendered = '󰋽 Note', highlight = 'RenderMarkdownInfo' },
    tip = { raw = '[!TIP]', rendered = '󰌶 Tip', highlight = 'RenderMarkdownSuccess' },
    important = { raw = '[!IMPORTANT]', rendered = '󰅾 Important', highlight = 'RenderMarkdownHint' },
    warning = { raw = '[!WARNING]', rendered = '󰀪 Warning', highlight = 'RenderMarkdownWarn' },
    caution = { raw = '[!CAUTION]', rendered = '󰳦 Caution', highlight = 'RenderMarkdownError' },
    -- Abstract callout types
    abstract = { raw = '[!ABSTRACT]', rendered = '󰨸 Abstract', highlight = 'RenderMarkdownInfo' },
    summary = { raw = '[!SUMMARY]', rendered = '󰨸 Summary', highlight = 'RenderMarkdownInfo' },
    tldr = { raw = '[!TLDR]', rendered = '󰨸 Tldr', highlight = 'RenderMarkdownInfo' },
    -- Info callout types
    info = { raw = '[!INFO]', rendered = '󰋽 Info', highlight = 'RenderMarkdownInfo' },
    todo = { raw = '[!TODO]', rendered = '󰥔 Todo', highlight = 'RenderMarkdownInfo' },
    hint = { raw = '[!HINT]', rendered = '󰌶 Hint', highlight = 'RenderMarkdownSuccess' },
    success = { raw = '[!SUCCESS]', rendered = '󰄬 Success', highlight = 'RenderMarkdownSuccess' },
    check = { raw = '[!CHECK]', rendered = '󰄬 Check', highlight = 'RenderMarkdownSuccess' },
    done = { raw = '[!DONE]', rendered = '󰄬 Done', highlight = 'RenderMarkdownSuccess' },
    question = { raw = '[!QUESTION]', rendered = '󰘥 Question', highlight = 'RenderMarkdownWarn' },
    help = { raw = '[!HELP]', rendered = '󰘥 Help', highlight = 'RenderMarkdownWarn' },
    faq = { raw = '[!FAQ]', rendered = '󰘥 Faq', highlight = 'RenderMarkdownWarn' },
    attention = { raw = '[!ATTENTION]', rendered = '󰀪 Attention', highlight = 'RenderMarkdownWarn' },
    failure = { raw = '[!FAILURE]', rendered = '󰅖 Failure', highlight = 'RenderMarkdownError' },
    fail = { raw = '[!FAIL]', rendered = '󰅖 Fail', highlight = 'RenderMarkdownError' },
    missing = { raw = '[!MISSING]', rendered = '󰅖 Missing', highlight = 'RenderMarkdownError' },
    danger = { raw = '[!DANGER]', rendered = '󰳦 Danger', highlight = 'RenderMarkdownError' },
    error = { raw = '[!ERROR]', rendered = '󰅖 Error', highlight = 'RenderMarkdownError' },
    bug = { raw = '[!BUG]', rendered = '󰨰 Bug', highlight = 'RenderMarkdownError' },
    example = { raw = '[!EXAMPLE]', rendered = '󰉹 Example', highlight = 'RenderMarkdownHint' },
    quote = { raw = '[!QUOTE]', rendered = '󱆨 Quote', highlight = 'RenderMarkdownQuote' },
    cite = { raw = '[!CITE]', rendered = '󱆨 Cite', highlight = 'RenderMarkdownQuote' },
  },

  -- Link configuration
  link = {
    enabled = true,
    -- Conceal hyperlinks, showing only the text
    hyperlink = '󰌹 ',
    highlight = 'RenderMarkdownLink',
  },

  -- Sign column configuration
  sign = {
    enabled = true,
    highlight = 'RenderMarkdownSign',
  },
})

-- Ensure rendering is enabled by default when opening markdown files
vim.api.nvim_create_autocmd("FileType", {
  pattern = "markdown",
  callback = function()
    vim.cmd("RenderMarkdown enable")
  end,
  desc = "Enable render-markdown on markdown files",
})
