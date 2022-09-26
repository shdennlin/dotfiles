#!/bin/bash

command_exists () {
    command -v "$@" >/dev/null 2>&1
}