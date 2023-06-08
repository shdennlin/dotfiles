#!/bin/bash
source ./functions.sh

BASEDIR=$(dirname "$0")

if [ $vim_config = 'y' ]; then
    if ! command_exists 'nvim' ; then # if command exist
        echo -e "${ERROR}you need to install neovim first"
        echo -e "       on Ubuntu, you can install from snap, use ${GREEN}sudo snap install nvim --classic${NC}"
        exit 0
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
