#!/bin/bash
source ./functions.sh

BASEDIR=$(dirname $(realpath "$0"))

if [ $neovim_config = 'y' ]; then
    package_name="neovim config"
    echo -e "${INFO}Install ${package_name} config..."
    # check neovim is installed
    if ! command_exists 'nvim' ; then
        echo -e "${ERROR}you need to install neovim first"
        echo -e "       on Ubuntu, you can install from snap, use ${GREEN}sudo snap install nvim --classic${NC}"
        exit 1
    fi

    # Install packer.nvim
    dir="$HOME/.local/share/nvim/site/pack/packer/start/packer.nvim"
    if [ ! -d $dir ] ; then
        git clone --depth 1 https://github.com/wbthomason/packer.nvim $HOME/.local/share/nvim/site/pack/packer/start/packer.nvim
    else
        echo -e "${BLUE}Update packer.nvim...${NC}"
        cd $dir && git pull > /dev/null && cd - > /dev/null
    fi

    # Install config file
    rm -rf $HOME/.config/nvim
    mkdir -pv $HOME/.config
    cmd="ln -sf ${BASEDIR}/nvim ${HOME}/.config/nvim"

    run_cmd "$package_name" "$cmd"

    echo -e "${BLUE}Run ${MAGENTA}nvim +PackerSync +sleep 7 +q +q${BLUE} to install plugins${NC}"
    nvim +"PackerSync" +"sleep 7" +"q" +"q"
fi
