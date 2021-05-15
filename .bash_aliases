alias src='source ~/.bashrc'

alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias ......='cd ../../../../..'

alias g='git'

alias l='ls -alhH --color=always'
alias la='ls -a'
alias ll='ls -lahH --color=always'
alias grep='\grep --color'

# show git branch in terminal
export PS1='\[\033[01;32m\]\[\033[0m\033[0;32m\]\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]$(__git_ps1)$ '

if [ -f ~/.aliases ]; then
    . ~/.aliases
fi
