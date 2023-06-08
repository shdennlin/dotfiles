#!/bin/bash
source ./functions.sh

BASEDIR=$(dirname "$0")
ZSH_CUSTOM="$HOME/.zsh-plugins"
ZSH_CONFIG="$ZSH_CUSTOM/.zsh-config"
mkdir -pv $ZSH_CUSTOM
mkdir -pv $ZSH_CONFIG

if [ $zsh = 'y' ]; then
    $cl -f $BASEDIR/.zshrc $HOME
    echo -e "${INFO}${cl} -f .zshrc successful"
    $cl -f $BASEDIR/.zsh_aliases $ZSH_CONFIG
    echo -e "${INFO}${cl} -f .zsh_aliases successful"
    $cl -f $BASEDIR/package.zsh $ZSH_CONFIG
    echo -e "${INFO}${cl} -f package.zsh successful"
    $cl -f $BASEDIR/.p10k.zsh $HOME
    echo -e "${INFO}${cl} -f .p10k.zsh successful"

    # install zsh
    if ! command_exists 'zsh' ; then # if command exist
        sudo apt install -y zsh
        # set zsh as default in user
        sudo chsh -s /bin/zsh $USER
    fi
fi
