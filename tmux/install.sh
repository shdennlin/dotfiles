#!/bin/bash

BASEDIR=$(dirname "$0")
if [ $tmux_config = 'y' ]; then
    $cl -f $BASEDIR/.tmux.conf $HOME
    echo -e "${INFO}${cl} -f .tmux.conf successful"
fi