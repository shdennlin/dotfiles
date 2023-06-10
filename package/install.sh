#!/bin/bash
source ./functions.sh

if [ $useful_package = 'y' ]; then
	declare -a packages=( 
        # "<command>" "<package>"
        "aria2c"    "aria2"
        "batcat"    "bat"
        "exa"       "exa"
        "fdfind"    "fd-find"
        "fzf"       "fzf"
        "rg"        "ripgrep"
        "thefuck"   "thefuck"
        "tmux"      "tmux"
        "zoxide"    "zoxide"
        )

    all_package=""
    for (( i=0; i<${#packages[@]}; i+=2 )); do
        all_package="${all_package} ${packages[$(($i+1))]}"
    done
    echo -e "${INFO}Start install/upgrade packages, package list:\n${GREEN}${all_package}${NC}"

    cmd="sudo apt install -qq -y${all_package}"
    echo -e "${BLACK}${cmd}${NC}"
    eval $cmd
    if [ $? -ne 0 ]; then
        echo -e "${ERROR}command ${BLACK}${cmd}${NC} failed"
        exit 1
    else
        echo -e "${INFO}install/upgrade packages successful"
    fi
fi
