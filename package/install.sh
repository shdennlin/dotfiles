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

    shopt -s nocasematch
    package_tool=""
    pkg_install_cmd=""
    if [[ $platform =~ ("ubuntu"|"debian") ]]; then
        echo "match"
        package_tool="apt"
        pkg_install_cmd="sudo ${package_tool} install -qq -y"
    else
        echo -e "${ERROR}your OS type not support yet install package script"
        exit 1
    fi

    cmd="${pkg_install_cmd}${all_package}"
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
