#!/bin/bash
source ./functions.sh

BASEDIR=$(dirname "$0")
ZSH_CUSTOM="$HOME/.zsh-plugins"
ZSH_CONFIG="$ZSH_CUSTOM/.zsh-config"
mkdir -pv $ZSH_CUSTOM
mkdir -pv $ZSH_CONFIG

if [ $zsh_config = 'y' ]; then
    # check zsh is installed
    if ! command_exists 'zsh' ; then # if command exist
        echo -e "${ERROR}you need to install neovim first"
        echo -e "       on Ubuntu, use ${GREEN}sudo apt install -y zsh${NC}, and use ${GREEN}chus -s \$(whoch zsh) \$USER${NC} to set zsh as default shell"
        exit 0
    fi
    
    $cl -f $BASEDIR/.zshrc $HOME
    echo -e "${INFO}${cl} -f .zshrc successful"
    $cl -f $BASEDIR/.zsh_aliases $ZSH_CONFIG
    echo -e "${INFO}${cl} -f .zsh_aliases successful"
    $cl -f $BASEDIR/package.zsh $ZSH_CONFIG
    echo -e "${INFO}${cl} -f package.zsh successful"
    $cl -f $BASEDIR/.p10k.zsh $HOME
    echo -e "${INFO}${cl} -f .p10k.zsh successful"

    # remove site-functions
    rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/zsh/site-functions/"*
fi
