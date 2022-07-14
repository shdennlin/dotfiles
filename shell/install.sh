#!/bin/bash

command_exists () {
    command -v "$@" >/dev/null 2>&1
}

BASEDIR=$(dirname "$0")

if [ $alias_file = 'y' ]; then
    $cl -f $BASEDIR/.aliases $HOME
    $cl -f $BASEDIR/.bash_aliases $HOME
    echo -e "${INFO}${cl} -f .aliases successful"
    echo -e "${INFO}${cl} -f .bash_aliases successful"
fi

if [ $zsh = 'y' ]; then
    # install zsh
    if ! command_exists 'zsh' ; then # if command exist
        sudo apt install -y zsh
        # set zsh as default in user
        sudo chsh -s /bin/zsh $USER
    fi

    # install ohmyzsh
    if [ ! -d "$HOME/.oh-my-zsh" ] ; then
        sudo apt install -y curl
        sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended --keep-zshrc
    fi
    if [[ ! "zsh" == $(grep "^$USER" /etc/passwd | sed 's/.*://' | sed 's/.*\///') ]] ; then
        chsh -s $(which zsh)
    fi

    # install theme and plugins
    if [ ! -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k" ] ; then
        git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
    fi
    if [ ! -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions" ] ; then
        git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
    fi
    if [ ! -d "${ZSH_CUSTOM:=$HOME/.oh-my-zsh/custom}/plugins/zsh-completions" ] ; then
        git clone --depth=1 https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:=~/.oh-my-zsh/custom}/plugins/zsh-completions
    fi
    if [ ! -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions" ] ; then
        git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
    fi
    if [ ! -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting" ] ; then
        git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
    fi

    if ! command_exists 'fasd' ; then
        if [[ "debian" == $(cat /etc/os-release | grep "ID_LIKE") ]] ; then
            sudo add-apt-repository ppa:aacebedo/fasd
        fi
        sudo apt install -y fasd
    fi
    if ! command_exists 'fzf' ; then
        sudo apt install -y fzf
    fi

    $cl -f $BASEDIR/.zshrc $HOME
    echo -e "${INFO}${cl} -f .zshrc successful"
    $cl -f $BASEDIR/.zsh_aliases $HOME
    echo -e "${INFO}${cl} -f .zsh_aliases successful"
    $cl -f $BASEDIR/.p10k.zsh $HOME
    echo -e "${INFO}${cl} -f .p10k.zsh successful"
fi
