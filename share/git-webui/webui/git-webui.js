"use strict"

var webui = webui || {};

webui.git = function(cmd, callback) {
    $.post("git", cmd, function(data, status, xhr) {
        if (xhr.status == 200) {
            callback(data);
        } else {
            console.log(status + " " + data);
        }
    }, "text")
    .fail(function(xhr, status, error) {
        console.log(status + " "  + error);
    });
};

/*
 * == SideBar =================================================================
 */
webui.SideBar = function(rootElement) {

    var sideBar = this;

    webui.git("branch", function(data) {
        var branches = data.split("\n").filter(function(s) { return s.length > 0; });
        rootElement.appendChild($("<h1>Branches</h1>")[0]);
        var ul = $("<ul>").appendTo(rootElement)[0];
        branches.forEach(function (branch) {
            var name = branch.substr(2);
            var li = $("<li>" + name + "</li>").appendTo(ul)[0];
            li.name = name;
            $(li).click(function (event) { sideBar.selectRef(li); });
            if (branch.substr(0, 1) == "*") {
                $(li).addClass("branch-current")
                window.setTimeout(function() { sideBar.selectRef(li); }, 0);
            }
        });
    });

    webui.git("tag", function(data) {
        var tags = data.split("\n").filter(function(s) { return s.length > 0; });
        if (tags.length > 0) {
            rootElement.appendChild($("<h1>Tags</h1>")[0]);
            var ul = $("<ul>").appendTo(rootElement)[0];
            rootElement.appendChild(ul);
            tags.forEach(function (tag) {
                var li = $("<li>" + tag + "</li>").appendTo(ul)[0];
                li.name = tag;
                $(li).click(function (event) { sideBar.selectRef(li); });
            });
        }
    });

    this.selectRef = function(li) {
        var ul = li.parentElement;
        var selected = $(".sidebar-ref-selected", ul);
        if (selected.length > 0) {
            selected = selected[0];
        } else {
            selected = undefined;
        }
        if (selected != li) {
            if (selected != undefined) {
                $(selected).toggleClass("sidebar-ref-selected");
            }
            $(li).toggleClass("sidebar-ref-selected");
            window.historyView.update(li.name);
        }
    };
};

/*
 * == LogView =================================================================
 */
webui.LogView = function(rootElement, commitView) {

    this.update = function(ref) {
        $(rootElement).empty();
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
                rootElement.appendChild(entry.createView());
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
        }

        this.abbrevMessage = function() {
            var end = this.message.indexOf("\n");
            if (end == -1) {
                return this.message
            } else {
                return this.message.substr(0, end);
            }
        }

        this.createView = function() {
            var view = $('<div class="log-entry">' +
                            '<div class="log-entry-header">' +
                                '<pre class="log-entry-hash">' + this.abbrevCommitHash() + '</pre> ' +
                                '<span class="log-entry-name">' + this.author.name + '</span> ' +
                                '<span  class="log-entry-date">' + this.author.date.toLocaleString() + '</span>' +
                            '</div>' +
                            '<div class="log-entry-message">' + this.abbrevMessage() + '</div>' +
                        '</div>')[0];
            view.model = this;
            $(view).click(function (event) { commitView.update(view.model); });
            return view;
        }
    };
}

/*
 * == CommitView ==============================================================
 */
webui.CommitView = function(rootElement) {

    this.update = function(entry) {
        $(rootElement).empty();

        var diffView = $('<div class="diff-view">').appendTo(rootElement)[0];
        var inHeader = true;
        webui.git("diff " + entry.commit, function(data) {
            data.split("\n").forEach(function (line) {
                var pre = $('<pre class="diff-view-line">' + line + '</pre>').appendTo(diffView)[0];
                var c = line[0];
                if (inHeader) {
                    $(pre).addClass("diff-line-header");
                }
                if (c == '+') {
                    $(pre).addClass("diff-line-add");
                } else if (c == '-') {
                    $(pre).addClass("diff-line-del");
                } else if (c == '@') {
                    $(pre).addClass("diff-line-offset");
                    inHeader = false;
                } else if (c == 'd') {
                    inHeader = true;
                    $(pre).addClass("diff-line-header");
                }
            });
        });
    }
}

/*
 * == HistoryView =============================================================
 */
webui.HistoryView = function(rootElement) {

    var historyView = this;
    var mainView = $('<div id="history-view"><div id="log-view"></div><div id="commit-view"></div></div>')[0];
    var commitView = new webui.CommitView($("#commit-view", mainView)[0]);
    var logView = new webui.LogView($("#log-view", mainView)[0], commitView);

    this.show = function() {
        $(rootElement).empty();
        rootElement.appendChild(mainView);
    };

    this.update = function(ref) {
        this.show();
        logView.update(ref);
    }


}

$(document).ready(function () {
    window.sideBar = new webui.SideBar($("#sidebar-content")[0]);
    window.historyView = new webui.HistoryView($("#main")[0]);
});
