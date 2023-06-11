#!/bin/bash
source ./functions.sh

if [ $useful_package = 'y' ]; then
    package_name="useful-packages"
    echo -e "${INFO}Install/Upgrade ${package_name} config..."
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
    echo -e "${BLUE}package list:${GREEN}${all_package}${NC}"

    cmd="sudo apt install -qq -y${all_package}"
    echo -e "${MAGENTA}${cmd}${NC}"
    eval $cmd
    if [ $? -ne 0 ]; then
        echo -e "${ERROR}command ${MAGENTA}${cmd}${NC} failed"
        exit 1
    else
        echo -e "${INFO}Install/Upgrade useful-packages successful"
    fi
    exit 0
fi
