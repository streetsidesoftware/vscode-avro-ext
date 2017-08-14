"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var jsonc_parser_1 = require("jsonc-parser");
var nls = require("vscode-nls");
var localize = nls.loadMessageBundle(__filename);
var PackageDocument = (function () {
    function PackageDocument(document) {
        this.document = document;
    }
    PackageDocument.prototype.provideCompletionItems = function (position, token) {
        var location = jsonc_parser_1.getLocation(this.document.getText(), this.document.offsetAt(position));
        if (location.path.length >= 2 && location.path[1] === 'configurationDefaults') {
            return this.provideLanguageOverridesCompletionItems(location, position);
        }
    };
    PackageDocument.prototype.provideLanguageOverridesCompletionItems = function (location, position) {
        var _this = this;
        var range = this.document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
        var text = this.document.getText(range);
        if (location.path.length === 2) {
            var snippet = '"[${1:language}]": {\n\t"$0"\n}';
            // Suggestion model word matching includes quotes,
            // hence exclude the starting quote from the snippet and the range
            // ending quote gets replaced
            if (text && text.startsWith('"')) {
                range = new vscode.Range(new vscode.Position(range.start.line, range.start.character + 1), range.end);
                snippet = snippet.substring(1);
            }
            return Promise.resolve([this.newSnippetCompletionItem({
                    label: localize(0, null),
                    documentation: localize(1, null),
                    snippet: snippet,
                    range: range
                })]);
        }
        if (location.path.length === 3 && location.previousNode && typeof location.previousNode.value === 'string' && location.previousNode.value.startsWith('[')) {
            // Suggestion model word matching includes starting quote and open sqaure bracket
            // Hence exclude them from the proposal range
            range = new vscode.Range(new vscode.Position(range.start.line, range.start.character + 2), range.end);
            return vscode.languages.getLanguages().then(function (languages) {
                return languages.map(function (l) {
                    // Suggestion model word matching includes closed sqaure bracket and ending quote
                    // Hence include them in the proposal to replace
                    return _this.newSimpleCompletionItem(l, range, '', l + ']"');
                });
            });
        }
        return Promise.resolve([]);
    };
    PackageDocument.prototype.newSimpleCompletionItem = function (text, range, description, insertText) {
        var item = new vscode.CompletionItem(text);
        item.kind = vscode.CompletionItemKind.Value;
        item.detail = description;
        item.insertText = insertText ? insertText : text;
        item.range = range;
        return item;
    };
    PackageDocument.prototype.newSnippetCompletionItem = function (o) {
        var item = new vscode.CompletionItem(o.label);
        item.kind = vscode.CompletionItemKind.Value;
        item.documentation = o.documentation;
        item.insertText = new vscode.SnippetString(o.snippet);
        item.range = o.range;
        return item;
    };
    return PackageDocument;
}());
exports.PackageDocument = PackageDocument;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/extension-editing/out/packageDocumentHelper.js.map
