# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a cross-platform dotfiles repository managed by [chezmoi](https://www.chezmoi.io/), supporting macOS and various Linux distributions (Debian-based, Arch-based). It provides a complete development environment setup including Git, Neovim, Tmux, and Zsh configurations.

## Essential Commands

### Core Chezmoi Operations
```bash
# Apply all configurations (main command)
chezmoi apply

# Preview changes before applying
chezmoi apply --dry-run

# Update to latest configurations from repository
chezmoi update

# Edit chezmoi configuration file
chezmoi edit-config

# Navigate to chezmoi source directory
chezmoi cd

# Initialize and apply (fresh installation)
chezmoi init --apply shdennlin
```

### Development Workflow
```bash
# Edit dotfiles in chezmoi source directory
chezmoi edit <file>

# Apply specific file
chezmoi apply <file>

# Check diff between current and source
chezmoi diff

# Re-run scripts (useful after package installation)
chezmoi apply --force
```

## Architecture & Template System

### Template Structure
- **`.tmpl` files**: Go template files processed by chezmoi with conditional logic
- **`run_*` scripts**: Executable scripts for system setup and package installation
- **`dot_*` files**: Mapped to dotfiles in home directory (dot_zshrc → ~/.zshrc)

### Configuration Data Flow
1. **`.chezmoi.toml.tmpl`**: Main configuration template defining user data and feature toggles
2. **Template variables**: Available in all `.tmpl` files via `{{ .variableName }}`
3. **OS detection**: `{{ .chezmoi.os }}`, `{{ .chezmoi.osRelease.id }}` for platform-specific logic
4. **Feature toggles**: `{{ .applyGit }}`, `{{ .applyNeovim }}`, etc. control component installation

### Platform-Specific Logic
```go
{{ if eq .chezmoi.os "darwin" -}}
  # macOS-specific configuration
{{ else if eq .chezmoi.osRelease.id "ubuntu" -}}
  # Ubuntu-specific configuration  
{{ end -}}
```

## Key Components

### Git Configuration (dot_gitconfig.tmpl)
- Uses Delta for enhanced diffs
- Template variables for user info: `{{ .git.name }}`, `{{ .git.email }}`
- GPG signing support with platform-specific GPG paths
- Cross-platform line ending normalization

### Neovim Setup
- **Plugin Manager**: Packer (wbthomason/packer.nvim)
- **Structure**: Modular Lua configuration in `dot_config/nvim/lua/shdennlin/`
- **Auto-installation**: `run_onchange_before_nvim-plugin-checking.sh.tmpl` handles Neovim installation
- **Plugin sync**: Automatic PackerSync on plugins.lua changes

### Tmux Configuration
- **Plugin Manager**: TPM (Tmux Plugin Manager)
- **Key Bindings**: Alt+number for window switching, Ctrl+k for clear
- **Plugins**: sensible, copycat, pain-control, resurrect, continuum
- **Session persistence**: tmux-resurrect with custom directory

### Zsh Environment
- **Plugin Manager**: Znap (marlonrichert/zsh-snap)
- **Theme**: Powerlevel10k with instant prompt
- **Configuration**: Modular structure in `dot_zsh/` directory
- **Aliases**: Conditional aliases based on available commands via `change_alias` function

## Package Management

### Installation Control
Configure in chezmoi.toml:
```toml
[data]
installUsefulPackages = true    # Enable/disable package installation
miniPackages = false           # Minimal package set for servers
applyGit = true                # Individual component toggles
applyNeovim = true
applyTmux = true
applyZsh = true
```

### Platform-Specific Installation
- **macOS**: Homebrew bundle with brews and casks
- **Linux**: Platform-specific package managers (apt, pacman, dnf)
- **Package lists**: Referenced from `.chezmoidata/packages.toml` (external file)

### Run Scripts Execution Order
1. `run_before_00-install-pre-requisites.sh` - Git dependency check
2. `run_before_zsh-checking.sh.tmpl` - Zsh installation
3. `run_onchange_install-packages-*.sh.tmpl` - Package installation
4. `run_onchange_before_*-checking.sh.tmpl` - Component-specific setup
5. `run_onchange_after_nvim-plugin-install.sh.tmpl` - Post-setup tasks

## Development Environment Features

### Editor Integration
- **Default editor**: Neovim with comprehensive plugin setup
- **Git integration**: Delta syntax highlighting, GPG signing
- **Terminal**: Tmux with session management and restoration

### Shell Enhancement
- **Emacs keybindings**: Alt+arrow for word movement
- **Path management**: Automatic detection of common binary paths (/opt/homebrew, ~/.cargo, ~/.local)
- **ASDF integration**: Automatic PATH configuration for version management

### Cross-Platform Compatibility
- **Font handling**: Automatic Nerd Font installation on macOS
- **Architecture support**: x86_64 and ARM64 considerations
- **Package availability**: Conditional installation based on platform capabilities

## Configuration Customization

### User Data Template
Edit personal information in generated `~/.config/chezmoi/chezmoi.toml`:
```toml
[data.git]
name = "Your Name"
username = "yourusername"  
email = "your.email@example.com"
gpgsign = "true"
signingkey = "your-gpg-key-id"
```

### Template Debugging
- Use `chezmoi execute-template` to test template syntax
- Check `chezmoi data` to view all available template variables
- Validate with `chezmoi apply --dry-run` before applying changes

## Troubleshooting

### Common Issues
- **Permission errors**: Ensure script files have execute permissions
- **Package installation failures**: Check `installUsefulPackages` setting and platform support
- **Template errors**: Validate template syntax and variable availability
- **Plugin issues**: Re-run `chezmoi apply --force` to trigger plugin installation scripts

### Version Tracking
- Scripts use hash-based change detection (e.g., `{{ include "dot_config/nvim/version" | sha256sum }}`)
- Configuration changes trigger automatic re-execution of relevant scripts