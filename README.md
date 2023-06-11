# Shawn's dotfiles

- [Shawn's dotfiles](#shawns-dotfiles)
  - [Pre-requisite](#pre-requisite)
  - [include file \& function](#include-file--function)
  - [env file config](#env-file-config)
  - [How to use](#how-to-use)
  - [QA](#qa)

## Pre-requisite

1. neovim >= 0.8

## include file & function

1. utils [package](package/install.sh)
   package list: `aria2, bat, exa, fd-find, fzf, ripgrep, thefuck, tmux, zoxide`
   > **NOTE:** You may need **Administrator** to install packages.
2. git config
3. neovim config
4. tmux config
5. zsh config and alias
6. Remap key: exchange `ctrl_L` and `alt_L`

## env file config

```bash
computer_type=m # m or s (master or slave)
useful_package=y # y or n
git_config=y # y or n
neovim_config=y # y or n
tmux_config=y # y or n
zsh_config=y # y or n
keymap=y # y or n
```

## How to use

1. Download and modify env file

   ```bash
   cd ~ && git clone https://github.com/shdennlin/dotfiles.git ~/.dotfiles/
   cd ~/.dotfiles
   cp .env.example .env
   ```

2. Edit the `.env` file

3. Install from terminal

   ```bash
   ./install.sh
   ```

4. After install, you need to restart your terminal. At the first restart, you need to wait for a while(10-30s) to install plugins

5. (option) speed up zsh
   type following on terminal

   ```bash
   znap compile
   ```

## QA

1. The difference of `master` and `slave` type?
   master use `ln` command to link file, slave use `cp` command to copy file.
