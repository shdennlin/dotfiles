# Shawn's dotfiles

- [Shawn's dotfiles](#shawns-dotfiles)
  - [include file \& function](#include-file--function)
  - [How to use](#how-to-use)
  - [env file config](#env-file-config)
  - [QA](#qa)

## include file & function

1. git config
2. nvim config
3. zsh config
4. zsh or bash alias
5. Remap key: exchange ctrl_L and alt_L

## How to use

1. Download and modify env file

```bash
cd ~ && git clone https://github.com/shdennlin/dotfiles.git ~/.dotfiles/
cd ~/.dotfiles
cp .env.example .env
vim .env
```

2. Install

```bash
./install.sh
```

3. After install, you need to restart your terminal.

4. (option) speed up zsh

```bash
znap compile
```

## env file config

```bash
computer_type=m # m or s (master or slave)
git=y # y or n
alias_file=y # y or n
zsh=y # y or n
vim_config=y # y or n
keymap=y # y or n
```

## QA

1. The difference of `master` and `slave`?
   master use `ln` command to link file, slave use `cp` command to copy file.
