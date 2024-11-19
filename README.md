# Shawn's dotfiles

This is my dotfiles repository, which is managed by [chezmoi](https://www.chezmoi.io/).

- [Shawn's dotfiles](#shawns-dotfiles)
  - [Support OS](#support-os)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [How To Use](#how-to-use)
  - [Q/A](#qa)
    - [Update to my latest configurations](#update-to-my-latest-configurations)
    - [Configuration file](#configuration-file)
    - [The font of the terminal is not correct](#the-font-of-the-terminal-is-not-correct)

## Support OS

- MacOS
- Debian-based Linux distributions
- Arch-based Linux distributions
- Other Linux distributions (not fully tested yet)

## Features

1. **Git** Configurations
2. **Neovim** as the default editor and Configurations
3. **Tmux** as the default terminal multiplexer and Configurations
4. **Zsh** as the default shell and Configurations
5. Install **Useful Packages**, package list can be found in [.chezmoidata/packages.toml](./.chezmoidata/packages.toml)

> [!IMPORTANT]  
> Need to have **Administrator privileges** to Install Useful Packages.
> You can set `installUsefulPackages` to `false` in the config file to disable this feature.

> [!TIP]
> You can disable the feature you don't want in the config file by using `chezmoi edit-config` command.

## Prerequisites

1. [Git](https://git-scm.com/)
2. [chezmoi](https://www.chezmoi.io/). You can install it by running the following command:

```bash
    # MacOS
    brew install chezmoi
    # Base on Arch Linux
    sudo pacman -S chezmoi
    # Using asdf
    asdf plugin add chezmoi && asdf install chezmoi latest && asdf global chezmoi latest
    # Or Install binary and put it in your PATH like `/usr/local/bin`
    sh -c "$(curl -fsLS get.chezmoi.io)" -- -b /usr/.local/bin
```

Get More information about how to install chezmoi from [here](https://www.chezmoi.io/install/)

## How To Use

Quick Installations:

```bash
    chezmoi init --apply shdennlin
```

Or you can install it manually and apply the configurations by following the steps below:

```bash
    chezmoi init shdennlin
    chezmoi edit-config # Edit the config file, set the value you want
    chezmoi apply --dry-run # Check the changes, you can skip this step if you want
    chezmoi apply
```

Apply the configurations if you have already installed the configurations or got failed during the installation:

```bash
    chezmoi apply
```

## Q/A

### Update to my latest configurations

```bash
    chezmoi update
```

### Configuration file

The config file is located at `~/.config/chezmoi/chezmoi.toml` by default, you can edit it by using `chezmoi edit-config` command quickly.

My Configurations can be found in the [.chezmoi.toml.tmpl](./.chezmoi.toml.tmpl), the following is the default value and explanation:

```toml
[data]
  # Set "true" if you want to apply the configuration
  applyGit    = true
  applyNeovim = true
  applyTmux   = true
  applyZsh    = true
  # If you want to install useful packages, set "true"
  # package list is in {{ .chezmoi.sourceDir }}, you can use `chezmoi cd` to go to the source directory of chezmoi quickly
  # and find the list in `.chezmoidata/packages.toml`
  installUsefulPackages = true

# If you select to apply Git configuration, fill in the following fields
[data.git]
  name = ""
  username = ""
  email = ""
  # If you want to use gpg sign, set gpgsign to "true" and set signingkey
  gpgsign = "false"
  signingkey = ""
```

### The font of the terminal is not correct

If you are using macOS, it will install automatically if you set `installUsefulPackages` to `true` in the config file. After that, you need to set the font to `Hack Nerd Font` in the terminal.

If you are using Linux, you need to install the font manually then set the font to `Hack Nerd Font` in the terminal.

You can download the font from [here](https://www.nerdfonts.com/font-downloads). And get more information about the font [here](https://github.com/ryanoasis/nerd-fonts/tree/master/patched-fonts/Hack)
