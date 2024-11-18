#!/bin/bash

# Define color codes
NC="\033[0m"
INFO="\033[1;32m"      # Green
WARNING="\033[1;33m"   # Yellow
ERROR="\033[1;31m"     # Red
DEBUG="\033[1;34m"     # Blue
FATAL="\033[1;41m"     # Red background
HIGHLIGHT="\033[1;36m" # Cyan
CMD="\033[1;90m"       # Gray
SUCCESS="\033[1;92m"   # Bright Green

if ! command -v git &> /dev/null
then
    echo -e "${FATAL}Git Command Not Found!${NC}"
    echo -e "Please install git using the following command:"
    echo -e "${INFO}MacOS:${HIGHLIGHT} brew install git${NC}"
    echo -e "${INFO}Based on Debian:${HIGHLIGHT} sudo apt-get install git -y${NC}"
    echo -e "${INFO}Based on Fedora:${HIGHLIGHT} sudo dnf install git -y${NC}"
    echo -e "${INFO}Based on Arch:${HIGHLIGHT} sudo pacman -S git --noconfirm${NC}"
    exit 1
fi
