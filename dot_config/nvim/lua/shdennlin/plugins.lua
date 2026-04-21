-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.uv.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  -- Core utilities (loaded as dependencies)
  { 'nvim-lua/plenary.nvim', lazy = true },
  { 'nvim-tree/nvim-web-devicons', lazy = true },

  -- Editing enhancements
  {
    'max397574/better-escape.nvim',
    event = 'InsertEnter',
    config = true,
  },
  {
    'nkakouros-original/numbers.nvim',
    event = 'VeryLazy',
    config = true,
  },
  {
    'windwp/nvim-autopairs',
    event = 'InsertEnter',
    config = true,
  },
  {
    'kylechui/nvim-surround',
    event = 'VeryLazy',
    config = true,
  },

  -- Statusline
  {
    'nvim-lualine/lualine.nvim',
    dependencies = { 'nvim-tree/nvim-web-devicons' },
    config = true,
  },

  -- LSP
  { 'onsails/lspkind-nvim', lazy = true },
  { 'neovim/nvim-lspconfig', event = 'VeryLazy' },

  -- Completion
  {
    'hrsh7th/nvim-cmp',
    event = { 'InsertEnter', 'CmdlineEnter' },
    dependencies = {
      'hrsh7th/cmp-nvim-lsp',
      'hrsh7th/cmp-buffer',
      'hrsh7th/cmp-path',
      'hrsh7th/cmp-cmdline',
    },
    config = function()
      local cmp = require('cmp')

      cmp.setup({
        snippet = {
          expand = function(args)
            vim.fn["vsnip#anonymous"](args.body)
          end,
        },
        mapping = cmp.mapping.preset.insert({
          ['<C-d>'] = cmp.mapping.scroll_docs(-4),
          ['<C-f>'] = cmp.mapping.scroll_docs(4),
          ['<C-Space>'] = cmp.mapping.complete(),
          ['<C-e>'] = cmp.mapping.close(),
          ['<CR>'] = cmp.mapping.confirm({ select = true }),
        }),
        sources = cmp.config.sources({
          { name = 'path' },
          { name = 'nvim_lsp' },
          { name = 'vsnip' },
        }, {
          { name = 'buffer' },
        }),
      })

      vim.cmd [[
        set completeopt=menuone,noinsert,noselect
        highlight! default link CmpItemKind CmpItemMenuDefault
      ]]
    end,
  },

  -- Tree-sitter
  {
    'nvim-treesitter/nvim-treesitter',
    branch = 'main',
    build = function()
      if vim.fn.executable('tree-sitter') == 1 then
        vim.cmd('TSUpdate')
      end
    end,
    event = 'VeryLazy',
    config = function()
      require('nvim-treesitter').setup {}

      local has_tree_sitter_cli = vim.fn.executable('tree-sitter') == 1
      local ensure_installed = {
        "lua", "vim", "vimdoc", "query", "markdown", "markdown_inline",
        "go", "python", "javascript", "typescript", "html", "css", "json",
        "yaml", "toml", "bash", "rust", "c", "cpp", "java", "latex",
      }
      vim.defer_fn(function()
        if not has_tree_sitter_cli then
          return
        end

        local installed = require('nvim-treesitter.config').get_installed()
        local missing = vim.tbl_filter(function(lang)
          return not vim.list_contains(installed, lang)
        end, ensure_installed)
        if #missing > 0 then
          require('nvim-treesitter.install').install(missing)
        end
      end, 0)

      vim.api.nvim_create_autocmd('FileType', {
        callback = function(ev)
          pcall(vim.treesitter.start, ev.buf)
        end,
      })

      vim.api.nvim_create_autocmd('FileType', {
        callback = function(ev)
          vim.bo[ev.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
        end,
      })
    end,
  },

  -- Markdown rendering
  {
    'MeanderingProgrammer/render-markdown.nvim',
    dependencies = { 'nvim-treesitter/nvim-treesitter', 'nvim-tree/nvim-web-devicons' },
    ft = 'markdown',
    config = function()
      require('render-markdown').setup({
        enabled = true,
        max_file_size = 10.0,
        debounce = 100,
        render_modes = { 'n', 'c', 't' },
        file_types = { 'markdown' },
        heading = {
          enabled = true,
          icons = { '󰲡 ', '󰲣 ', '󰲥 ', '󰲧 ', '󰲩 ', '󰲫 ' },
          backgrounds = {
            'RenderMarkdownH1Bg', 'RenderMarkdownH2Bg', 'RenderMarkdownH3Bg',
            'RenderMarkdownH4Bg', 'RenderMarkdownH5Bg', 'RenderMarkdownH6Bg',
          },
          foregrounds = {
            'RenderMarkdownH1', 'RenderMarkdownH2', 'RenderMarkdownH3',
            'RenderMarkdownH4', 'RenderMarkdownH5', 'RenderMarkdownH6',
          },
        },
        code = {
          enabled = true,
          style = 'full',
          left_pad = 2,
          right_pad = 2,
          highlight = 'RenderMarkdownCode',
        },
        code_inline = {
          enabled = true,
          highlight = 'RenderMarkdownCodeInline',
        },
        bullet = {
          enabled = true,
          icons = { '●', '○', '◆', '◇' },
          ordered_icons = {},
          highlight = 'RenderMarkdownBullet',
        },
        checkbox = {
          enabled = true,
          unchecked = { icon = '󰄱 ', highlight = 'RenderMarkdownUnchecked' },
          checked = { icon = '󰱒 ', highlight = 'RenderMarkdownChecked' },
          custom = {
            todo = { raw = '[-]', rendered = '󰥔 ', highlight = 'RenderMarkdownTodo' },
          },
        },
        quote = {
          enabled = true,
          icon = '▋',
          highlight = 'RenderMarkdownQuote',
        },
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
        callout = {
          note = { raw = '[!NOTE]', rendered = '󰋽 Note', highlight = 'RenderMarkdownInfo' },
          tip = { raw = '[!TIP]', rendered = '󰌶 Tip', highlight = 'RenderMarkdownSuccess' },
          important = { raw = '[!IMPORTANT]', rendered = '󰅾 Important', highlight = 'RenderMarkdownHint' },
          warning = { raw = '[!WARNING]', rendered = '󰀪 Warning', highlight = 'RenderMarkdownWarn' },
          caution = { raw = '[!CAUTION]', rendered = '󰳦 Caution', highlight = 'RenderMarkdownError' },
          abstract = { raw = '[!ABSTRACT]', rendered = '󰨸 Abstract', highlight = 'RenderMarkdownInfo' },
          summary = { raw = '[!SUMMARY]', rendered = '󰨸 Summary', highlight = 'RenderMarkdownInfo' },
          tldr = { raw = '[!TLDR]', rendered = '󰨸 Tldr', highlight = 'RenderMarkdownInfo' },
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
        link = {
          enabled = true,
          hyperlink = '󰌹 ',
          highlight = 'RenderMarkdownLink',
        },
        sign = {
          enabled = true,
          highlight = 'RenderMarkdownSign',
        },
      })
    end,
  },
})
