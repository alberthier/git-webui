## Git WebUI

This git extension offers a web-based user interface for a repository.
It provides history and tree browsing. You may also use this interface to commit
as it comes with a diff review UI and the ability to stage / unstage code.
Commits can only be made from localhost.

Moreover as git-webui is also a web server, your repository is accessible to
other people on the same network. They can clone or pull your code using the
same URL.

## Installation & Update

The following command will install git-webui in `$HOME/.git-webui` and add a
`webui` alias to your global `.gitconfig` file

Using curl (Mac OS X):
```
curl https://raw.github.com/alberthier/git-webui/install/installer.sh | bash
```

Using wget (Linux):
```
wget -O - https://raw.github.com/alberthier/git-webui/install/installer.sh | bash
```

## Dependencies

### Runtime
- git (of course :) )
- python 2.7+ or python 3.0+
- An up-to-date modern browser

### Development
- Runtime dependencies and ...
- node.js
- grunt-cli

## Usage

```
$ cd my_git_clone
$ git webui
```

This will start the embedded http server and load show repository viewer in your
default browser.

In this web interface, you can navigate in your history, browse files of each
revision and commit changes

Other people may also clone or pull from your repository through the same url:

Clone:
```
$ git clone http://<ip_of_the_computer_running_webui>:8000/ repo_name
```

Pull:
```
$ git pull http://<ip_of_the_computer_running_webui>:8000/
```

## Warning

Don't serve git webui on internet. Even if security hasn't been neglected, this
project shouldn't be used in an untrusted environment
