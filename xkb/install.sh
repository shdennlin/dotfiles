#!/bin/bash

BASEDIR=$(dirname "$0")

if [ $keymap = 'y' ] ; then
    if [ ! -f $BASEDIR/evdev.backup ]; then
        sudo cp "/usr/share/X11/xkb/keycodes/evdev" "$BASEDIR/evdev.backup"
        sudo cp "$BASEDIR/evdev" "/usr/share/X11/xkb/keycodes/"
        sudo dpkg-reconfigure xkb-data
        echo -e "${INFO}keymap: \tchange keyboards configuration successful"
    else
        echo -e "${WARNING}${BASEDIR}/evdev.backup already exist"
    fi
fi
