#!/bin/bash
source ./functions.sh

if [ $useful_package = 'y' ]; then
	declare -a package=( # "<command>" "<package>"
		"fzf"       "fzf"
        "exa"       "exa"
        "tmux"      "tmux"
        "batcat"    "bat"
		"zoxide" 	"zoxide"
		"ag"		"silversearcher-ag"
        )
    for ((i=0; i<${#package[@]}; i+=2)); do
        if ! command_exists ${package[$i]} ; then
            sudo apt install -y ${package[$(($i+1))]}
        fi
    done

    if ! command_exists 'fasd' ; then
        if [[ "debian" == $(cat /etc/os-release | grep "ID_LIKE") ]] ; then
            sudo add-apt-repository ppa:aacebedo/fasd
        fi
        sudo apt install -y fasd
    fi
fi