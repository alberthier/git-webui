#!/bin/sh

cd $HOME
rm -rf .git-webui 2>&1 > /dev/null
echo "Cloning git-webui repository"
git clone git@bitbucket.org:alberthier/git-webui.git .git-webui
echo "Installing 'webui' alias"
git config --global --replace-all alias.webui !$HOME/.git-webui/release/libexec/git-core/git-webui
echo "Enabling auto update"
git config --global --replace-all webui.autoupdate true
