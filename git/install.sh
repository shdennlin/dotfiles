#!/bin/bash

source ./functions.sh
BASEDIR=$(dirname $(realpath "$0"))

if [ $git_config == "y" ]; then
    package_name="git config"
    echo -e "${INFO}Install ${package_name}..."
    cmd="ln -sf ${BASEDIR}/.gitconfig ${HOME}"
    run_cmd "$package_name" "$cmd"
    exit 0
fi
