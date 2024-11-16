#!/bin/bash

source ./functions.sh
BASEDIR=$(dirname $(realpath "$0"))

if [ $tmux_config = 'y' ]; then
    package_name="tmux config"
    echo -e "${INFO}Install ${package_name}..."
    cmd="ln -f ${BASEDIR}/.tmux.conf ${HOME}"
    run_cmd "$package_name" "$cmd"
fi