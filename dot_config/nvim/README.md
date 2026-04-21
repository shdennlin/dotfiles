# Neovim Configuration

Modular Neovim configuration with lazy.nvim plugin manager, treesitter-based syntax highlighting, and LSP support.

- [Neovim Configuration](#neovim-configuration)
  - [Requirements](#requirements)
  - [Plugin List](#plugin-list)
  - [Post-Installation](#post-installation)
  - [Key Bindings](#key-bindings)
    - [General](#general)
    - [Surround (nvim-surround)](#surround-nvim-surround)
    - [Completion (nvim-cmp)](#completion-nvim-cmp)
  - [Plugin Management](#plugin-management)
  - [File Structure](#file-structure)
  - [Customization](#customization)
  - [Troubleshooting](#troubleshooting)

## Requirements

- **Neovim** >= 0.11.3 (0.12.x recommended/tested)
- **Git** (for plugin installation)
- **Nerd Font** (for icons, see [main README](../../README.md#the-font-of-the-terminal-is-not-correct))
- **tree-sitter-cli** (optional, for compiling some parsers like `latex`)

> [!WARNING]
> Debian 13 (`trixie`) ships Neovim 0.10.x via apt. This config follows the
> current `nvim-lspconfig` API and expects Nvim 0.11+. On Debian stable, install
> Neovim from the official tarball or pin older LSP plugins.

## Plugin List

| Plugin | Purpose |
|--------|---------|
| [lazy.nvim](https://github.com/folke/lazy.nvim) | Plugin manager |
| [plenary.nvim](https://github.com/nvim-lua/plenary.nvim) | Lua utility library (dependency) |
| [nvim-web-devicons](https://github.com/nvim-tree/nvim-web-devicons) | File type icons (dependency) |
| [better-escape.nvim](https://github.com/max397574/better-escape.nvim) | Faster escape from Insert mode (`jk`) |
| [numbers.nvim](https://github.com/nkakouros-original/numbers.nvim) | Smart relative/absolute line numbers |
| [nvim-autopairs](https://github.com/windwp/nvim-autopairs) | Auto-close brackets and quotes |
| [nvim-surround](https://github.com/kylechui/nvim-surround) | Add/change/delete surrounding pairs |
| [lualine.nvim](https://github.com/nvim-lualine/lualine.nvim) | Statusline |
| [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) | LSP client configurations |
| [nvim-cmp](https://github.com/hrsh7th/nvim-cmp) | Auto-completion engine |
| [lspkind-nvim](https://github.com/onsails/lspkind-nvim) | VS Code-like completion icons |
| [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) | Syntax highlighting and indentation |
| [render-markdown.nvim](https://github.com/MeanderingProgrammer/render-markdown.nvim) | In-editor Markdown rendering |

## Post-Installation

After `chezmoi apply`, plugins are installed automatically via lazy.nvim. To verify and manage plugins manually:

```bash
# Open Neovim
nvim

# Open plugin manager UI
:Lazy
```

In the Lazy UI:

| Key | Action |
|-----|--------|
| `S` | Sync (install + update + clean) |
| `U` | Update all plugins |
| `I` | Install missing plugins |
| `X` | Clean removed plugins |
| `P` | Show profiling (startup time per plugin) |
| `q` | Close |

Treesitter parsers are installed automatically on first launch only when the
`tree-sitter` CLI is available. On minimal servers without `tree-sitter`, parser
installation is skipped quietly so Neovim can still start. To manually manage
parsers:

```vim
:TSInstall <language>    " Install a parser
:TSUpdate                " Update all parsers
:TSInstall all           " Install all available parsers
```

## Key Bindings

### General

| Mode | Key | Action |
|------|-----|--------|
| Visual | `p` | Paste without overwriting register |
| Insert | `jk` | Exit to Normal mode (better-escape) |

### Surround (nvim-surround)

| Mode | Key | Action | Example |
|------|-----|--------|---------|
| Normal | `ys{motion}{char}` | Add surrounding | `ysiw"` : `word` -> `"word"` |
| Normal | `cs{old}{new}` | Change surrounding | `cs"'` : `"word"` -> `'word'` |
| Normal | `ds{char}` | Delete surrounding | `ds"` : `"word"` -> `word` |
| Visual | `S{char}` | Surround selection | Select text, `S)` wraps with `()` |

### Completion (nvim-cmp)

| Key | Action |
|-----|--------|
| `<C-Space>` | Trigger completion |
| `<CR>` | Confirm selection |
| `<C-e>` | Close completion menu |
| `<C-d>` | Scroll docs up |
| `<C-f>` | Scroll docs down |

## Plugin Management

Plugins are version-locked via `lazy-lock.json`. This ensures consistent versions across machines.

```bash
# Update all plugins (inside Neovim)
:Lazy sync

# Restore locked versions (after pulling dotfiles updates)
:Lazy restore
```

## File Structure

```
~/.config/nvim/
├── init.lua                    # Entry point, loads all modules
├── lazy-lock.json              # Plugin version lockfile
├── version                     # Config version (triggers chezmoi re-sync)
└── lua/shdennlin/
    ├── base.lua                # Editor settings (encoding, indent, clipboard)
    ├── highlights.lua          # Cursor line highlighting
    ├── maps.lua                # Custom keybindings
    └── plugins.lua             # Plugin specs (lazy.nvim)
```

## Customization

**Add a new plugin** - add a spec entry in `lua/shdennlin/plugins.lua`:

```lua
{
  'author/plugin-name',
  event = 'VeryLazy',       -- when to load (optional)
  config = function()
    require('plugin-name').setup({
      -- options
    })
  end,
},
```

**Configure LSP servers** - currently no language servers are configured. To add one:

```lua
-- In plugins.lua, update the nvim-lspconfig entry:
{
  'neovim/nvim-lspconfig',
  event = 'VeryLazy',
  config = function()
    vim.lsp.enable('lua_ls')   -- Lua
    vim.lsp.enable('pyright')  -- Python
    vim.lsp.enable('ts_ls')    -- TypeScript
    vim.lsp.enable('gopls')    -- Go
  end,
},
```

> [!WARNING]
> This LSP example requires Nvim 0.11+. Use `vim.lsp.config()` for per-server
> overrides and `vim.lsp.enable()` to enable servers. Avoid the deprecated
> `require('lspconfig').SERVER.setup({})` API.

## Troubleshooting

**Plugins not loading:** Run `:Lazy sync` to reinstall.

**Icons not displaying:** Install a [Nerd Font](https://www.nerdfonts.com/font-downloads) and set it in your terminal.

**tree-sitter CLI not found:** See [main README](../../README.md#neovim-tree-sitter-cli-not-found-error).

**Reset everything:** Delete `~/.local/share/nvim/lazy/` and reopen Neovim.
