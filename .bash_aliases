# show git branch in terminal
export PS1='\[\033[01;32m\]\[\033[0m\033[0;32m\]\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]$(__git_ps1)$ '

# ============alias=============
alias ca='conda activate'

alias cl='clear'
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias ......='cd ../../../../..'

# slove emacs Chinese display problem
alias emacs='env LC_CTYPE=zh_CN.UTF-8 emacs'

alias g='git'
alias gp='grep'

alias l='ls -F --color'
alias ll='ls -lhF --color'
alias la='ls -AF --color'
alias lal='ls -lAhF --color'
alias lls='ls -lAhF --color | less -r'

alias less='less -r'

alias psgp='ps -ef | gp '

alias vi='vim'
# ================== terminal initial===================
bash ~/Desktop/shawn_startup.sh
