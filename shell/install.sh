#!/bin/bash
source ./functions.sh

BASEDIR=$(dirname "$0")

if [ $alias_file = 'y' ]; then
    $cl -f $BASEDIR/.aliases $HOME
    $cl -f $BASEDIR/.bash_aliases $HOME
    $cl -f $BASEDIR/.tmux.conf $HOME
    echo -e "${INFO}${cl} -f .aliases successful"
    echo -e "${INFO}${cl} -f .bash_aliases successful"
    echo -e "${INFO}${cl} -f .tmux.conf successful"
fi

if [ $zsh = 'y' ]; then
    $cl -f $BASEDIR/.zshrc $HOME
    echo -e "${INFO}${cl} -f .zshrc successful"
    $cl -f $BASEDIR/.zsh_aliases $HOME
    echo -e "${INFO}${cl} -f .zsh_aliases successful"
    $cl -f $BASEDIR/.p10k.zsh $HOME
    echo -e "${INFO}${cl} -f .p10k.zsh successful"

    # install zsh
    if ! command_exists 'zsh' ; then # if command exist
        sudo apt install -y zsh
        # set zsh as default in user
        sudo chsh -s /bin/zsh $USER
    fi
fi
