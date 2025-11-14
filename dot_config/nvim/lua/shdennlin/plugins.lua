-- Autocommand that reloads neovim whenever you save the plugins.lua file
vim.cmd([[
  augroup packer_user_config
    autocmd!
    autocmd BufWritePost plugins.lua source <afile> | PackerSync
  augroup end
]])

-- Use a protected call so we don't error out on first use
local status, packer = pcall(require, "packer")
if (not status) then
  print("Packer is not installed")
  return
end

-- vim.cmd [[packadd packer.nvim]]

return packer.startup(function(use)
  use 'wbthomason/packer.nvim'
  use 'nvim-lua/plenary.nvim' -- Common utilities
  use 'nvim-tree/nvim-web-devicons' -- Icons for plugins

	use { 'max397574/better-escape.nvim',
		config = function() require("better_escape").setup() end
	}
	use { 'nkakouros-original/numbers.nvim',
		config = function() require('numbers').setup() end
	}
  use { 'windwp/nvim-autopairs',
    config = function() require('nvim-autopairs').setup() end 
  }
  use { 'nvim-lualine/lualine.nvim',  -- Statusline
    config = function() require('lualine').setup() end 
  }
  use { 'kylechui/nvim-surround',
    config = function() require('nvim-surround').setup() end
  }
  

  use 'onsails/lspkind-nvim' -- vscode-like pictograms
  use 'neovim/nvim-lspconfig' -- LSP
  use 'hrsh7th/cmp-nvim-lsp' -- nvim-cmp source for neovim's built-in LSP
  use 'hrsh7th/cmp-buffer' -- nvim-cmp source for buffer words
  use 'hrsh7th/cmp-path'
  use 'hrsh7th/cmp-cmdline'
  use 'hrsh7th/nvim-cmp' -- Completion

  -- Tree-sitter for enhanced syntax highlighting
  use { 'nvim-treesitter/nvim-treesitter',
    run = ':TSUpdate',
    config = function()
      require('nvim-treesitter.configs').setup {
        -- A list of parser names, or "all"
        ensure_installed = {
          "lua", "vim", "vimdoc", "query", "markdown", "markdown_inline",
          "go", "python", "javascript", "typescript", "html", "css", "json",
          "yaml", "toml", "bash", "rust", "c", "cpp", "java", "latex"
        },

        -- Install parsers synchronously (only applied to `ensure_installed`)
        sync_install = false,

        -- Automatically install missing parsers when entering buffer
        auto_install = true,

        -- List of parsers to ignore installing
        ignore_install = {},

        highlight = {
          enable = true,
          -- Setting this to true will run `:h syntax` and tree-sitter at the same time.
          -- Set this to `true` if you depend on 'syntax' being enabled (like for indentation).
          -- Using this option may slow down your editor, and you may see some duplicate highlights.
          -- Instead of true it can also be a list of languages
          additional_vim_regex_highlighting = false,
        },

        incremental_selection = {
          enable = true,
          keymaps = {
            init_selection = "gnn",
            node_incremental = "grn",
            scope_incremental = "grc",
            node_decremental = "grm",
          },
        },

        indent = {
          enable = true
        },
      }
    end
  }

  -- Markdown rendering
  use {
    'MeanderingProgrammer/render-markdown.nvim',
    after = { 'nvim-treesitter' },
    requires = { 'nvim-tree/nvim-web-devicons' },
    config = function()
      require('render-markdown').setup({})
    end,
  }

  -- Automatically set up your configuration after cloning packer.nvim
  -- Put this at the end after all plugins
  if PACKER_BOOTSTRAP then
    require('packer').sync()
  end
end)
