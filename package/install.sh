#!/bin/bash
source ./functions.sh

if [ $useful_package = 'y' ]; then
	declare -a package=( # "<command>" "<package>"
      "fzf"       "fzf"
      "exa"       "exa"
      "tmux"      "tmux"
      "batcat"    "bat"
      "zoxide" 	  "zoxide"
      "rg"        "ripgrep"
      "aria2c"    "aria2"
      "fdfind"    "fd-find"
      "fuck"      "thefuck"
    )
    
    for ((i=0; i<${#package[@]}; i+=2)); do
        if ! command_exists ${package[$i]} ; then
            sudo apt install -y ${package[$(($i+1))]}
        fi
    done
fi
