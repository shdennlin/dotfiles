#!/bin/bash
source ./functions.sh

BASEDIR=$(dirname "$0")

if [ $vim_config = 'y' ]; then
    if ! command_exists 'nvim' ; then # if command exist
        echo "${WARRING}you need to install neovim first${NC}"
        echo "${WARRING}on Ubuntu, you can install from snap, use ${GREEN}sudo snap install nvim --classic${NC}"
        return 0
    fi

    dir="$HOME/.local/share/nvim/site/pack/packer/start/packer.nvim"
    if [ ! -d $dir ] ; then
        git clone --depth 1 https://github.com/wbthomason/packer.nvim $HOME/.local/share/nvim/site/pack/packer/start/packer.nvim
    else
        cd $dir && git pull && cd - > /dev/null
    fi

    rm -rf $HOME/.config/nvim
    mkdir -pv $HOME/.config
    cp -r $BASEDIR/nvim $HOME/.config/nvim

    echo -e "${INFO} cp -r $BASEDIR/nvim $HOME/.config/nvim successful"

    nvim +"PackerSync" +"sleep 7" +"q" +"q"
fi
