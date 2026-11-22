# wsg groups — user-defined named repo subsets for `wsg @<name>`
#
# Syntax:
#   WSG_GROUPS[<name>]="repo1 repo2 repo3"
#
# Each entry in the value is a repo token, resolved the same way as on the
# CLI: a basename (looked up via discovery), an absolute path, or another
# @group-name (recursive).
#
# This file is ONE place to define groups (the default convenience location).
# You don't have to use it — WSG_GROUPS is a global array; equivalent forms:
#
#   # In .zshrc (after wsg.zsh is sourced):
#   WSG_GROUPS[basic]="super-repo docs api-contract"
#
#   # In direnv .envrc (per project) — MUST use WSG_GROUPS_RAW because
#   # direnv runs in bash and can't export zsh assoc arrays:
#   export WSG_GROUPS_RAW="basic=super-repo,docs,api-contract;\
#service=api-contract,core-api,central,frontend"
#
# To relocate this file (Dropbox / XDG / shared), set before sourcing wsg.zsh:
#   export WSG_GROUPS_FILE=$HOME/Dropbox/wsg-groups.zsh
#   export WSG_GROUPS_FILE=$XDG_CONFIG_HOME/wsg/groups.zsh
#
# All sources merge into one namespace. Inspect with: wsg groups
#
# Examples — uncomment and edit to match your workspace:
#
# WSG_GROUPS[payment]="super-repo auth api frontend"
# WSG_GROUPS[auth-refactor]="auth super-repo"
# WSG_GROUPS[infra]="$HOME/work/terraform-main $HOME/work/k8s-config"
