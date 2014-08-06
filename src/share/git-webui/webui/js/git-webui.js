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

webui.TabBox = function(buttons) {

    var self = this;

    self.itemClicked = function(event) {
        self.updateSelection(event.target.parentElement);
    }

    self.select = function(index) {
        self.updateSelection(self.element.children[index]);
    }

    self.updateSelection = function(elt) {
        $(".active", self.element).removeClass("active");
        $(elt).addClass("active");
        elt.callback();
    }

    self.element = $('<ul class="nav nav-pills nav-justified" role="tablist">')[0];

    for (var i = 0; i < buttons.length; ++i) {
        var item = buttons[i];
        var li = $('<li><a href="#">' + item[0] + '</a></li>')[0];
        self.element.appendChild(li);
        li.callback = item[1];
        li.onclick = self.itemClicked;
    }
};

/*
 * == SideBarView =============================================================
 */
webui.SideBarView = function(mainView) {

    var self = this;

    self.selectRef = function(refName) {
        var selected = $(".active", self.element);
        if (selected.length > 0) {
            if (selected[0].refName != refName) {
                selected.toggleClass("active");
            } else {
                return;
            }
        }
        var tags = $("li", self.element);
        for (var i = 0; i < tags.length; ++i) {
            var li = tags[i];
            if (li.refName == refName) {
                $(li).toggleClass("active");
                break;
            }
        }
        self.mainView.historyView.update(refName);
    };

    self.addPopup = function(title, id, refs, isBranch) {
        var popup = $(  '<div class="modal fade" id="' + id + '" role="dialog">' +
                            '<div class="modal-dialog modal-sm">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>' +
                                        '<h4 class="modal-title">' + title + '</h4>' +
                                    '</div>' +
                                    '<div class="modal-body"><div class="list-group"></div></div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
        self.element.appendChild(popup);
        var popupContent = $(".list-group", popup)[0];
        refs.forEach(function(ref) {
            var link = $('<a class="list-group-item">')[0];
            if (isBranch) {
                link.refName = ref.substr(2);
                $(link).css("font-weight", "bold");
            } else {
                link.refName = ref;
            }
            $(link).text(link.refName);
            popupContent.appendChild(link);
            link.onclick = function (event) {
                $(popup).modal('hide');
                self.selectRef(event.target.refName);
            }
        });
        return popup;
    };

    self.fetchSection = function(section, title, id, gitCommand, isBranch) {
        webui.git(gitCommand, function(data) {
            var refs = webui.splitLines(data);
            if (refs.length > 0) {
                var ul = $("<ul>").appendTo(section)[0];
                refs = refs.sort(function(a, b) {
                    if (!isBranch) {
                        return -a.localeCompare(b);
                    } else if (a[0] == "*") {
                        return -1;
                    } else if (b[0] == "*") {
                        return 1;
                    } else {
                        return a.localeCompare(b);
                    }
                });

                var maxRefsCount = 15;
                for (var i = 0; i < refs.length && i < maxRefsCount; ++i) {
                    var ref = refs[i];
                    var li = $("<li>").appendTo(ul)[0];
                    if (isBranch) {
                        li.refName = ref.substr(2);
                        if (ref[0] == "*") {
                            $(li).addClass("branch-current")
                            window.setTimeout(function() {
                                var current = $(".branch-current", self.element)[0];
                                if (current) {
                                    self.selectRef(current.refName);
                                }
                            }, 0);
                        }
                    } else {
                        li.refName = ref;
                    }
                    $(li).text(li.refName);
                    li.onclick = function (event) {
                        self.selectRef(event.target.refName);
                    };
                }

                if (refs.length > maxRefsCount) {
                    var li = $("<li>More ...</li>").appendTo(ul)[0];
                    var popup = self.addPopup(title, id + "-popup", refs, isBranch);
                    li.onclick = function() {
                        $(popup).modal();
                    };
                }
            } else {
                $(section).remove();
            }
        });
    };

    self.mainView = mainView;
    self.element = $(   '<div id="sidebar">' +
                            '<img id="sidebar-logo" src="/img/git-logo.png">' +
                            '<div id="sidebar-content">' +
                                '<section id="sidebar-workspace">' +
                                    '<h4>Workspace</h4>' +
                                '</section>' +
                                '<section id="sidebar-remote">' +
                                    '<h4>Remote access</h4>' +
                                '</section>' +
                                '<section id="sidebar-branches">' +
                                    '<h4>Branches</h4>' +
                                '</section>' +
                                '<section id="sidebar-tags">' +
                                    '<h4>Tags</h4>' +
                                '</section>' +
                            '</div>' +
                        '</div>')[0];

    if (webui.viewonly) {
        $("#sidebar-workspace", self.element).remove();
    } else {
        var workspaceElement = $("#sidebar-workspace h4", self.element)[0];
        workspaceElement.onclick = function (event) {
            $("*", self.element).removeClass("active");
            $(workspaceElement).addClass("active");
            self.mainView.workspaceView.update();
        };
    }

    var remoteElement = $("#sidebar-remote h4", self.element)[0];
    remoteElement.onclick = function (event) {
        $("*", self.element).removeClass("active");
        $(remoteElement).addClass("active");
        self.mainView.daemonView.update();
    };

    self.fetchSection($("#sidebar-branches", self.element)[0], "Branches", "branches", "branch", true);
    self.fetchSection($("#sidebar-tags", self.element)[0], "Tags", "tags", "tag", false);
};

/*
 * == LogView =================================================================
 */
webui.LogView = function(historyView) {

    var self = this;

    self.update = function(ref) {
        $(self.element).empty();
        self.nextRef = ref;
        self.populate();
    };

    self.populate = function() {
        var maxCount = 1000;
        if (self.element.childElementCount != 0) {
            // The last node is the 'Show more commits placeholder'. Remove it.
            self.element.removeChild(self.element.lastElementChild);
        }
        webui.git("log --pretty=raw --decorate=full --max-count=" + (maxCount + 1) + " " + self.nextRef, function(data) {
            var start = 0;
            var count = 0;
            self.nextRef = undefined;
            while (true) {
                var end = data.indexOf("\ncommit ", start);
                if (end != -1) {
                    var len = end - start;
                } else {
                    var len = undefined;
                }
                var entry = new Entry(self, data.substr(start, len));
                if (count < maxCount) {
                    self.element.appendChild(entry.element);
                    if (!currentSelection) {
                        entry.select();
                    }
                } else {
                    self.nextRef = entry.commit;
                    break;
                }
                if (len == undefined) {
                    break;
                }
                start = end + 1;
                ++count;
            }
            if (self.nextRef != undefined) {
                var moreTag = $('<a class="log-entry log-entry-more list-group-item">')[0];
                $('<a class="list-group-item-text">Show previous commits</a>').appendTo(moreTag);
                moreTag.onclick = self.populate;
                self.element.appendChild(moreTag);
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
            self.element = $('<a class="log-entry list-group-item">' +
                                '<header>' +
                                    '<h6></h6>' +
                                    '<span class="log-entry-date">' + self.author.date.toLocaleString() + '&nbsp;</span> ' +
                                    '<span class="badge">' + self.abbrevCommitHash() + '</span>' +
                                '</header>' +
                                '<p class="list-group-item-text"></p>' +
                             '</a>')[0];
            $('<a target="_blank" href="mailto:' + self.author.email + '">' + self.author.name + '</a>').appendTo($("h6", self.element));
            $(".list-group-item-text", self.element)[0].appendChild(document.createTextNode(self.abbrevMessage()));
            if (self.refs) {
                var entryName = $("h6", self.element);
                self.refs.forEach(function (ref) {
                    if (ref.indexOf("refs/remotes") == 0) {
                        ref = ref.substr(13);
                        var reftype = "danger";
                    } else if (ref.indexOf("refs/heads") == 0) {
                        ref = ref.substr(11);
                        var reftype = "success";
                    } else if (ref.indexOf("tag: refs/tags") == 0) {
                        ref = ref.substr(15);
                        var reftype = "info";
                    } else {
                        var reftype = "warning";
                    }
                    $('<span>&nbsp;</span><span class="label label-' + reftype + '">' + ref + '</span>').insertAfter(entryName);
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
                    $(currentSelection.element).removeClass("active");
                }
                $(self.element).addClass("active");
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
    self.element = $('<div id="log-view" class="list-group">')[0];
    var currentSelection = null;
};

/*
 * == DiffView ================================================================
 */
webui.DiffView = function(sideBySide, parent) {

    var self = this;

    self.update = function(diff) {
        if (sideBySide) {
            self.updateSplitView(leftLines, diff, '-');
            self.updateSplitView(rightLines, diff, '+');
        } else {
            self.updateSimpleView(single, diff);
        }
    };

    self.updateSimpleView = function(view, diff) {
        $(view).empty();

        var inHeader = true;
        var diffLines = diff.split("\n");
        for (var i = 0; i < diffLines.length; ++i) {
            var line = diffLines[i];
            inHeader = self.addDiffLine(view, inHeader, line);
        }
    }

    self.updateSplitView = function(view, diff, operation) {
        $(view).empty();

        var inHeader = true;
        var diffLines = diff.split("\n");
        var addedLines = [];
        var removedLines = [];
        for (var i = 0; i < diffLines.length; ++i) {
            var line = diffLines[i];
            var c = line[0];
            if (c == '+') {
                addedLines.push(line);
            } else if (c == '-') {
                removedLines.push(line);
            } else {
                self.flushAddedRemovedLines(view, inHeader, operation, addedLines, removedLines);
                addedLines = [];
                removedLines = [];
                inHeader = self.addDiffLine(view, inHeader, line);
            }
        }
        self.flushAddedRemovedLines(view, inHeader, operation, addedLines, removedLines);
    }

    self.flushAddedRemovedLines = function(view, inHeader, operation, addedLines, removedLines) {
        if (operation == '+') {
            var lines = addedLines;
            var offset = removedLines.length - addedLines.length;
        } else {
            var lines = removedLines;
            var offset = addedLines.length - removedLines.length;
        }
        lines.forEach(function(line) {
            self.addDiffLine(view, inHeader, line);
        });
        if (offset > 0) {
            for (var i = 0; i < offset; ++i) {
                var pre = $('<pre class="diff-view-line diff-line-phantom">').appendTo(view)[0];
                pre.appendChild(document.createTextNode(" "));
            }
        }
    }

    self.addDiffLine = function(view, inHeader, line) {
        var c = line[0];
        var pre = $('<pre class="diff-view-line">').appendTo(view)[0];
        pre.appendChild(document.createTextNode(line));
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
        return inHeader;
    }

    self.diffViewScrolled = function(event) {
        if (event.target == left) {
            var current = left;
            var other = right;
        } else {
            var current = right;
            var other = left;
        }
        if (current.prevScrollTop != current.scrollTop) {
            // Vertical scrolling
            other.scrollTop = current.scrollTop
            current.prevScrollTop = current.scrollTop;
        } else {
            // Horizontal scrolling
            other.scrollLeft = current.scrollLeft
            current.prevScrollLeft = current.scrollLeft;
        }
    }

    if (sideBySide) {
        self.element = $('<div class="diff-view-container">')[0];
        var left = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
        self.element.appendChild(left);
        var leftLines = left.firstChild;
        left.onscroll = self.diffViewScrolled;
        left.prevScrollTop = left.scrollTop;
        left.prevScrollLeft = left.scrollLeft;
        var right = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
        self.element.appendChild(right);
        var rightLines = right.firstChild;
        right.onscroll = self.diffViewScrolled;
        right.prevScrollTop = right.scrollTop;
        right.prevScrollLeft = right.scrollLeft;
    } else {
        self.element = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
        var single = self.element.firstChild;
    }

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
        for (var i = 0; i < self.stack.length; ++i) {
            var last = i == self.stack.length - 1;
            var name = self.stack[i].name;
            if (!last) {
                name = '<a href="#">' + name + '</a>';
            }
            var li = $('<li>' + name + '</li>')[0];
            breadcrumb.appendChild(li);
            if (!last) {
                li.onclick = self.breadcrumbClicked;
            } else {
                $(li).addClass("active");
            }
        }
    }

    self.breadcrumbClicked = function(event) {
        var to = webui.getNodeIndex(event.target.parentElement);
        self.stack = self.stack.slice(0, to + 1);
        self.showTree();
    }

    self.showTree = function() {
        self.element.lastElementChild.remove();
        var treeViewTreeContent = $('<div id="tree-view-tree-content" class="list-group">')[0];
        self.element.appendChild(treeViewTreeContent);
        self.createBreadcrumb();
        var treeRef = self.stack[self.stack.length - 1].object;
        var parentTreeRef = self.stack.length > 1 ? self.stack[self.stack.length - 2].object : undefined;
        webui.git("ls-tree -l " + treeRef, function(data) {
            var blobs = [];
            var trees = [];
            if (parentTreeRef) {
                var elt =   $('<a href="#" class="list-group-item">' +
                                '<span class="tree-item-tree">..</span> ' +
                                '<span></span> ' +
                                '<span></span> ' +
                            '</a>')[0];
                elt.onclick = function() {
                    self.stack.pop();
                    self.showTree();
                };
                treeViewTreeContent.appendChild(elt);
            }
            webui.splitLines(data).forEach(function(line) {
                var entry = new Entry(line);
                var size = entry.formatedSize()
                var elt =   $('<a href="#" class="list-group-item">' +
                                '<span>' + entry.name + '</span> ' +
                                '<span>' + size[0] + '</span>&nbsp;' +
                                '<span>' + size[1] + '</span>' +
                            '</a>')[0];
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
        self.createBreadcrumb();
        self.element.lastElementChild.remove();
        $(  '<div id="tree-view-blob-content">' +
                '<iframe src="/git/cat-file/' + self.stack[self.stack.length - 1].object + '"></iframe>' +
            '</div>').appendTo(self.element);
    }

    self.element = $('<div id="tree-view">')[0];
    var breadcrumb = $('<ol class="breadcrumb">')[0];
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
    var buttonBox = new webui.TabBox([["Commit", self.showDiff], ["Tree", self.showTree]]);
    commitViewHeader.appendChild(buttonBox.element);
    var commitViewContent = $('<div id="commit-view-content">')[0];
    self.element.appendChild(commitViewContent);
    var diffView = new webui.DiffView(false, self);
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
    self.diffView = new webui.DiffView(true, self);
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
                    var item = $('<a class="list-group-item">').appendTo(fileList)[0];
                    item.model = line.substr(3);
                    item.appendChild(document.createTextNode(item.model));
                    $(item).click(self.select);
                    if (col == 0) {
                        $(item).dblclick(self.unstage);
                    } else {
                        $(item).dblclick(self.stage);
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
                $(selectedNode).addClass("active");
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
                $(fileList.children[i]).addClass("active");
            }
            selectedIndex = clickedIndex;
        } else if (event.ctrlKey) {
            $(clicked).toggleClass("active");
            selectedIndex = webui.getNodeIndex(clicked);
        } else {
            for (var i = 0; i < fileList.childElementCount; ++i) {
                $(fileList.children[i]).removeClass("active");
            }
            $(clicked).addClass("active");
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
            $(fileList.children[selectedIndex]).removeClass("active");
            selectedIndex = null;
        }
    };

    self.getFileList = function() {
        var files = "";
        for (var i = 0; i < fileList.childElementCount; ++i) {
            var child = fileList.children[i];
            if ($(child).hasClass("active")) {
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

    self.element = $(   '<div id="' + type + '-view" class="panel panel-default">' +
                            '<div class="panel-heading">' +
                                '<h5>'+ label + '</h5>' +
                                '<div class="btn-group"></div>' +
                            '</div>' +
                            '<div class="file-list-container">' +
                                '<div class="list-group"></div>' +
                            '</div>' +
                        '</div>')[0];
    if (type == "working-copy") {
        var buttons = [{ name: "Stage", callback: self.stage }, { name: "Cancel", callback: self.cancel }];
    } else {
        var buttons = [{ name: "Unstage", callback: self.unstage }];
    }
    var btnGroup = $(".btn-group", self.element);
    buttons.forEach(function (btnData) {
        var btn = $('<button type="button" class="btn btn-default">' + btnData.name + '</button>').appendTo(btnGroup)[0];
        btn.onclick = btnData.callback;
    });
    var fileList = $(".list-group", self.element)[0];
    var selectedIndex = null;

    self.filesCount = 0;
};

/*
 * == CommitMessageView =======================================================
 */
webui.CommitMessageView = function(workspaceView) {

    var self = this;

    self.onAmend = function() {
        if (!$(amend).hasClass("active") && textArea.value.length == 0) {
            webui.git("log --pretty=format:%s -n 1", function(data) {
                textArea.value = data;
            });
        }
    };

    self.onCommit = function() {
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

    self.update = function() {
    }

    self.element = $(   '<div id="commit-message-view" class="panel panel-default">' +
                            '<div class="panel-heading">' +
                                '<h5>Message</h5>' +
                                '<div class="btn-group">' +
                                    '<button type="button" class="btn btn-default commit-message-amend" data-toggle="button">Amend</button>' +
                                    '<button type="button" class="btn btn-default commit-message-commit">Commit</button>' +
                                '</div>' +
                            '</div>' +
                            '<textarea></textarea>' +
                        '</div>')[0];
    var textArea = $("textarea", self.element)[0];
    var amend = $(".commit-message-amend", self.element)[0];
    amend.onclick = self.onAmend;
    $(".commit-message-commit", self.element)[0].onclick = self.onCommit;
};

webui.DaemonView = function(mainView) {

    var self = this;

    self.show = function() {
        $(mainView.element).empty();
        mainView.element.appendChild(self.element);
    };

    self.update = function() {
        self.show();
    };

    self.element = $(   '<div class="jumbotron">' +
                            '<h1>Remote access</h1>' +
                            '<p>Git daemon allows other people to clone and pull from your repository.</p>' +
                            '<div class="git-access">' +
                                '<p>Other people can clone your repository:</p>' +
                                '<pre class="git-clone"></pre>' +
                                '<p>Or to pull from your repository:</p>' +
                                '<pre class="git-pull"></pre>' +
                            '</div>' +
                        '</div>')[0];
    $(".git-clone", self.element).text("git clone http://" + webui.hostname + ":" + document.location.port + "/ " + webui.repo);
    $(".git-pull", self.element).text("git pull http://" + webui.hostname + ":" + document.location.port + "/");
};

/*
 *  == Initialization =========================================================
 */
function MainUi() {

    var self = this;

    $.get("/dirname", function (data) {
        webui.repo = data;
        var title = $("title")[0];
        title.textContent = "Git - " + webui.repo;
        $.get("/viewonly", function (data) {
            webui.viewonly = data == "1";
            $.get("/hostname", function (data) {
                webui.hostname = data

                var body = $("body")[0];

                self.sideBarView = new webui.SideBarView(self);
                body.appendChild(self.sideBarView.element);

                self.element = $('<div id="main-view">')[0];
                body.appendChild(self.element);

                self.historyView = new webui.HistoryView(self);
                self.daemonView = new webui.DaemonView(self);
                if (!webui.viewonly) {
                    self.workspaceView = new webui.WorkspaceView(self);
                }
            });
        });
    });
}

$(document).ready(function () {
    new MainUi()
});
