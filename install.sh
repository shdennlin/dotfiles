#!/bin/bash

export NC='\033[0m' # No Color
export GREEN='\033[0;32m'
export YELLO='\033[0;33m'
export RED='\033[0;31m'

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

export git=$(read_env "git")
export zsh=$(read_env "zsh")
export vim_config=$(read_env "vim_config")
export tmux_config=$(read_env "tmux_config")
export keymap=$(read_env "keymap")
export useful_package=$(read_env "useful_package")

set -e
#===== install =====
./git/install.sh
./package/install.sh
./shell/install.sh
./vim/install.sh
./tmux/install.sh
./xkb/install.sh
