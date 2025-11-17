# nnn Configuration Directory

This directory contains configuration files for [nnn](https://github.com/jarun/nnn), a fast and lightweight terminal file manager.

## Directory Structure

- `.lastd` - Auto-generated file storing the last visited directory (used by nnn_cd function for auto-cd on quit)
- `bookmarks/` - Directory for nnn bookmarks
- `plugins/` - Directory for nnn plugins
- `sessions/` - Directory for saved nnn sessions
- `mounts/` - Directory for mount points

## Usage

The `nnn_cd` wrapper function (aliased as `n`) is configured in `~/.zsh/aliases.zsh` and provides:

- **Vim-style navigation**: `j/k` (down/up), `l` (enter folder), `h` (back)
- **File preview**: Press `p` while hovering on a file to preview with fzf
- **Auto-cd on quit**: Press `q` to quit, and your terminal automatically cd's to the current directory

### Quick Start

```bash
n              # Open nnn file manager
# Navigate with j/k/h/l
# Press 'p' to preview files
# Press 'q' to quit and cd to current directory
```

## Features Enabled

- **CD-on-quit**: Automatically changes shell directory to nnn's location when you quit
- **File preview**: Uses fzf for file preview (via `-P p` flag)

## Additional Configuration

To customize nnn further, you can set environment variables in your shell config:

```bash
export NNN_OPTS="H"        # Show hidden files
export NNN_COLORS="2136"   # Color scheme
export NNN_TRASH=1         # Use trash instead of delete
```

See the [nnn documentation](https://github.com/jarun/nnn/wiki) for more options.
