/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var path = require("path");
var MarkdownDocumentLinkProvider = (function () {
    function MarkdownDocumentLinkProvider() {
        this._linkPattern = /(\[[^\]]*\]\(\s*?)(((((?=.*\)\)+)|(?=.*\)\]+))[^\s\)]+?)|([^\s]+)))\)/g;
    }
    MarkdownDocumentLinkProvider.prototype.provideDocumentLinks = function (document, _token) {
        var results = [];
        var base = path.dirname(document.uri.fsPath);
        var text = document.getText();
        this._linkPattern.lastIndex = 0;
        var match;
        while ((match = this._linkPattern.exec(text))) {
            var pre = match[1];
            var link = match[2];
            var offset = (match.index || 0) + pre.length;
            var linkStart = document.positionAt(offset);
            var linkEnd = document.positionAt(offset + link.length);
            try {
                results.push(new vscode.DocumentLink(new vscode.Range(linkStart, linkEnd), this.normalizeLink(document, link, base)));
            }
            catch (e) {
                // noop
            }
        }
        return results;
    };
    MarkdownDocumentLinkProvider.prototype.normalizeLink = function (document, link, base) {
        var uri = vscode.Uri.parse(link);
        if (uri.scheme) {
            return uri;
        }
        // assume it must be a file
        var resourcePath;
        if (!uri.path) {
            resourcePath = document.uri.path;
        }
        else if (uri.path[0] === '/') {
            resourcePath = path.join(vscode.workspace.rootPath || '', uri.path);
        }
        else {
            resourcePath = path.join(base, uri.path);
        }
        return vscode.Uri.parse("command:_markdown.openDocumentLink?" + encodeURIComponent(JSON.stringify({ fragment: uri.fragment, path: resourcePath })));
    };
    return MarkdownDocumentLinkProvider;
}());
exports.default = MarkdownDocumentLinkProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/markdown/out/documentLinkProvider.js.map
