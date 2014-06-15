"use strict"

var webui = webui || {};

webui.repo = "/";

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
    return data.split("\n").filter(function(s) { return s.length > 0; });
};

webui.getNodeIndex = function(element) {
    var index = 0;
    while (element.previousElementSibling) {
        element = element.previousElementSibling;
        ++index;
    }
    return index;
}

webui.RadioButtonBox = function(buttons) {

    var self = this;

    self.itemClicked = function(event) {
        self.updateSelection(event.target);
    }

    self.select = function(index) {
        self.updateSelection(self.element.children[index]);
    }

    self.updateSelection = function(elt) {
        if (current) {
            $(current).removeClass("button-box-current");
        }
        current = elt;
        $(current).addClass("button-box-current");
        current.callback();
    }

    self.element = $('<span class="button-box">')[0];
    var current = null;

    for (var i = 0; i < buttons.length; ++i) {
        var item = buttons[i];
        var a = $('<a> ' + item[0] + ' </a>')[0];
        self.element.appendChild(a);
        a.callback = item[1];
        a.onclick = self.itemClicked;
    }
};

webui.ButtonBox = function(buttons) {

    var self = this;

    self.element = $('<span class="button-box">')[0];

    for (var i = 0; i < buttons.length; ++i) {
        var item = buttons[i];
        var a = $('<a> ' + item[0] + ' </a>')[0];
        self.element.appendChild(a);
        a.onclick = item[1];
    }
}

/*
 * == SideBarView =============================================================
 */
webui.SideBarView = function(mainView) {

    var self = this;

    self.select = function(node) {
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
                self.mainView.historyView.update(node.name);
            }
        }
    };

    self.mainView = mainView;
    self.element = $(   '<div id="sidebar">' +
                            '<img id="sidebar-logo" src="git-logo.png">' +
                            '<div id="sidebar-content">' +
                                '<div id="sidebar-workspace">' +
                                    '<h1>Workspace</h1>' +
                                '</div>' +
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
    var contentElement = $("#sidebar-content", self.element)[0];
    var workspaceElement = $("#sidebar-workspace h1", self.element)[0];

    $(workspaceElement).click(function (event) {
        self.select(workspaceElement);
        self.mainView.workspaceView.update();
    });

    webui.git("branch", function(data) {
        var branches = webui.splitLines(data);
        if (branches.length > 0) {
            var branchesElement = $("#sidebar-branches", self.element)[0];
            branchesElement.style.display = "block";
            var ul = $("ul", branchesElement)[0];
            branches.forEach(function (branch) {
                var name = branch.substr(2);
                var li = $("<li>" + name + "</li>").appendTo(ul)[0];
                li.name = name;
                $(li).click(function (event) { self.select(li); });
                if (branch.substr(0, 1) == "*") {
                    $(li).addClass("branch-current")
                    window.setTimeout(function() {
                        self.select(li);
                    }, 0);
                }
            });
        }
    });

    webui.git("tag", function(data) {
        var tags = webui.splitLines(data);
        if (tags.length > 0) {
            var tagsElement = $("#sidebar-tags", self.element)[0];
            tagsElement.style.display = "block";
            var ul = $("ul", tagsElement)[0];
            tags.forEach(function (tag) {
                var li = $("<li>" + tag + "</li>").appendTo(ul)[0];
                li.name = tag;
                $(li).click(function (event) { self.select(li); });
            });
        }
    });
};

/*
 * == LogView =================================================================
 */
webui.LogView = function(historyView) {

    var self = this;

    self.update = function(ref) {
        $(self.element).empty();
        webui.git("log --pretty=raw --decorate=full " + ref, function(data) {
            var start = 0;
            while (true) {
                var end = data.indexOf("\ncommit ", start);
                if (end != -1) {
                    var len = end - start;
                } else {
                    var len = undefined;
                }
                var entry = new Entry(self, data.substr(start, len));
                self.element.appendChild(entry.element);
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

    function Entry(logView, data) {
        var self = this;

        self.abbrevCommitHash = function() {
            return self.commit.substr(0, 7);
        };

        self.abbrevMessage = function() {
            var end = self.message.indexOf("\n");
            if (end == -1) {
                return self.message
            } else {
                return self.message.substr(0, end);
            }
        };

        self.createElement = function() {
            self.element = $('<div class="log-entry">' +
                                 '<div class="log-entry-header">' +
                                     '<a class="log-entry-name" target="_blank" href="mailto:' + self.author.email + '">' + self.author.name + '</a> ' +
                                     '<span  class="log-entry-date">' + self.author.date.toLocaleString() + '</span> ' +
                                     '<pre class="log-entry-hash">' + self.abbrevCommitHash() + '</pre>' +
                                 '</div>' +
                                 '<div class="log-entry-message"></div>' +
                             '</div>')[0];
            $(".log-entry-message", self.element)[0].appendChild(document.createTextNode(self.abbrevMessage()));
            if (self.refs) {
                var entryName = $(".log-entry-name", self.element);
                var container = $('<span class="log-entry-refs">').insertAfter(entryName);
                self.refs.forEach(function (ref) {
                    if (ref.indexOf("refs/remotes") == 0) {
                        ref = ref.substr(13);
                        var reftype = "remote";
                    } else if (ref.indexOf("refs/heads") == 0) {
                        ref = ref.substr(11);
                        var reftype = "head";
                    } else if (ref.indexOf("tag: refs/tags") == 0) {
                        ref = ref.substr(15);
                        var reftype = "tag";
                    } else {
                        var reftype = "symbolic";
                    }
                    $('<span class="log-entry-ref-' + reftype + '">' + ref + '</span>').appendTo(container);
                });
            }
            self.element.model = self;
            var model = self;
            $(self.element).click(function (event) {
                model.select();
            });
            return self.element;
        };

        self.select = function() {
            if (currentSelection != self) {
                if (currentSelection) {
                    $(currentSelection.element).removeClass("selected");
                }
                $(self.element).addClass("selected");
                currentSelection = self;
                logView.historyView.commitView.update(self);
            }
        };

        self.parents = [];
        self.message = ""

        data.split("\n").forEach(function(line) {
            if (line.indexOf("commit ") == 0) {
                self.commit = line.substr(7, 40);
                if (line.length > 47) {
                    self.refs = []
                    var s = line.lastIndexOf("(") + 1;
                    var e = line.lastIndexOf(")");
                    line.substr(s, e - s).split(", ").forEach(function(ref) {
                        self.refs.push(ref);
                    });
                }
            } else if (line.indexOf("parent ") == 0) {
                self.parents.push(line.substr(7));
            } else if (line.indexOf("tree ") == 0) {
                self.tree = line.substr(5);
            } else if (line.indexOf("author ") == 0) {
                self.author = new Person(line.substr(7));
            } else if (line.indexOf("committer ") == 0) {
                self.committer = new Person(line.substr(10));
            } else if (line.indexOf("    ") == 0) {
                self.message += line.substr(4) + "\n";
            }
        });

        self.message = self.message.trimRight();

        self.createElement();
    };

    self.historyView = historyView;
    self.element = $('<div id="log-view">')[0];
    var currentSelection = -1;
};

/*
 * == DiffView ================================================================
 */
webui.DiffView = function(parent) {

    var self = this;

    self.update = function(diff) {
        $(self.element).empty();

        var inHeader = true;
        var diffLines = diff.split("\n");
        for (var i = 0; i < diffLines.length; ++i) {
            var line = diffLines[i];
            var pre = $('<pre class="diff-view-line">').appendTo(self.element)[0];
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

    self.element = $('<div class="diff-view">')[0];
};

/*
 * == TreeView ================================================================
 */
webui.TreeView = function(commitView) {

    var self = this;

    function Entry(line) {

        var self = this;

        self.formatedSize = function(size) {
            if (isNaN(self.size)) {
                return ["", ""]
            }
            if (self.size < 1024) {
                return [self.size.toString(), ""];
            } else if (self.size < 1024 * 1024) {
                return [(self.size / 1024).toFixed(2), "K"];
            } else if (self.size < 1024 * 1024 * 1024) {
                return [(self.size / 1024 * 1024).toFixed(2), "M"];
            } else {
                return [(self.size / 1024 * 1024 * 1024).toFixed(2), "G"];
            }
        };

        self.isSymbolicLink = function() {
            return (self.mode & 120000) == 120000; // S_IFLNK
        }

        var end = line.indexOf(" ");
        self.mode = parseInt(line.substr(0, end));
        var start = end + 1;
        var end = line.indexOf(" ", start);
        self.type = line.substr(start, end - start);
        start = end + 1;
        var end = line.indexOf(" ", start);
        self.object = line.substr(start, end - start);
        start = end + 1;
        var end = line.indexOf("\t", start);
        self.size = parseInt(line.substr(start, end - start).trim());
        start = end + 1;
        self.name = line.substr(start);
    }


    self.update = function(treeRef) {
        self.stack = [ { name: webui.repo, object: treeRef } ];
        self.showTree();
    }

    self.createBreadcrumb = function() {
        $(breadcrumb).empty();
        var list = []
        self.stack.forEach(function (item) {
            list.push([item.name, self.breadcrumbClicked]);
        });
        var buttons = new webui.ButtonBox(list);
        breadcrumb.appendChild(buttons.element);
    }

    self.breadcrumbClicked = function(event) {
        var to = webui.getNodeIndex(event.target);
        self.stack = self.stack.slice(0, to + 1);
        self.showTree();
    }

    self.showTree = function() {
        self.element.lastElementChild.remove();
        var treeViewTreeContent = $('<div id="tree-view-tree-content">')[0];
        self.element.appendChild(treeViewTreeContent);
        self.createBreadcrumb();
        var treeRef = self.stack[self.stack.length - 1].object;
        var parentTreeRef = self.stack.length > 1 ? self.stack[self.stack.length - 2].object : undefined;
        webui.git("ls-tree -l " + treeRef, function(data) {
            var blobs = [];
            var trees = [];
            if (parentTreeRef) {
                var elt =   $('<div class="tree-item">' +
                                '<span class="tree-item-tree">..</span> ' +
                                '<span></span> ' +
                                '<span></span> ' +
                            '</div>')[0];
                elt.onclick = function() {
                    self.stack.pop();
                    self.showTree();
                };
                treeViewTreeContent.appendChild(elt);
            }
            webui.splitLines(data).forEach(function(line) {
                var entry = new Entry(line);
                var size = entry.formatedSize()
                var elt =   $('<div class="tree-item">' +
                                '<span>' + entry.name + '</span> ' +
                                '<span>' + size[0] + '</span>&nbsp;' +
                                '<span>' + size[1] + '</span>' +
                            '</div>')[0];
                elt.model = entry;
                var nameElt = $("span", elt)[0];
                $(nameElt).addClass("tree-item-" + entry.type);
                if (entry.isSymbolicLink()) {
                    $(nameElt).addClass("tree-item-symlink");
                }
                if (entry.type == "tree") {
                    trees.push(elt);
                    elt.onclick = function() {
                        self.stack.push({ name: elt.model.name, object: elt.model.object});
                        self.showTree();
                    };
                } else {
                    blobs.push(elt);
                    elt.onclick = function() {
                        self.stack.push({ name: elt.model.name, object: elt.model.object});
                        self.showBlob();
                    };
                }
            });
            var compare = function(a, b) {
                return a.model.name.toLowerCase().localeCompare(b.model.name.toLowerCase());
            }
            blobs.sort(compare);
            trees.sort(compare);
            trees.forEach(function (elt) {
                treeViewTreeContent.appendChild(elt);
            });
            blobs.forEach(function (elt) {
                treeViewTreeContent.appendChild(elt);
            });
        });
    }

    self.showBlob = function(blobRef) {
        self.element.lastElementChild.remove();
        $(  '<div id="tree-view-blob-content">' +
                '<iframe src="/git/cat-file/' + self.stack[self.stack.length - 1].object + '"></iframe>' +
            '</div>').appendTo(self.element);
    }

    self.element = $('<div id="tree-view">')[0];
    var breadcrumb = $('<div id="tree-view-breadcrumb">')[0];
    self.element.appendChild(breadcrumb);
    self.element.appendChild($('<div id="tree-view-tree-content">')[0]);
    var stack;
}

/*
 * == CommitView ==============================================================
 */
webui.CommitView = function(historyView) {

    var self = this;

    self.update = function(entry) {
        if (currentCommit == entry.commit) {
            // We already display the right data. No need to update.
            return;
        }
        currentCommit = entry.commit;
        self.showDiff();
        buttonBox.select(0);
        webui.git("show " + entry.commit, function(data) {
            diffView.update(data);
        });
        treeView.update(entry.tree);
    };

    self.showDiff = function() {
        $(commitViewContent).empty();
        commitViewContent.appendChild(diffView.element);
    };

    self.showTree = function() {
        $(commitViewContent).empty();
        commitViewContent.appendChild(treeView.element);
    };

    self.historyView = historyView;
    var currentCommit = null;
    self.element = $('<div id="commit-view">')[0];
    var commitViewHeader = $('<div id="commit-view-header">')[0];
    self.element.appendChild(commitViewHeader);
    var buttonBox = new webui.RadioButtonBox([["Commit", self.showDiff], ["Tree", self.showTree]]);
    commitViewHeader.appendChild(buttonBox.element);
    var commitViewContent = $('<div id="commit-view-content">')[0];
    self.element.appendChild(commitViewContent);
    var diffView = new webui.DiffView(self);
    var treeView = new webui.TreeView(self);
};

/*
 * == HistoryView =============================================================
 */
webui.HistoryView = function(mainView) {

    var self = this;

    self.show = function() {
        $(mainView.element).empty();
        mainView.element.appendChild(self.element);
    };

    self.update = function(ref) {
        self.show();
        self.logView.update(ref);
    };

    self.element = $('<div id="history-view">')[0];
    self.logView = new webui.LogView(self);
    self.element.appendChild(self.logView.element);
    self.commitView = new webui.CommitView(self);
    self.element.appendChild(self.commitView.element);
};

/*
 * == WorkspaceView ===========================================================
 */
webui.WorkspaceView = function(mainView) {

    var self = this;

    self.show = function() {
        $(mainView.element).empty();
        mainView.element.appendChild(self.element);
    };

    self.update = function() {
        self.show();
        self.diffView.update("");
        self.workingCopyView.update();
        self.stagingAreaView.update();
        self.commitMessageView.update();
    };

    self.element = $(   '<div id="workspace-view">' +
                            '<div id="workspace-diff-view"></div>' +
                            '<div id="workspace-editor"></div>' +
                        '</div>')[0];
    var workspaceDiffView = $("#workspace-diff-view", self.element)[0];
    self.diffView = new webui.DiffView(self);
    workspaceDiffView.appendChild(self.diffView.element);
    var workspaceEditor = $("#workspace-editor", self.element)[0];
    self.workingCopyView = new webui.ChangedFilesView(self, "working-copy", "Working Copy");
    workspaceEditor.appendChild(self.workingCopyView.element);
    self.commitMessageView = new webui.CommitMessageView(self);
    workspaceEditor.appendChild(self.commitMessageView.element);
    self.stagingAreaView = new webui.ChangedFilesView(self, "staging-area", "Staging Area");
    workspaceEditor.appendChild(self.stagingAreaView.element);
};

/*
 * == ChangedFilesView ========================================================
 */
webui.ChangedFilesView = function(workspaceView, type, label) {

    var self = this;

    self.update = function() {
        $(fileList).empty()
        var col = type == "working-copy" ? 1 : 0;
        webui.git("status --porcelain", function(data) {
            self.filesCount = 0;
            webui.splitLines(data).forEach(function(line) {
                var status = line[col];
                if (col == 0 && status != " " && status != "?" || col == 1 && status != " ") {
                    ++self.filesCount;
                    var li = $('<li>').appendTo(fileList)[0];
                    li.model = line.substr(3);
                    li.appendChild(document.createTextNode(li.model));
                    $(li).click(self.select);
                    if (col == 0) {
                        $(li).dblclick(self.unstage);
                    } else {
                        $(li).dblclick(self.stage);
                    }
                }
            });
            if (selectedIndex !== null && selectedIndex >= fileList.childElementCount) {
                selectedIndex = fileList.childElementCount - 1;
                if (selectedIndex == -1) {
                    selectedIndex = null;
                }
            }
            if (selectedIndex !== null) {
                var selectedNode = fileList.children[selectedIndex];
                $(selectedNode).addClass("selected");
                self.refreshDiff(selectedNode);
            }
        });
    };

    self.select = function(event) {
        var clicked = event.target;

        if (event.shiftKey && selectedIndex !== null) {
            var clickedIndex = webui.getNodeIndex(clicked);
            if (clickedIndex < selectedIndex) {
                var from = clickedIndex;
                var to = selectedIndex;
            } else {
                var from = selectedIndex;
                var to = clickedIndex;
            }
            for (var i = from; i <= to; ++i) {
                $(fileList.children[i]).addClass("selected");
            }
            selectedIndex = clickedIndex;
        } else if (event.ctrlKey) {
            $(clicked).toggleClass("selected");
            selectedIndex = webui.getNodeIndex(clicked);
        } else {
            for (var i = 0; i < fileList.childElementCount; ++i) {
                $(fileList.children[i]).removeClass("selected");
            }
            $(clicked).addClass("selected");
            selectedIndex = webui.getNodeIndex(clicked);
        }
        if (type == "working-copy") {
            workspaceView.stagingAreaView.unselect();
        } else {
            workspaceView.workingCopyView.unselect();
        }
        self.refreshDiff(clicked);
    };

    self.refreshDiff = function(element) {
        var gitCmd = "diff "
        if (type == "staging-area") {
            gitCmd += " --cached "
        }
        var filename = element.textContent;
        webui.git(gitCmd + filename, function(data) {
            workspaceView.diffView.update(data);
        });

    };

    self.unselect = function() {
        if (selectedIndex !== null) {
            $(fileList.children[selectedIndex]).removeClass("selected");
            selectedIndex = null;
        }
    };

    self.getFileList = function() {
        var files = "";
        for (var i = 0; i < fileList.childElementCount; ++i) {
            var child = fileList.children[i];
            if ($(child).hasClass("selected")) {
                files += '"' + (child.textContent) + '" ';
            }
        }
        return files;
    }

    self.stage = function() {
        var files = self.getFileList();
        if (files.length != 0) {
            webui.git("add -- " + files, function(data) {
                workspaceView.update();
            });
        }
    };

    self.unstage = function() {
        var files = self.getFileList();
        if (files.length != 0) {
            webui.git("reset -- " + files, function(data) {
                workspaceView.update();
            });
        }
    };

    self.cancel = function() {
        var files = self.getFileList();
        if (files.length != 0) {
            webui.git("checkout -- " + files, function(data) {
                workspaceView.update();
            });
        }
    }

    if (type == "working-copy") {
        var buttons = new webui.ButtonBox([["Stage", self.stage], ["Cancel", self.cancel]]);
    } else {
        var buttons = new webui.ButtonBox([["Unstage", self.unstage]]);
    }
    self.element = $(   '<div id="' + type + '-view" class="workspace-editor-box">' +
                            '<div class="workspace-editor-box-header"><span>'+ label + '</span></div>' +
                            '<div id="' + type + '-file-list" class="file-list">' +
                                '<ul id="' + type + '-file-list-content" class="file-list"></ul>' +
                            '</div>' +
                        '</div>')[0];
    $(".workspace-editor-box-header", self.element)[0].appendChild(buttons.element);
    var fileList = $("#" + type + "-file-list-content", self.element)[0];
    var selectedIndex = null;

    self.filesCount = 0;
};

/*
 * == CommitMessageView =======================================================
 */
webui.CommitMessageView = function(workspaceView) {

    var self = this;

    self.onAmend = function() {
        if (self.amend.checked && self.textArea.value.length == 0) {
            webui.git("log --pretty=format:%s -n 1", function(data) {
                self.textArea.value = data;
            });
        }
    };

    self.onCommit = function() {
        if (workspaceView.stagingAreaView.filesCount == 0) {
            console.log("No files staged for commit");
        } else if (self.textArea.value.length == 0) {
            console.log("Enter a commit message first");
        } else {
            var cmd = "commit ";
            if (amend.checked) {
                cmd += "--amend ";
            }
            cmd += '-m "' + self.textArea.value + '"'
            webui.git(cmd, function(data) {
                self.textArea.value = "";
                amend.checked = false;
                workspaceView.update();
            });
        }
    }

    self.update = function() {
    }

    self.element = $(   '<div id="commit-message-view" class="workspace-editor-box">' +
                            '<div class="workspace-editor-box-header"><span>Message</span></div>' +
                            '<textarea id="commit-message-textarea"></textarea>' +
                            '<div id="commit-controls">' +
                                '<input id="amend" type="checkbox"><label for="amend">Amend</label>' +
                                '<button type="button">Commit</button>' +
                            '</div>' +
                        '</div>')[0];
    self.textArea = $("#commit-message-textarea", self.element)[0];
    self.amend = $("input", self.element)[0];
    self.amend.onchange = self.onAmend;
    $("button", self.element)[0].onclick = self.onCommit;
};


/*
 *  == Initialization =========================================================
 */
function MainUi() {

    var self = this;

    var body = $("body")[0];
    self.sideBarView = new webui.SideBarView(self);
    body.appendChild(self.sideBarView.element);

    self.element = $('<div id="main-view">')[0];
    body.appendChild(self.element);
    self.historyView = new webui.HistoryView(self);
    self.workspaceView = new webui.WorkspaceView(self);
    $.get("/dirname", function (data) {
        webui.repo = data;
        var title = $("title")[0];
        title.textContent = "Git - " + webui.repo;
    });
}

$(document).ready(function () {
    new MainUi()
});
