#!/bin/bash

export NC='\033[0m' # No Color
export BLACK='\033[0;30m'
export GREEN='\033[0;32m'
export YELLO='\033[0;33m'
export RED='\033[0;31m'

export DEBUG="${BLACK}DEBUG: ${NC}"
export INFO="${GREEN}INFO: ${NC}"
export WARNING="${YELLO}WARNING: ${NC}"
export ERROR="${RED}ERROR: ${NC}"

read_env () {
    echo $(grep -v '^#' .env | grep -e "$1" | sed -e 's/.*=//')
}

#===== check env file =====
if [ ! -f .env ]; then
    echo ".env file not detect, please copy .env.example to .env and conf"
    exit
fi

#===== check install file =====
computer_type=$(read_env "computer_type")
if [ $computer_type = 'm' ]; then #master or slave
    export cl='ln'
else
    export cl='cp'
fi

export git_config=$(read_env "git_config")
export useful_package=$(read_env "useful_package")
export neovim_config=$(read_env "neovim_config")
export tmux_config=$(read_env "tmux_config")
export zsh_config=$(read_env "zsh")
export keymap=$(read_env "keymap")

set -e
#===== install =====
./git/install.sh
./package/install.sh
./shell/install.sh
./vim/install.sh
./tmux/install.sh
./xkb/install.sh
