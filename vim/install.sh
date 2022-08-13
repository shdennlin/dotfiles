#!/bin/bash

BASEDIR=$(dirname "$0")
if [ $vim_config = 'y' ]; then
    if [ $cl = 'ln' ]; then
        $cl -f $BASEDIR/.vimrc $HOME
        echo -e "${INFO}${cl} -f .vimrc successful"
    else
        $cl -f $BASEDIR/.vimrc_slave $HOME/.vimrc
        echo -e "${INFO}${cl} -f .vimrc_slave to ${HOME}/.vimrc successful"
    fi
fi

