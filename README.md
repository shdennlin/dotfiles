# Shawn's dotfiles

## Install

``` bash
    chezmoi init --verbose https://github.com/shdennlin/chezmoi.git
    chezmoi edit-config
    chezmoi apply --dry-run
    chezmoi apply
```

## QA

- How to update packages manually?
   MacOS: `chezmoi apply ~/install-packages-darwin.sh`
