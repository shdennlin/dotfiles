#!/bin/bash
source ./functions.sh

check_package_tool() {
    if ! command_exists $1; then
        echo -e "${ERROR}Package Manager ${MAGENTA}${1}${NC} not found"
        exit 1
    fi
}

if [ $useful_package = 'y' ]; then
    package_name="useful-packages"
    echo -e "${INFO}Install/Upgrade ${package_name} config..."
    packages=("aria2" "bat" "exa" "fd" "fzf" "ripgrep" "thefuck" "tmux" "zoxide")

    shopt -s nocasematch
    package_tool=""
    pkg_install_cmd=""
    # Change the package name to correspond to the relative OS
    for (( i=0; i<${#packages[@]}; i++ )); do
        if [[ $platform =~ ("debian"|"ubuntu"|"kali") ]]; then
            package_tool="apt"
            pkg_install_cmd="sudo ${package_tool} install -qq -y"

            if [[ ${packages[i]} == "fd" ]]; then
                packages[i]="fd-find"
            fi
	
        elif [[ $platform =~ "arch" ]]; then
            package_tool="pacman"
            pkg_install_cmd="sudo ${package_tool} -S"

        elif [[ $platform =~ "darwin" ]]; then
            package_tool="brew"
            check_package_tool $package_tool
            pkg_install_cmd="${package_tool} install --quiet"
        else
            echo -e "${ERROR}your OS type not support yet install package script"
            exit 1
        fi
    done

    all_package=${packages[@]}
    echo -e "${BLUE}package list: ${GREEN}${all_package}${NC}"

    cmd="${pkg_install_cmd} ${all_package}"
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
