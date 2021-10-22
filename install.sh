#!/bin/sh

NC='\033[0m' # No Color
GREEN='\033[0;32m'
YELLO='\033[0;33m'
RED='\033[0;31m'

INFO="${GREEN}INFO: ${NC}"
WARNING="${YELLO}WARNING: ${NC}"
ERROR="${RED}ERROR: ${NC}"

print_var(){
    eval "var=$1"
    eval echo "$1=\${${var}}"
}

read_env () {
    echo $(grep -v '^#' .env | grep -e "$1" | sed -e 's/.*=//')
}

#===== check env file =====
if [ ! -f .env ]; then
    echo ".env file not detect, please copy .env.example to .env and conf"
    exit
fi

#===== check install file =====
computer_type=$(read_env "computer_type")
if [ $computer_type = 'm' ]; then #master or slave
    cl='link'
else
    cl='cp'
fi

git=$(read_env "git")
alias_file=$(read_env "alias_file")
vim_config=$(read_env "vim_config")
ideavimrc=$(read_env "ideavimrc")
zsh=$(read_env "zsh")
keymap=$(read_env "keymap")

#===== install =====

command_exists () {
    command -v "$1" >/dev/null 2>&1
}

if [ $git = 'y' ]; then
    if [ $computer_type = 'm' ]; then
        ln -f .gitconfig $HOME
        echo "${INFO}link .gitconfig successful"
        if [ -f .gitconfig.local ]; then
            ln -f .gitconfig.local $HOME
            echo "${INFO}link .gitconfig.local successful"
        fi
    else
        cp -f .gitconfig $HOME
        echo "${INFO}cp .gitconfig successful"
        if [ -f .gitconfig.local ]; then
            cp -f .gitconfig.local $HOME
            echo "${INFO}link .gitconfig.local successful"
        fi
    fi
fi

if [ $alias_file = 'y' ]; then
    if [ $computer_type = 'm' ]; then
        ln -f .aliases $HOME
        ln -f .bash_aliases $HOME
        echo "${INFO}link .aliases successful"
        echo "${INFO}link .bash_aliases successful"
    else
        cp -f .aliases $HOME
        cp -f .bash_aliases $HOME
        echo "${INFO}cp .aliases successful"
        echo "${INFO}cp .bash_alias successful"
    fi
fi

if [ $vim_config = 'y' ]; then
    if [ $computer_type = 'm' ]; then
        ln -f .vimrc $HOME
        echo "${INFO}link .vimrc successful"
    else
        cp -f .vimrc_slave $HOME/.vimrc
        echo "${INFO}cp .vimrc_slave successful"
    fi
fi

if [ $ideavimrc = 'y' ]; then
    if [ $computer_type = 'm' ]; then
        ln -f .ideavimrc $HOME
        echo "${INFO}link .ideavimrc successful"
    else
        cp -f .ideavimrc $HOME
        echo "${INFO}cp .ideavimrc successful"
    fi
fi

if [ $zsh = 'y' ]; then
    # install zsh
    if ! command_exists 'zsh' ; then # if command exist
		sudo apt install -y curl
        sudo apt install -y zsh
        # set zsh as default in user
        sudo chsh -s /bin/zsh $USER
        # install ohmyzsh
        sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
        # install theme
        git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
        git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
        git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
        git clone --depth=1 https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:=~/.oh-my-zsh/custom}/plugins/zsh-completions
        git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
        sudo apt install -y autojump
        sudo apt-get install -y fzf
    fi

    if [ $computer_type = 'm' ]; then
        ln -f .zshrc $HOME
        echo "${INFO}link .zshrc successful"
        ln -f .p10k.zsh $HOME
        echo "${INFO}link .p10k.zsh successful"
    else
        cp -f .zshrc $HOME
        echo "${INFO}link .zshrc successful"
        cp -f .p10k.zsh $HOME
        echo "${INFO}link .p10k.zsh successful"
    fi
fi

if [ $keymap = 'y' ] || [ computer_type = 'm' ]; then
    if [ ! -f ./xkb/evdev.backup ]; then
        sudo cp '/usr/share/X11/xkb/keycodes/evdev' './xkb/evdev.backup'
        sudo cp './xkb/evdev' '/usr/share/X11/xkb/keycodes/'
        sudo dpkg-reconfigure xkb-data
        echo "${INFO}keymap: \tchange keyboards configuration successful"
    else
        echo "${WARNING}./xkb/evdev.backup already exist"
    fi
fi
