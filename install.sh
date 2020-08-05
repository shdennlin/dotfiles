#! /bin/sh

install_A_check='_'
echo -n "Do you want to install all(y/n): "
read install_A_check
while [[ $install_A_check != @('y'|'n') ]];
do
    echo -n "(Invalid Ans)Do you want to install all(y/n): "
    read install_A_check
done
echo -e ''

### ================= change key map =================
## chack OS and Ask user if they want to change the R_ctrl and R_alt buttons
unameOut="$(uname -s)"
case "${unameOut}" in
    Linux*)     machine=Linux;;
    Darwin*)    machine=Mac;;
    CYGWIN*)    machine=Cygwin;;
    MINGW*)     machine=MinGw;;
    *)          machine="UNKNOWN:${unameOut}"
esac

check='_'
FILE='./xkb/evdev.backup'
if [[ ${machine} = "Linux" && ! -f "$FILE" ]]; then
    if [[ $install_A_check = 'y' ]]; then
        check='y'
    else
        echo -n "Do you want to change change the R_ctrl and R_alt buttons(y/n): "
        read check
    fi
    if [ $check = 'y' ] ; then
        sudo cp '/usr/share/X11/xkb/keycodes/evdev' './xkb/evdev.backup'
        sudo cp './xkb/evdev' '/usr/share/X11/xkb/keycodes/'
        sudo dpkg-reconfigure xkb-data
        echo -e 'keymap: \tchange keyboards configuration successful'
    fi
    while [[ $check != @('y'|'n') ]];
    do
        echo -n "(Invalid Ans)Do you want to change change the R_ctrl and R_alt buttons(y/n): "
        read check
        if [ $check = 'y' ] ; then
            sudo cp '/usr/share/X11/xkb/keycodes/evdev' './xkb/evdev.backup'
            sudo cp './xkb/evdev' '/usr/share/X11/xkb/keycodes/'
            sudo dpkg-reconfigure xkb-data
            echo -e 'keymap: \tchange keyboards configuration successful'
        fi
    done
else
    echo "keymap: already change keyboards configuration"
fi


### ================= overwrite .gitconfig =================
check='_'
if [[ $install_A_check = 'y' ]]; then
    check='y'
else
    echo -n "Do you want to link .gitconfig(y|n): "
    read check
fi
while [[ $check != @('y'|'n') ]];
do
    echo -n "(Invalid Ans)Do you want to link .gitconfig(y|n): "
    read check
done
if [ $check = 'y' ] ; then
    ln -f ./.gitconfig ~/.bash_aliases
    echo -e ".gitconfig: \tlink .gitconfig \tsuccessful"
fi


### ================= overwrite .vimrc =================
check='_'
if [[ $install_A_check = 'y' ]]; then
    check='y'
else
    echo -n "Do you want to link .vimrc(y|n): "
    read check
fi
while [[ $check != @('y'|'n') ]];
do
    echo -n "(Invalid Ans)Do you want to link .vimrc(y|n): "
    read check
done
if [ $check = 'y' ] ; then
    ln -f ./.vimrc ~/.vimrc
    echo -e ".vimrc: \tlink .vimrc \t\tsuccessful"
fi


### ================= overwrite .bash_aliases =================
check='_'
if [[ $install_A_check = 'y' ]]; then
    check='y'
else
    echo -n "Do you want to link .bash_aliases(y|n): "
    read check
fi
while [[ $check != @('y'|'n') ]];
do
    echo -n "(Invalid Ans)Do you want to link .bash_aliases(y|n): "
    read check
done
if [ $check = 'y' ] ; then
    ln -f ./.bash_aliases ~/.bash_aliases
    echo -e ".bash_aliases: \tlink .bash_aliases \tsuccessful"
fi
