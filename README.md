# Shawn's dotfiles

This is my dotfiles repository, which is managed by [chezmoi](https://www.chezmoi.io/).

- [Shawn's dotfiles](#shawns-dotfiles)
  - [Support OS](#support-os)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [How To Use](#how-to-use)
  - [Q/A](#qa)
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

Install [chezmoi](https://www.chezmoi.io/) first. You can install it by running the following command:

``` bash
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

``` bash
    chezmoi init --verbose https://github.com/shdennlin/chezmoi.git
    chezmoi edit-config # Edit the config file, set the value you want
    chezmoi apply --dry-run # Check the changes, you can skip this step if you want
    chezmoi apply
```

## Q/A

### The font of the terminal is not correct

If you are using macOS, it will install automatically if you set `installUsefulPackages` to `true` in the config file. After that, you need to set the font to `Hack Nerd Font` in the terminal.

If you are using Linux, you need to install the font manually then set the font to `Hack Nerd Font` in the terminal.

You can download the font from [here](https://www.nerdfonts.com/font-downloads). And get more information about the font [here](https://github.com/ryanoasis/nerd-fonts/tree/master/patched-fonts/Hack)
