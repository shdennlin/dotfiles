#!/bin/bash

BASEDIR=$(dirname "$0")
if [ $git == "y" ]; then
    $cl -f $BASEDIR/.gitconfig $HOME
    echo -e "${INFO}${cl} -f .gitconfig successful"
    if [ -f .gitconfig.local ]; then
        $cl -f $BASEDIR/.gitconfig.local $HOME
        echo -e "${INFO}${cl} -f .gitconfig.local successful"
    fi
fi
