#!/bin/sh

cd $HOME
rm -rf .git-webui 2>&1 > /dev/null
git clone git@bitbucket.org:alberthier/git-webui.git .git-webui
git config --global --replace-all alias.webui !$HOME/.git-webui/release/libexec/git-core/git-webui
