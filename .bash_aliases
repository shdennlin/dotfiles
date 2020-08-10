command_exists () {
    type "$1" &> /dev/null ;
}

# show git branch in terminal
export PS1='\[\033[01;32m\]\[\033[0m\033[0;32m\]\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]$(__git_ps1)$ '
# ============alias=============

if command_exists bpytop ; then
    alias top='bpytop'
fi

alias ca='conda activate'
alias catg='conda activate tf-gpu'

alias cl='clear'
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias ......='cd ../../../../..'

# slove emacs Chinese display problem
alias emacs='env LC_CTYPE=zh_CN.UTF-8 emacs'

alias g='git'
alias gp='grep -E'
alias gd='gdrive'

alias l='ls --color=always'
alias ll='ls -lhF --color=always'
alias la='ls -AF --color=always'
alias lal='ls -lAhF --color=always'
alias lls='ls -lAhF --color=always | less -r'

alias less='less -r'

alias psgp='ps -ef | gp -E'
alias k9='kill -9'

alias vi='vim'

# ============ path =============
export PATH=$PATH:/usr/local/go/bin
export GOBIN=$GOPATH/bin
