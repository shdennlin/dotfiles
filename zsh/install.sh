#!/bin/bash
source ./functions.sh
BASEDIR=$(dirname $(realpath "$0"))

ZSH_CUSTOM="$HOME/.zsh-plugins"
ZSH_CONFIG="$ZSH_CUSTOM/.zsh-config"
mkdir -pv $ZSH_CUSTOM
mkdir -pv $ZSH_CONFIG

if [ $zsh_config = 'y' ]; then
    package_name="zsh config"
    echo -e "${INFO}Install ${package_name}..."
    # check zsh is installed
    if ! command_exists 'zsh' ; then # if command exist
        echo -e "${ERROR}you need to install zsh first"
        echo -e "       on Ubuntu, use ${MAGENTA}sudo apt install -y zsh${NC}, and use ${MAGENTA}chsh -s \$(which zsh) \$USER${NC} to set zsh as default shell"
        exit 1
    fi
    
    cmd="ln -sf $BASEDIR/.zshrc $HOME"
    run_cmd ".zshrc" "$cmd"

    cmd="ln -sf $BASEDIR/.zsh_aliases $ZSH_CONFIG"
    run_cmd ".zsh_aliases" "$cmd"

    cmd="ln -sf $BASEDIR/package.zsh $ZSH_CONFIG"
    run_cmd "package.zsh" "$cmd"

    cmd="ln -sf $BASEDIR/.p10k.zsh $HOME"
    run_cmd ".p10k.zsh" "$cmd"

    # remove site-functions
    echo -e "${BLUE}Remove site-functions...${NC}"
    rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/zsh/site-functions/"*
fi
