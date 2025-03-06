#!/usr/bin/bash

FUNCTION_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/zsh/site-functions"

if (( $+commands[asdf] )) && [ ! -f $FUNCTION_DIR/_asdf ]; then
    znap fpath _asdf "asdf completion zsh"
    znap compile $FUNCTION_DIR
fi

if (( $+commands[chezmoi] )) && [ ! -f $FUNCTION_DIR/_chezmoi ]; then
    znap fpath _chezmoi "chezmoi completion zsh"
    znap compile $FUNCTION_DIR
fi

if (( $+commands[croc] )) && [ ! -f $FUNCTION_DIR/_croc ]; then
    znap fpath _croc "curl https://raw.githubusercontent.com/schollz/croc/main/src/install/zsh_autocomplete"
elif (( $+commands[croc] )); then
    PROG=croc
    CLI_ZSH_AUTOCOMPLETE_HACK=1
    source $FUNCTION_DIR/_croc
fi

if (( $+commands[gh] )) && [ ! -f $FUNCTION_DIR/_gh ]; then
    znap fpath _gh "gh completion -s zsh"
    znap compile $FUNCTION_DIR
fi

if (( $+commands[navi] )); then
    eval "$(navi widget zsh)"
fi

if (( $+commands[poetry] )) && [ ! -f $FUNCTION_DIR/_poetry ]; then
    znap fpath _poetry "poetry completions zsh"
    znap compile $FUNCTION_DIR
fi

if (( $+commands[rg] )) && [ ! -f $FUNCTION_DIR/_rg ]; then
    znap fpath _rg "rg --generate=complete-zsh"
    znap compile $FUNCTION_DIR
fi

if (( $+commands[thefuck] || $+commands[fuck] )); then
    znap function _fuck fuck 'eval $(thefuck --alias)'
    compdef _fuck fuck
fi

if (( $+commands[zoxide] )); then
    eval "$(zoxide init zsh)"
fi