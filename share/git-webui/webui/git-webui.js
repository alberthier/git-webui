"use strict"

var webui = webui || {};

webui.git = function(cmd, callback) {
    $.post("git", cmd, function(data, status, xhr) {
        if (xhr.status == 200) {
            if (callback) {
                callback(data);
            }
        } else {
            console.log(status + " " + data);
        }
    }, "text")
    .fail(function(xhr, status, error) {
        console.log(status + " "  + error);
    });
};

webui.splitLines = function(data) {
    return data.split("\n").filter(function(s) { return s.length > 0; })
}

/*
 * == SideBarView =============================================================
 */
webui.SideBarView = function(mainView) {

    this.mainView = mainView;
    var sideBarView = this;
    this.element = $(   '<div id="sidebar">' +
                            '<img id="sidebar-logo" src="git-logo.svg">' +
                            '<div id="sidebar-content">' +
                                '<h1 id="sidebar-workspace">Workspace</h1>' +
                                '<div id="sidebar-branches" style="display: none;">' +
                                    '<h1>Branches</h1>' +
                                    '<ul></ul>' +
                                '</div>' +
                                '<div id="sidebar-tags" style="display: none;">' +
                                    '<h1>Tags</h1>' +
                                    '<ul></ul>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
    var contentElement = $("#sidebar-content", this.element)[0];
    var workspaceElement = $("#sidebar-workspace", this.element)[0];

    $(workspaceElement).click(function (event) {
        sideBarView.select(workspaceElement);
        sideBarView.mainView.workspaceView.update();
    });

    webui.git("branch", function(data) {
        var branches = webui.splitLines(data);
        if (branches.length > 0) {
            var branchesElement = $("#sidebar-branches", sideBarView.element)[0];
            branchesElement.style.display = "block";
            var ul = $("ul", branchesElement)[0];
            branches.forEach(function (branch) {
                var name = branch.substr(2);
                var li = $("<li>" + name + "</li>").appendTo(ul)[0];
                li.name = name;
                $(li).click(function (event) { sideBarView.select(li); });
                if (branch.substr(0, 1) == "*") {
                    $(li).addClass("branch-current")
                    window.setTimeout(function() {
                        sideBarView.select(li);
                    }, 0);
                }
            });
        }
    });

    webui.git("tag", function(data) {
        var tags = webui.splitLines(data);
        if (tags.length > 0) {
            var tagsElement = $("#sidebar-tags", sideBarView.element)[0];
            tagsElement.style.display = "block";
            var ul = $("ul", tagsElement)[0];
            content.appendChild(ul);
            tags.forEach(function (tag) {
                var li = $("<li>" + tag + "</li>").appendTo(ul)[0];
                li.name = tag;
                $(li).click(function (event) { sideBarView.select(li); });
            });
        }
    });

    this.select = function(node) {
        var selected = $(".selected", contentElement);
        if (selected.length > 0) {
            selected = selected[0];
        } else {
            selected = undefined;
        }
        if (selected != node) {
            if (selected != undefined) {
                $(selected).toggleClass("selected");
            }
            $(node).toggleClass("selected");
            if (node.tagName == "LI") {
                // TODO: find a better way to distinguish history viewer and working copy nodes
                this.mainView.historyView.update(node.name);
            }
        }
    };
};

/*
 * == LogView =================================================================
 */
webui.LogView = function(historyView) {

    var logView = this;
    this.historyView = historyView;
    this.element = $('<div id="log-view">')[0];
    var currentSelection = null;

    this.update = function(ref) {
        $(this.element).empty();
        webui.git("log --pretty=raw --decorate " + ref, function(data) {
            var start = 0;
            while (true) {
                var end = data.indexOf("\ncommit ", start);
                if (end != -1) {
                    var len = end - start;
                } else {
                    var len = undefined;
                }
                var entry = new Entry(data.substr(start, len));
                logView.element.appendChild(entry.element);
                if (!currentSelection) {
                    entry.select();
                }
                if (len == undefined) {
                    break;
                }
                start = end + 1;
            }
        });
    };

    function Person(data) {
        var nameEnd = data.indexOf("<");
        this.name = data.substr(0, nameEnd - 1);
        var emailEnd = data.indexOf(">", nameEnd);
        this.email = data.substr(nameEnd + 1, emailEnd - nameEnd - 1);
        var dateEnd = data.indexOf(" ", emailEnd + 2);
        var secs = data.substr(emailEnd + 2, dateEnd - emailEnd - 2);
        this.date = new Date(0);
        this.date.setUTCSeconds(parseInt(secs));
    };

    function Entry(data) {
        this.parents = [];
        this.message = ""
        var entry = this;

        data.split("\n").forEach(function(line) {
            if (line.indexOf("commit ") == 0) {
                entry.commit = line.substr(7, 40);
                if (line.length > 47) {
                    entry.refs = []
                    var s = line.lastIndexOf("(") + 1;
                    var e = line.lastIndexOf(")");
                    line.substr(s, e - s).split(", ").forEach(function(ref) {
                        entry.refs.push(ref);
                    });
                }
            } else if (line.indexOf("parent ") == 0) {
                entry.parents.push(line.substr(7));
            } else if (line.indexOf("tree ") == 0) {
                entry.tree = line.substr(5);
            } else if (line.indexOf("author ") == 0) {
                entry.author = new Person(line.substr(7));
            } else if (line.indexOf("committer ") == 0) {
                entry.committer = new Person(line.substr(10));
            } else if (line.indexOf("    ") == 0) {
                entry.message += line.substr(4) + "\n";
            }
        });

        this.message = this.message.trimRight();

        this.abbrevCommitHash = function() {
            return this.commit.substr(0, 7);
        };

        this.abbrevMessage = function() {
            var end = this.message.indexOf("\n");
            if (end == -1) {
                return this.message
            } else {
                return this.message.substr(0, end);
            }
        };

        this.createElement = function() {
            this.element = $('<div class="log-entry">' +
                                 '<div class="log-entry-header">' +
                                     '<a class="log-entry-name" target="_blank" href="mailto:' + this.author.email + '">' + this.author.name + '</a> ' +
                                     '<span  class="log-entry-date">' + this.author.date.toLocaleString() + '</span> ' +
                                     '<pre class="log-entry-hash">' + this.abbrevCommitHash() + '</pre>' +
                                 '</div>' +
                                 '<div class="log-entry-message"></div>' +
                             '</div>')[0];
            $(".log-entry-message", this.element)[0].appendChild(document.createTextNode(this.abbrevMessage()));
            this.element.model = this;
            var model = this;
            $(this.element).click(function (event) {
                model.select();
            });
            return this.element;
        };

        this.select = function() {
            if (currentSelection != this) {
                if (currentSelection) {
                    $(currentSelection.element).removeClass("selected");
                }
                $(this.element).addClass("selected");
                currentSelection = this;
                logView.historyView.commitView.update(this);
            }
        };

        this.createElement();
    };
};

/*
 * == DiffView ================================================================
 */
webui.DiffView = function(parent) {

    this.element = $('<div class="diff-view">')[0];

    this.update = function(diff) {
        $(this.element).empty();

        var inHeader = true;
        var diffLines = diff.split("\n");
        for (var i = 0; i < diffLines.length; ++i) {
            var line = diffLines[i];
            var pre = $('<pre class="diff-view-line">').appendTo(this.element)[0];
            pre.appendChild(document.createTextNode(line));
            var c = line[0];
            if (c == '+') {
                $(pre).addClass("diff-line-add");
            } else if (c == '-') {
                $(pre).addClass("diff-line-del");
            } else if (c == '@') {
                $(pre).addClass("diff-line-offset");
                inHeader = false;
            } else if (c == 'd') {
                inHeader = true;
            }
            if (inHeader) {
                $(pre).addClass("diff-line-header");
            }
        }
    };
};

/*
 * == CommitView ==============================================================
 */
webui.CommitView = function(historyView) {

    this.historyView = historyView;
    var currentObject = null;
    this.element = $('<div id="commit-view">')[0];

    this.update = function(entry) {
        if (currentObject == entry.commit) {
            // We already display the right data. No need to update.
            return;
        }
        currentObject = entry.commit;
        $(this.element).empty();

        var diffView = new webui.DiffView(this);
        this.element.appendChild(diffView.element);
        webui.git("show " + entry.commit, function(data) {
            diffView.update(data);
        });
    };
};

/*
 * == HistoryView =============================================================
 */
webui.HistoryView = function(mainView) {

    var historyView = this;
    this.element = $('<div id="history-view">')[0];

    this.logView = new webui.LogView(this);
    this.element.appendChild(this.logView.element);
    this.commitView = new webui.CommitView(this);
    this.element.appendChild(this.commitView.element);

    this.show = function() {
        $(mainView.element).empty();
        mainView.element.appendChild(this.element);
    };

    this.update = function(ref) {
        this.show();
        this.logView.update(ref);
    };
};

/*
 * == WorkspaceView ===========================================================
 */
webui.WorkspaceView = function(mainView) {

    var workspaceView = this;
    this.element = $(   '<div id="workspace-view">' +
                            '<div id="workspace-diff-view"></div>' +
                            '<div id="workspace-editor"></div>' +
                        '</div>')[0];
    var workspaceDiffView = $("#workspace-diff-view", this.element)[0];
    this.diffView = new webui.DiffView(this);
    workspaceDiffView.appendChild(this.diffView.element);
    var workspaceEditor = $("#workspace-editor", this.element)[0];
    this.workingCopyView = new webui.ChangedFilesView(this, "working-copy", "Working Copy");
    workspaceEditor.appendChild(this.workingCopyView.element);
    this.commitMessageView = new webui.CommitMessageView(this);
    workspaceEditor.appendChild(this.commitMessageView.element);
    this.stagingAreaView = new webui.ChangedFilesView(this, "staging-area", "Staging Area");
    workspaceEditor.appendChild(this.stagingAreaView.element);

    this.show = function() {
        $(mainView.element).empty();
        mainView.element.appendChild(this.element);
    };

    this.update = function() {
        this.show();
        this.diffView.update("");
        this.workingCopyView.update();
        this.stagingAreaView.update();
        this.commitMessageView.update();
    };
};

/*
 * == ChangedFilesView ========================================================
 */
webui.ChangedFilesView = function(workspaceView, type, label) {

    var changedFilesView = this;
    this.element = $(   '<div id="' + type + '-view" class="workspace-editor-box">' +
                            '<p>'+ label + '</p>' +
                            '<div id="' + type + '-file-list" class="file-list">' +
                                '<ul id="' + type + '-file-list-content" class="file-list"></ul>' +
                            '</div>' +
                        '</div>')[0];
    var fileList = $("#" + type + "-file-list-content", this.element)[0];
    var currentSelection = null;

    this.filesCount = 0;

    this.update = function() {
        $(fileList).empty()
        var col = type == "working-copy" ? 1 : 0;
        webui.git("status --porcelain", function(data) {
            changedFilesView.filesCount = 0;
            webui.splitLines(data).forEach(function(line) {
                var status = line[col];
                if (col == 0 && status != " " && status != "?" || col == 1 && status != " ") {
                    ++changedFilesView.filesCount;
                    var li = $('<li>').appendTo(fileList)[0];
                    li.model = line.substr(3);
                    li.appendChild(document.createTextNode(li.model));
                    $(li).click(changedFilesView.select);
                    if (col == 0) {
                        $(li).dblclick(changedFilesView.unstage);
                    } else {
                        $(li).dblclick(changedFilesView.stage);
                    }
                }
            });
        });
    };

    this.select = function(event) {
        var clicked = event.target;
        if (currentSelection != clicked) {
            if (currentSelection) {
                $(currentSelection).removeClass("selected");
            }
            $(clicked).addClass("selected");
            currentSelection = clicked;
            if (type == "working-copy") {
                workspaceView.stagingAreaView.unselect();
                var gitCmd = "diff "
            } else {
                workspaceView.workingCopyView.unselect();
                var gitCmd = "diff --cached "
            }
            var filename = clicked.childNodes[0].textContent;
            webui.git(gitCmd + filename, function(data) {
                workspaceView.diffView.update(data);
            });
        }
    };

    this.unselect = function() {
        if (currentSelection) {
            $(currentSelection).removeClass("selected");
            currentSelection = null;
        }
    }

    this.stage = function(event) {
        webui.git("add " + event.target.model, function(data) {
            workspaceView.update();
        });
    };

    this.unstage = function(event) {
        webui.git("reset " + event.target.model, function(data) {
            workspaceView.update();
        });
    };
};

/*
 * == CommitMessageView =======================================================
 */
webui.CommitMessageView = function(workspaceView) {

    var commitMessageView = this;

    this.element = $(   '<div id="commit-message-view" class="workspace-editor-box">' +
                            '<p>Message</p>' +
                            '<textarea id="commit-message-textarea"></textarea>' +
                            '<div id="commit-controls">' +
                                '<input id="amend" type="checkbox"><label for="amend">Amend</label>' +
                                '<button type="button">Commit</button>' +
                            '</div>' +
                        '</div>')[0];
    var textArea = $("#commit-message-textarea", this.element)[0];
    var amend = $("input", this.element)[0];
    var commitButton = $("button", this.element)[0];

    amend.onchange = function() {
        if (amend.checked && textArea.value.length == 0) {
            webui.git("log --pretty=format:%s -n 1", function(data) {
                textArea.value = data;
            });
        }
    };

    commitButton.onclick = function() {
        if (workspaceView.stagingAreaView.filesCount == 0) {
            console.log("No files staged for commit");
        } else if (textArea.value.length == 0) {
            console.log("Enter a commit message first");
        } else {
            var cmd = "commit ";
            if (amend.checked) {
                cmd += "--amend ";
            }
            cmd += '-m "' + textArea.value + '"'
            webui.git(cmd, function(data) {
                textArea.value = "";
                amend.checked = false;
                workspaceView.update();
            });
        }
    }

    this.update = function() {
    };
};


/*
 *  == Initialization =========================================================
 */
function MainUi() {
    var body = $("body")[0];
    this.sideBarView = new webui.SideBarView(this);
    body.appendChild(this.sideBarView.element);

    this.element = $('<div id="main-view">')[0];
    body.appendChild(this.element);
    this.historyView = new webui.HistoryView(this);
    this.workspaceView = new webui.WorkspaceView(this);
}

$(document).ready(function () {
    new MainUi()
});
