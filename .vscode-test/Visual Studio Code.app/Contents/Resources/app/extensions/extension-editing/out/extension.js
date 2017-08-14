/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var ts = require("typescript");
var packageDocumentHelper_1 = require("./packageDocumentHelper");
var extensionLinter_1 = require("./extensionLinter");
function activate(context) {
    var registration = vscode.languages.registerDocumentLinkProvider({ language: 'typescript', pattern: '**/vscode.d.ts' }, _linkProvider);
    context.subscriptions.push(registration);
    //package.json suggestions
    context.subscriptions.push(registerPackageDocumentCompletions());
    context.subscriptions.push(new extensionLinter_1.ExtensionLinter(context));
}
exports.activate = activate;
var _linkProvider = new (function () {
    function class_1() {
        this._linkPattern = /[^!]\[.*?\]\(#(.*?)\)/g;
    }
    class_1.prototype.provideDocumentLinks = function (document, token) {
        var version = document.version;
        if (!this._cachedResult || this._cachedResult.version !== version) {
            var links = this._computeDocumentLinks(document);
            this._cachedResult = { version: version, links: links };
        }
        return this._cachedResult.links;
    };
    class_1.prototype._computeDocumentLinks = function (document) {
        var results = [];
        var text = document.getText();
        var lookUp = ast.createNamedNodeLookUp(text);
        this._linkPattern.lastIndex = 0;
        var match;
        while ((match = this._linkPattern.exec(text))) {
            var offset = lookUp(match[1]);
            if (offset === -1) {
                console.warn(match[1]);
                continue;
            }
            var targetPos = document.positionAt(offset);
            var linkEnd = document.positionAt(this._linkPattern.lastIndex - 1);
            var linkStart = linkEnd.translate({ characterDelta: -(1 + match[1].length) });
            results.push(new vscode.DocumentLink(new vscode.Range(linkStart, linkEnd), document.uri.with({ fragment: "" + (1 + targetPos.line) })));
        }
        return results;
    };
    return class_1;
}());
var ast;
(function (ast) {
    function createNamedNodeLookUp(str) {
        var sourceFile = ts.createSourceFile('fake.d.ts', str, ts.ScriptTarget.Latest);
        var identifiers = [];
        var spans = [];
        ts.forEachChild(sourceFile, function visit(node) {
            var declIdent = node.name;
            if (declIdent && declIdent.kind === ts.SyntaxKind.Identifier) {
                identifiers.push(declIdent.text);
                spans.push(node.pos, node.end);
            }
            ts.forEachChild(node, visit);
        });
        return function (dottedName) {
            var start = -1;
            var end = Number.MAX_VALUE;
            for (var _i = 0, _a = dottedName.split('.'); _i < _a.length; _i++) {
                var name = _a[_i];
                var idx = -1;
                while ((idx = identifiers.indexOf(name, idx + 1)) >= 0) {
                    var myStart = spans[2 * idx];
                    var myEnd = spans[2 * idx + 1];
                    if (myStart >= start && myEnd <= end) {
                        start = myStart;
                        end = myEnd;
                        break;
                    }
                }
                if (idx < 0) {
                    return -1;
                }
            }
            return start;
        };
    }
    ast.createNamedNodeLookUp = createNamedNodeLookUp;
})(ast || (ast = {}));
function registerPackageDocumentCompletions() {
    return vscode.languages.registerCompletionItemProvider({ language: 'json', pattern: '**/package.json' }, {
        provideCompletionItems: function (document, position, token) {
            return new packageDocumentHelper_1.PackageDocument(document).provideCompletionItems(position, token);
        }
    });
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/extension-editing/out/extension.js.map
