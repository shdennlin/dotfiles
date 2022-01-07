#!/bin/bash

BASEDIR=$(dirname "$0")
if [ $vim_config = 'y' ]; then
    $cl -f $BASEDIR/.vimrc $HOME
    echo -e "${INFO}${cl} -f .vimrc successful"
fi

if [ $ideavimrc = 'y' ]; then
    $cl -f $BASEDIR/.ideavimrc $HOME
    echo -e "${INFO}${cl} -f .ideavimrc successful"
fi
