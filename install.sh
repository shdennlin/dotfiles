#! /bin/sh


install_A_check='_'
echo -n "Do you want to install all(y/n): "
read install_A_check
while [[ $install_A_check != @('y'|'n') ]];
do
    echo -n "(INV Ans)Do you want to install all(y/n): "
    read install_A_check
done
echo -e ''

check_and_link(){
    check='_'
    if [[ $install_A_check = 'y' ]]; then
        check='y'
    else
        echo -n "Do you want to link $1 (y/n): "
        read check
    fi
    while [[ $check != @('y'|'n') ]];
    do
        echo -n "(INV Ans)Do you want to link $1 (y/n): "
        read check
    done
    if [ $check = 'y' ] ; then
        ln -f ./$1 ~/$1
        echo -e "$1: \tlink $1 successful"
    fi
}

link_map_to_home(){
    sudo cp '/usr/share/X11/xkb/keycodes/evdev' './xkb/evdev.backup'
    sudo cp './xkb/evdev' '/usr/share/X11/xkb/keycodes/'
    sudo dpkg-reconfigure xkb-data
    echo -e 'keymap: \tchange keyboards configuration successful'
}

change_key_map(){
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
    if [[ ${machine} = "Linux" &&  ! -f "$FILE" ]]; then
        if [[ $install_A_check = 'y' ]]; then
            check='y'
        else
            echo -n "Do you want to change change the R_ctrl and R_alt buttons(y/n): "
            read check
        fi
        if [ $check = 'y' ] ; then
            link_map_to_home
        fi
        while [[ $check != @('y'|'n') ]];
        do
            echo -n "(INV Ans)Do you want to change change the R_ctrl and R_alt buttons(y/n): "
            read check
            if [ $check = 'y' ] ; then
                link_map_to_home
            fi
        done
    else
        echo "keymap: already change keyboards configuration"
    fi
}


### ================= change key map =================
## chack OS and Ask user if they want to change the R_ctrl and R_alt buttons
change_key_map
check_and_link ".gitconfig"
check_and_link ".vimrc"
check_and_link ".bash_aliases"
