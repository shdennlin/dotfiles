#!/bin/sh

NC='\033[0m' # No Color
GREEN='\033[0;32m'
YELLO='\033[0;33m'
RED='\033[0;31m'

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
export alias_file=$(read_env "alias_file")
export zsh=$(read_env "zsh")
export vim_config=$(read_env "vim_config")
export keymap=$(read_env "keymap")


set -e
#===== install =====
./git/install.sh
./shell/install.sh
./vim/install.sh
./xkb/install.sh
