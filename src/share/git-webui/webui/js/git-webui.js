/*
 * Copyright 2015 Eric ALBER
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict"

var webui = webui || {};

webui.repo = "/";

webui.git = function(cmd, arg1, arg2) {
    // cmd = git command line arguments
    // other arguments = optional stdin content and a callback function:
    // ex:
    // git("log", mycallback)
    // git("commit -F -", "my commit message", mycallback)
    if (typeof(arg1) == "function") {
        var callback = arg1;
    } else {
        // Convention : first line = git arguments, rest = process stdin
        cmd += "\n" + arg1;
        var callback = arg2;
    }
    $.post("git", cmd, function(data, status, xhr) {
        if (xhr.status == 200) {
            // Convention : last lines are footer meta data like headers. An empty line marks the start if the footers
            var footers = {};
            var fIndex = data.length;
            while (true) {
                var oldFIndex = fIndex;
                var fIndex = data.lastIndexOf("\r\n", fIndex - 1);
                var line = data.substring(fIndex + 2, oldFIndex);
                if (line.length > 0) {
                    var footer = line.split(": ");
                    footers[footer[0]] = footer[1];
                } else {
                    break;
                }
            }

            var messageStartIndex = fIndex - parseInt(footers["Git-Stderr-Length"]);
            var message = data.substring(messageStartIndex, fIndex);
            var output = data.substring(0, messageStartIndex);
            var rcode = parseInt(footers["Git-Return-Code"]);
            if (rcode == 0) {
                if (callback) {
                    callback(output);
                }
                // Return code is 0 but there is stderr output: this is a warning message
                if (message.length > 0) {
                    console.log(message);
                    var messageBox = $("#message-box");
                    messageBox.empty();
                    $(  '<div class="alert alert-warning alert-dismissible" role="alert">' +
                            '<button type="button" class="close" data-dismiss="alert">' +
                                '<span aria-hidden="true">&times;</span>' +
                                '<span class="sr-only">Close</span>' +
                            '</button>' +
                            message +
                        '</div>').appendTo(messageBox);
                }
                $("#error-modal .alert").text("");
            } else {
                console.log(message);
                $("#error-modal .alert").text(message);
                $("#error-modal").modal('show');
            }
        } else {
            console.log(data);
            $("#error-modal .alert").text(data);
            $("#error-modal").modal('show');
        }
    }, "text")
    .fail(function(xhr, status, error) {
        $("#error-modal .alert").text("Git webui server not running");
        $("#error-modal").modal('show');
    });
};

webui.detachChildren = function(element) {
    element.innerHTML = "";
}

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
        var li = $('<li><a href="#">' + item[0] + '</a></li>');
        li.appendTo(self.element);
        li.click(self.itemClicked);
        li[0].callback = item[1];
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
        var refElements = $(".sidebar-ref", self.element);
        var moreTag = undefined;
        for (var i = 0; i < refElements.length; ++i) {
            var refElement = refElements[i];
            if (refElement.refName == refName) {
                $(refElement).toggleClass("active");
                if (refElement.tagName == "LI") {
                    moreTag = null;
                } else if (moreTag !== null) {
                    moreTag = $(".sidebar-more", refElement.section);
                }
            }
        }
        if (moreTag && moreTag.length) {
            moreTag.toggleClass("active");
        }
        self.mainView.historyView.update(refName);
    };

    self.addPopup = function(section, title, id, refs, isBranch) {
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
            var link = $('<a class="list-group-item sidebar-ref">')[0];
            link.section = section;
            if (isBranch) {
                link.refName = ref.substr(2);
                if (ref[0] == "*") {
                    $(link).addClass("branch-current");
                }
            } else {
                link.refName = ref;
            }
            $(link).text(link.refName);
            popupContent.appendChild(link);
            $(link).click(function (event) {
                $(popup).modal('hide');
                self.selectRef(event.target.refName);
            });
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
                    var li = $('<li class="sidebar-ref">').appendTo(ul)[0];
                    if (isBranch) {
                        li.refName = ref.substr(2);
                        if (ref[0] == "*") {
                            $(li).addClass("branch-current");
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
                    $(li).click(function (event) {
                        self.selectRef(event.target.refName);
                    });
                }

                if (refs.length > maxRefsCount) {
                    var li = $('<li class="sidebar-more">More ...</li>').appendTo(ul);
                    var popup = self.addPopup(section, title, id + "-popup", refs, isBranch);
                    li.click(function() {
                        $(popup).modal();
                    });
                }
            } else {
                $(section).remove();
            }
        });
    };

    self.mainView = mainView;
    self.element = $(   '<div id="sidebar">' +
                            '<a href="#" data-toggle="modal" data-target="#help-modal"><img id="sidebar-logo" src="/img/git-logo.png"></a>' +
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
        var workspaceElement = $("#sidebar-workspace h4", self.element);
        workspaceElement.click(function (event) {
            $("*", self.element).removeClass("active");
            workspaceElement.addClass("active");
            self.mainView.workspaceView.update("stage");
        });
    }

    var remoteElement = $("#sidebar-remote h4", self.element);
    remoteElement.click(function (event) {
        $("*", self.element).removeClass("active");
        $(remoteElement).addClass("active");
        self.mainView.remoteView.update();
    });

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
                var moreTag = $('<a class="log-entry log-entry-more list-group-item">');
                $('<a class="list-group-item-text">Show previous commits</a>').appendTo(moreTag[0]);
                moreTag.click(self.populate);
                moreTag.appendTo(self.element);
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

        self.message = self.message.trim();

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

    self.update = function(cmd, mode) {
        gitApplyType = mode;
        if (cmd) {
            self.cmd = cmd;
        }
        if (self.cmd.length) {
            var fullCmd = self.cmd.slice();
            var opts = "";
            if (self.complete) {
                opts = " --unified=999999999";
            } else {
                opts = " --unified=" + self.context.toString();
            }
            if (self.ignoreWhitespace) {
                opts += " --ignore-all-space --ignore-blank-lines";
            }
            fullCmd.splice(1, 0, opts);
            webui.git(fullCmd.join(" "), function(diff) {
                self.refresh(diff);
            });
        } else {
            self.refresh("");
        }
    };

    self.refresh = function(diff) {
        self.diffHeader = "";
        $("span", self.element).text('Context: ' + self.context);
        if (sideBySide) {
            var diffLines = diff.split("\n");
            self.updateSplitView(leftLines, diffLines, '-');
            self.updateSplitView(rightLines, diffLines, '+');
        } else {
            self.updateSimpleView(singleLines, diff);
        }
    }

    self.updateSimpleView = function(view, diff) {
        $(view).empty();

        var context = { inHeader: true };
        var diffLines = diff.split("\n");
        for (var i = 0; i < diffLines.length; ++i) {
            var line = diffLines[i];
            context = self.addDiffLine(view, line, context);
        }
        view.parentElement.scrollTop = view.parentElement.prevScrollTop;
    }

    self.updateSplitView = function(view, diffLines, operation) {
        $(view).empty();

        var context = { inHeader: true,
                        addedLines: [],
                        removedLines: [],
                        diffHeader: '',
                        diffHunk: [] };
        for (var i = 0; i < diffLines.length; ++i) {
            var line = diffLines[i];
            var c = line[0];
            if (c == '+') {
                context.addedLines.push(line);
                if (context.inHeader) {
                    context.diffHeader += line + '\n';
                } else {
                    context.diffHunk.push(line);
                }
            } else if (c == '-') {
                context.removedLines.push(line);
                if (context.inHeader) {
                    context.diffHeader += line + '\n';
                } else {
                    context.diffHunk.push(line);
                }
            } else {
                if (c == ' ') {
                    context.diffHunk.push(line);
                }
                context = self.flushAddedRemovedLines(view, operation, context);
                context.addedLines = [];
                context.removedLines = [];
                context = self.addDiffLine(view, line, context);
                if (c == 'd') {
                    context.diffHeader = '';
                }
            }
        }
        self.flushAddedRemovedLines(view, operation, context);
        view.parentElement.scrollTop = view.parentElement.prevScrollTop;
    }

    self.flushAddedRemovedLines = function(view, operation, context) {
        if (operation == '+') {
            var lines = context.addedLines;
            var offset = context.removedLines.length - context.addedLines.length;
        } else {
            var lines = context.removedLines;
            var offset = context.addedLines.length - context.removedLines.length;
        }
        lines.forEach(function(line) {
            context = self.addDiffLine(view, line, context);
        });
        if (offset > 0) {
            for (var i = 0; i < offset; ++i) {
                var pre = $('<pre class="diff-view-line diff-line-phantom">').appendTo(view)[0];
                pre.appendChild(document.createTextNode(" "));
            }
        }
        return context;
    }

    self.addDiffLine = function(view, line, context) {
        var c = line[0];
        var pre = $('<pre class="diff-view-line">').appendTo(view)[0];
        pre.appendChild(document.createTextNode(line));
        if (c == '+') {
            $(pre).addClass("diff-line-add");
            if (gitApplyType != undefined) {
                $(pre).click(function(event) {
                    if (event.ctrlKey) {
                        self.applyLinePatch(event.target, true, gitApplyType != "stage");
                    }
                });
            }
        } else if (c == '-') {
            $(pre).addClass("diff-line-del");
            if (gitApplyType != undefined) {
                $(pre).click(function(event) {
                    if (event.ctrlKey) {
                        self.applyLinePatch(event.target, true, gitApplyType != "stage");
                    }
                });
            }
        } else if (c == '@') {
            $(pre).addClass("diff-line-offset");
            pre.diffHeader = context.diffHeader;
            context.inHeader = false;
            if (gitApplyType != undefined) {
                $(pre).click(function(event) {
                    if (event.ctrlKey) {
                        self.applyHunkPatch(event.target, true, gitApplyType != "stage");
                    }
                });
            }
            pre.diffHunk = [];
            context.diffHunk = pre.diffHunk;
        } else if (c == 'd') {
            context.inHeader = true;
        }
        if (context.inHeader) {
            $(pre).addClass("diff-line-header");
        }
        return context;
    }

    self.reverseLine = function(line) {
        switch (line[0]) {
            case '-':
                return '+' + line.substr(1);
            case '+':
                return '-' + line.substr(1);
                break;
            default:
                return line;
                break;
        }
    }

    self.applyLinePatch = function(element, cached, reverse) {
        // Find the context line
        var context = element.previousElementSibling;
        var offset = 0;
        while (context) {
            var c = context.textContent[0];
            if (c == " " || c == "-") {
                offset += 1;
            } else if (c == "@") {
                break;
            }
            context = context.previousElementSibling;
        }
        var diffHeader = context.diffHeader;
        context = context.textContent;
        var lineno = Math.abs(context.split(" ")[1].split(",")[0]) + offset;
        var diffLine = element.textContent;
        if (reverse) {
            diffLine = self.reverseLine(diffLine);
        }
        if (diffLine[0] == "+") {
            var prevLineCount = 0;
            var newLineCount = 1;
        } else if (diffLine[0] == "-") {
            var prevLineCount = 1;
            var newLineCount = 0;
        }
        var patch = diffHeader + "@@ -" + lineno + "," + prevLineCount +" +" + lineno + "," + newLineCount + " @@\n" + diffLine + "\n";
        var cmd = "apply --unidiff-zero";
        if (cached) {
            cmd += " --cached";
        }
        webui.git(cmd, patch, function (data) {
            parent.update();
        });
    }

    self.applyHunkPatch = function(element, cached, reverse) {
        // Find the current operation
        var operation = null;
        for (var elt = element.nextElementSibling; elt && operation == null; elt = elt.nextElementSibling) {
            var c = elt.textContent[0];
            if (c == '+' || c == '-') {
                operation = c;
                break;
            }
        }

        // Parse diff context line
        var splittedContext = element.textContent.split(" ");
        var lineNo = Math.abs(splittedContext[reverse ? 2 : 1].split(",")[0]);

        var patchContent = "";
        var diffLinesCount = 0;
        var contextLinesCount = 0;
        for (var i = 0; i < element.diffHunk.length; ++i) {
            var line = element.diffHunk[i];
            var c = line[0];
            if (c == operation) {
                if (reverse) {
                    line = self.reverseLine(line);
                }
                ++diffLinesCount
            } else if ((operation == '+' && !reverse) || (operation == '-' && reverse)) {
                line = ' ' + line.substr(1);
                ++contextLinesCount;
            } else if (c == ' ') {
                ++contextLinesCount;
            } else if (c == '@') {
                break;
            } else {
                line = null;
            }
            if (line != null) {
                patchContent += line + "\n";
            }
        }

        var patch = element.diffHeader;
        if ((operation == '+' || reverse) && !(operation == '+' && reverse)) {
            patch += "@@ -" + lineNo + "," + contextLinesCount +" +" + lineNo + "," + (contextLinesCount + diffLinesCount) + " @@\n";
        } else {
            patch += "@@ -" + lineNo + "," + (contextLinesCount + diffLinesCount) + " +" + lineNo + "," + contextLinesCount + " @@\n";
        }
        patch += patchContent;

        var cmd = "apply";
        if (cached) {
            cmd += " --cached";
        }
        webui.git(cmd, patch, function (data) {
            parent.update();
        });
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
            other.scrollTop = current.scrollTop;
            current.prevScrollTop = current.scrollTop;
        } else {
            // Horizontal scrolling
            other.scrollLeft = current.scrollLeft;
            current.prevScrollLeft = current.scrollLeft;
        }
    }

    self.addContext = function() {
        self.context += 3;
        self.update();
    }

    self.removeContext = function() {
        if (self.context > 3) {
            self.context -= 3;
            self.update();
        }
    }

    self.allContext = function() {
        self.complete = !self.complete;
        self.update();
    }

    self.toggleIgnoreWhitespace = function() {
        self.ignoreWhitespace = !self.ignoreWhitespace;
        self.update();
    }

    self.element = $(   '<div class="diff-view-container panel panel-default">' +
                            '<div class="panel-heading btn-toolbar" role="toolbar">' +
                                '<button type="button" class="btn btn-sm btn-default diff-ignore-whitespace" data-toggle="button">Ignore Whitespace</button>' +
                                '<button type="button" class="btn btn-sm btn-default diff-context-all" data-toggle="button">Complete file</button>' +
                                '<div class="btn-group btn-group-sm">' +
                                    '<span></span>&nbsp;' +
                                    '<button type="button" class="btn btn-default diff-context-remove">-</button>' +
                                    '<button type="button" class="btn btn-default diff-context-add">+</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="panel-body"></div>' +
                        '</div>')[0];
    var panelBody = $(".panel-body", self.element)[0];
    if (sideBySide) {
        var left = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
        panelBody.appendChild(left);
        var leftLines = left.firstChild;
        $(left).scroll(self.diffViewScrolled);
        left.prevScrollTop = left.scrollTop;
        left.prevScrollLeft = left.scrollLeft;
        var right = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
        panelBody.appendChild(right);
        var rightLines = right.firstChild;
        $(right).scroll(self.diffViewScrolled);
        right.prevScrollTop = right.scrollTop;
        right.prevScrollLeft = right.scrollLeft;
    } else {
        var single = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
        panelBody.appendChild(single);
        var singleLines = single.firstChild;
    }

    $(".diff-context-remove", self.element).click(self.removeContext);
    $(".diff-context-add", self.element).click(self.addContext);
    $(".diff-context-all", self.element).click(self.allContext);
    $(".diff-ignore-whitespace", self.element).click(self.toggleIgnoreWhitespace);
    self.context = 3;
    self.complete = false;
    self.ignoreWhitespace = true;
    var gitApplyType = "stage";
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
            var li = $('<li>' + name + '</li>');
            li.appendTo(breadcrumb);
            if (!last) {
                li.click(self.breadcrumbClicked);
            } else {
                li.addClass("active");
            }
        }
    }

    self.breadcrumbClicked = function(event) {
        var to = webui.getNodeIndex(event.target.parentElement);
        self.stack = self.stack.slice(0, to + 1);
        self.showTree();
    }

    self.showTree = function() {
        $(self.element.lastElementChild).remove();
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
                            '</a>');
                elt.click(function() {
                    self.stack.pop();
                    self.showTree();
                });
                elt.appendTo(treeViewTreeContent);
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
                    $(elt).click(function() {
                        self.stack.push({ name: elt.model.name, object: elt.model.object});
                        self.showTree();
                    });
                } else {
                    blobs.push(elt);
                    $(elt).click(function() {
                        self.stack.push({ name: elt.model.name, object: elt.model.object});
                        self.showBlob();
                    });
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
        $(self.element.lastElementChild).remove();
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
        diffView.update(["show", entry.commit]);
        treeView.update(entry.tree);
    };

    self.showDiff = function() {
        webui.detachChildren(commitViewContent);
        commitViewContent.appendChild(diffView.element);
    };

    self.showTree = function() {
        webui.detachChildren(commitViewContent);
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
        mainView.switchTo(self.element);
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
        mainView.switchTo(self.element);
    };

    self.update = function(mode) {
        self.show();
        self.diffView.update([], mode);
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
                    item.status = status;
                    line = line.substr(3);
                    var splitted = line.split(" -> ");
                    if (splitted.length > 1) {
                        item.model = splitted[1];
                    } else {
                        item.model = line
                    }
                    item.appendChild(document.createTextNode(line));
                    $(item).click(self.select);
                    $(item).dblclick(self.process);
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
            fileListContainer.scrollTop = prevScrollTop;
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
        var gitCmd = [ "diff" ];
        if (type == "staging-area") {
            gitCmd.push("--cached");
        }
        gitCmd.push("--");
        gitCmd.push(element.model);
        workspaceView.diffView.update(gitCmd, type == "working-copy" ? "stage" : "unstage");
    };

    self.unselect = function() {
        if (selectedIndex !== null) {
            $(fileList.children[selectedIndex]).removeClass("active");
            selectedIndex = null;
        }
    };

    self.getFileList = function(including, excluding) {
        var files = "";
        for (var i = 0; i < fileList.childElementCount; ++i) {
            var child = fileList.children[i];
            var included = including == undefined || including.indexOf(child.status) != -1;
            var excluded = excluding != undefined && excluding.indexOf(child.status) != -1;
            if ($(child).hasClass("active") && included && !excluded) {
                files += '"' + (child.model) + '" ';
            }
        }
        return files;
    }

    self.process = function() {
        prevScrollTop = fileListContainer.scrollTop;
        var files = self.getFileList(undefined, "D");
        var rmFiles = self.getFileList("D");
        if (files.length != 0) {
            var cmd = type == "working-copy" ? "add" : "reset";
            webui.git(cmd + " -- " + files, function(data) {
                if (rmFiles.length != 0) {
                    webui.git("rm -- " + rmFiles, function(data) {
                        workspaceView.update(type == "working-copy" ? "stage" : "unstage");
                    });
                } else {
                    workspaceView.update(type == "working-copy" ? "stage" : "unstage");
                }
            });
        } else if (rmFiles.length != 0) {
            var cmd = type == "working-copy" ? "rm" : "reset";
            webui.git(cmd + " -- " + rmFiles, function(data) {
                workspaceView.update(type == "working-copy" ? "stage" : "unstage");
            });
        }
    };

    self.cancel = function() {
        prevScrollTop = fileListContainer.scrollTop;
        var files = self.getFileList();
        if (files.length != 0) {
            webui.git("checkout -- " + files, function(data) {
                workspaceView.update("stage");
            });
        }
    }

    self.element = $(   '<div id="' + type + '-view" class="panel panel-default">' +
                            '<div class="panel-heading">' +
                                '<h5>'+ label + '</h5>' +
                                '<div class="btn-group btn-group-sm"></div>' +
                            '</div>' +
                            '<div class="file-list-container">' +
                                '<div class="list-group"></div>' +
                            '</div>' +
                        '</div>')[0];
    if (type == "working-copy") {
        var buttons = [{ name: "Stage", callback: self.process }, { name: "Cancel", callback: self.cancel }];
    } else {
        var buttons = [{ name: "Unstage", callback: self.process }];
    }
    var btnGroup = $(".btn-group", self.element);
    buttons.forEach(function (btnData) {
        var btn = $('<button type="button" class="btn btn-default">' + btnData.name + '</button>')
        btn.appendTo(btnGroup);
        btn.click(btnData.callback);
    });
    var fileListContainer = $(".file-list-container", self.element)[0];
    var prevScrollTop = fileListContainer.scrollTop;
    var fileList = $(".list-group", fileListContainer)[0];
    var selectedIndex = null;

    self.filesCount = 0;
};

/*
 * == CommitMessageView =======================================================
 */
webui.CommitMessageView = function(workspaceView) {

    var self = this;

    self.onAmend = function() {
        if (!amend.hasClass("active") && textArea.value.length == 0) {
            webui.git("log --pretty=format:%B -n 1", function(data) {
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
            if (amend.hasClass("active")) {
                cmd += "--amend ";
            }
            cmd += "--file=-";
            webui.git(cmd, textArea.value, function(data) {
                textArea.value = "";
                workspaceView.update("stage");
                amend.removeClass("active");
            });
        }
    }

    self.update = function() {
    }

    self.element = $(   '<div id="commit-message-view" class="panel panel-default">' +
                            '<div class="panel-heading">' +
                                '<h5>Message</h5>' +
                                '<div class="btn-group btn-group-sm">' +
                                    '<button type="button" class="btn btn-default commit-message-amend" data-toggle="button">Amend</button>' +
                                    '<button type="button" class="btn btn-default commit-message-commit">Commit</button>' +
                                '</div>' +
                            '</div>' +
                            '<textarea></textarea>' +
                        '</div>')[0];
    var textArea = $("textarea", self.element)[0];
    var amend = $(".commit-message-amend", self.element);
    amend.click(self.onAmend);
    $(".commit-message-commit", self.element).click(self.onCommit);
};

webui.RemoteView = function(mainView) {

    var self = this;

    self.show = function() {
        mainView.switchTo(self.element);
    };

    self.update = function() {
        self.show();
    };

    self.element = $(   '<div class="jumbotron">' +
                            '<h1>Remote access</h1>' +
                            '<p>Git webui allows other people to clone and pull from your repository.</p>' +
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

    self.switchTo = function(element) {
        webui.detachChildren(self.mainView);
        self.mainView.appendChild(element);
    }

    $.get("/dirname", function (data) {
        webui.repo = data;
        var title = $("title")[0];
        title.textContent = "Git - " + webui.repo;
        $.get("/viewonly", function (data) {
            webui.viewonly = data == "1";
            $.get("/hostname", function (data) {
                webui.hostname = data

                var body = $("body")[0];
                $('<div id="message-box">').appendTo(body);
                var globalContainer = $('<div id="global-container">').appendTo(body)[0];

                self.sideBarView = new webui.SideBarView(self);
                globalContainer.appendChild(self.sideBarView.element);

                self.mainView = $('<div id="main-view">')[0];
                globalContainer.appendChild(self.mainView);

                self.historyView = new webui.HistoryView(self);
                self.remoteView = new webui.RemoteView(self);
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
