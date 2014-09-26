# Git WebUI

This git extension is a standalone web based user interface for git repositories.

It comes with history and tree browsing. You may also use it to commit
as it comes with an UI to review local changes and the ability to stage / unstage code.

Moreover as git-webui is a web server, your repository is accessible to
other people on the same network. They can clone or pull your code using the
same URL.

It has very few dependencies, you probably already have them on your
Mac / Linux : git, python, and a web browser.

## Installation

### Automatic (Do you trust me ?)

The following command will install git-webui in `$HOME/.git-webui` and add a
`webui` alias to your global `.gitconfig` file.

*Note for Windows users:* These install scripts work for you too. Run them from your Git-Bash shell.
You need to install [Python](https://www.python.org/downloads/) first.

Using curl (Mac OS X & Windows):
```
curl https://raw.githubusercontent.com/alberthier/git-webui/master/install/installer.sh | bash
```

Using wget (Linux):
```
wget -O - https://raw.githubusercontent.com/alberthier/git-webui/master/install/installer.sh | bash
```

Upon installation git-webui will update itself automatically every couple of weeks.
You can deactivate auto-update by removing the `autoupdate = true` line from the
`webui` section of your global `.gitconfig` file.

### Manual

Simply clone the repository and install the alias

```
git clone https://github.com/alberthier/git-webui.git
git config --global alias.webui \!$PWD/git-webui/release/libexec/git-core/git-webui
```

If you want to allow auto-update:
```
git config --global webui.autoupdate true
```

## Usage

### Starting

First cd to any of your project versioned with git
```
cd <my-local-git-clone>
git webui
```

This will start an embedded HTTP server and open your default browser with the GUI.

### History Viewing

The toolbar on the left shows your branches and tags. The log of the currently selected one is displayed.

When selecting a revision the diff of this specific commit is displayed in the right panel.

![Image of log commit](https://raw.githubusercontent.com/alberthier/git-webui/master/src/share/git-webui/webui/img/doc/log-commit.png)

On top of the right panel, you can choose 'Tree' to display the versioned content at the specific
revision selected in the left panel. You can browse through directories and display file contents.

![Image of log tree](https://raw.githubusercontent.com/alberthier/git-webui/master/src/share/git-webui/webui/img/doc/log-tree.png)

### Remote access

Other people on your network have read-only access to your repository:
they may access to the web interface (without 'Workspace'), clone or pull from your repository.
All this through the same url:

Clone:
```
$ git clone http://<ip_of_the_computer_running_webui>:8000/ repo_name
```

Pull:
```
$ git pull http://<ip_of_the_computer_running_webui>:8000/
```

### Commit

Commits can only be made from localhost.

![Image of the workspace](https://raw.githubusercontent.com/alberthier/git-webui/master/src/share/git-webui/webui/img/doc/workspace.png)

- **Working copy** lists the modified files (compared to the staging area) in your working directory
- **Message** lets you enter a commit message
- **Staging area** lists the modified files (compared to HEAD) in your staging area. These are the changes that will be committed

The diff view lets you review the differences of the selected file.
In this view you can stage/unstage code in more fine grained way:

- `Ctrl+Click` on an added or removed line stages/unstages the line
- `Ctrl+Click` on an hunk header (purple line) stages/unstages the complete hunk

## Dependencies

### Runtime

- git (of course :) )
- python 2.7+ or python 3.0+ (Generally already installed on your Mac / Linux)
- An up-to-date modern browser

### Development

- Runtime dependencies and ...
- node.js
- grunt-cli

## Uninstallation

### Automatic

Using curl (Mac OS X & Windows):
```
curl https://raw.githubusercontent.com/alberthier/git-webui/master/install/uninstaller.sh | bash
```

Using wget (Linux):
```
wget -O - https://raw.githubusercontent.com/alberthier/git-webui/master/install/uninstaller.sh | bash
```

### Manual

```
rm -rf <git-webui-clone-path>
git config --global --unset-all alias.webui
git config --global --remove-section webui
```

## Contributing

You can clone the source code of [git-webui on GitHub](https://github.com/alberthier/git-webui)

## Packaging

If you want to build a DEB, RPM or Homebrew package for git-webui, you only need the content of the `release` folder.
Installing git-webui globally on the system is nothing else than
```
cp -rf release/* /usr
```

## Author

[Éric ALBER](mailto:eric.alber@gmail.com) ([@eric_alber](https://twitter.com/eric_alber))

## License

This software is licensed under the [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0.html) license
