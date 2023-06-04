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

    # install ohmyzsh
    if [ ! -d "$HOME/.oh-my-zsh" ] ; then
        sudo apt install -y curl
        sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended --keep-zshrc
    fi
    if [[ ! "zsh" == $(grep "^$USER" /etc/passwd | sed 's/.*://' | sed 's/.*\///') ]] ; then
        chsh -s $(which zsh)
    fi

    # install theme
    dir="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k"
    echo -e "${INFO} process powerlevel10k"
    if [ ! -d $dir ] ; then
        git clone --depth=1 https://github.com/romkatv/powerlevel10k.git $dir
    else
        cd $dir && git pull && cd - > /dev/null
    fi

    # install plugins
    declare -a plugins=(
        #"fzf-tab"                   "https://github.com/Aloxaf/fzf-tab"
        "zsh-autopair"              "https://github.com/hlissner/zsh-autopair.git"
        "zsh-autosuggestions"       "https://github.com/zsh-users/zsh-autosuggestions.git"
        "zsh-autocomplete"          "https://github.com/marlonrichert/zsh-autocomplete.git"
        "zsh-syntax-highlighting"   "https://github.com/zsh-users/zsh-syntax-highlighting.git"
        )
    for ((i=0; i<${#plugins[@]}; i+=2)); do
        dir="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/${plugins[$i]}"
        echo -e "${INFO} process ${plugins[$i]}"
        if [ ! -d $dir ] ; then
            git clone --depth=1 ${plugins[$(($i+1))]} $dir
        else
            echo -e "${plugins[$i]}\t"
            cd $dir && git pull && cd - > /dev/null
        fi
    done
fi
