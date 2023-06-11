#!/bin/bash

export NC='\033[0m' # No Color
export GREEN='\033[0;32m'
export YELLO='\033[0;33m'
export BLUE='\033[0;34m'
export MAGENTA='\033[0;35m'
export RED='\033[0;31m'

export INFO="${GREEN}INFO: ${NC}"
export WARNING="${YELLO}WARNING: ${NC}"
export ERROR="${RED}ERROR: ${NC}"

export BASEDIR=$(pwd)

read_env () {
    echo $(grep -v '^#' .env | grep -e "$1" | sed -e 's/.*=//')
}

#===== check env file =====
if [ ! -f .env ]; then
    echo ".env file not detect, please copy .env.example to .env and conf"
    exit
fi

# read config
export git_config=$(read_env "git_config")
export useful_package=$(read_env "useful_package")
export neovim_config=$(read_env "neovim_config")
export tmux_config=$(read_env "tmux_config")
export zsh_config=$(read_env "zsh")
export keymap=$(read_env "keymap")

# set -e
#===== install =====
./package/install.sh && echo "" || echo -e "${ERROR}Install useful package failed\n"
./git/install.sh     && echo "" || echo -e "${ERROR}Install git config failed\n"
./zsh/install.sh     && echo "" || echo -e "${ERROR}Install zsh config failed\n"
./tmux/install.sh    && echo "" || echo -e "${ERROR}Install tmux config failed\n"
./neovim/install.sh  && echo "" || echo -e "${ERROR}Install neovim config failed\n"
./xkb/install.sh     && echo "" || echo -e "${ERROR}Install xkb config failed\n"
exit 0