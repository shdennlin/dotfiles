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
