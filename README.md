# Shawn's dotfiles

- [Shawn's dotfiles](#shawns-dotfiles)
  - [Support OS](#support-os)
  - [Requirements](#requirements)
  - [Include Function](#include-function)
  - [How to use](#how-to-use)
  - [".env" file setting example](#env-file-setting-example)

## Support OS

- Debian-based Linux
  - Ubuntu >= 22.04
- Arch-based Linux
  - Arch Linux
- MacOS

## Requirements

1. zsh >= 5.8.1
2. neovim >= 0.8

## Include Function

1. useful [packages](package/install.sh)
   package list: [aria2](https://github.com/aria2/aria2), [bat](https://github.com/sharkdp/bat), [exa](https://github.com/ogham/exa), [fd](https://github.com/sharkdp/fd), [fzf](https://github.com/junegunn/fzf), [ripgrep](https://github.com/BurntSushi/ripgrep), [thefuck](https://github.com/nvbn/thefuck), [tmux](https://github.com/tmux/tmux/wiki), [zoxide](https://github.com/ajeetdsouza/zoxide)
   > **NOTE:** You may need **Administrator** to install packages.
2. git config
3. neovim config
4. tmux config
5. zsh config and alias
6. Remap key: exchange `ctrl_L` and `alt_L`

## How to use

1. Download and modify env file

   ```bash
   cd ~ && git clone https://github.com/shdennlin/dotfiles.git ~/.dotfiles/
   cd ~/.dotfiles
   cp .env.example .env
   ```

2. Edit the `.env` file -> [.env file setting example](#env-file-setting-example)

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

## ".env" file setting example

```bash
useful_package=y # y or n
git_config=y # y or n
neovim_config=y # y or n
tmux_config=y # y or n
zsh_config=y # y or n
keymap=n # y or n
```
