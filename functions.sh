#!/bin/bash

command_exists () {
    command -v "$@" >/dev/null 2>&1
}

# run command in terminal
# $1 is the packge name to show
# $2 is the command to run
run_cmd() {
    echo -e "${MAGENTA}${2}${NC}"
    eval $2

    if [ $? -ne 0 ]; then
        echo -e "${ERROR}Install ${1} failed"
        exit 1
    else
        echo -e "${INFO}Install ${1} successful"
    fi
}

# Detect operation system
detect_os() {
    if [ -f /etc/os-release ]; then
        # freedesktop.org and systemd
        . /etc/os-release
        platform=$NAME
    elif type lsb_release >/dev/null 2>&1; then
        # linuxbase.org
        platform=$(lsb_release -si)
    elif [ -f /etc/lsb-release ]; then
        # For some versions of Debian/Ubuntu without lsb_release command
        . /etc/lsb-release
        platform=$DISTRIB_ID
    elif [ -f /etc/debian_version ]; then
        # Older Debian/Ubuntu/etc.
        platform=Debian
    elif [ -f /etc/SuSe-release ]; then
        # Older SuSE/etc.
        platform=SuSE
    elif [ -f /etc/redhat-release ]; then
        # Older Red Hat, CentOS, etc.
        platform=RedHat
    else
        # Fall back to uname, e.g. "Linux <version>", also works for BSD, etc.
        platform=$(uname -s)
    fi

    echo $platform
}