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
var SettingsDocument = (function () {
    function SettingsDocument(document) {
        this.document = document;
    }
    SettingsDocument.prototype.provideCompletionItems = function (position, token) {
        var location = jsonc_parser_1.getLocation(this.document.getText(), this.document.offsetAt(position));
        var range = this.document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
        // window.title
        if (location.path[0] === 'window.title') {
            return this.provideWindowTitleCompletionItems(location, range);
        }
        // files.association
        if (location.path[0] === 'files.associations') {
            return this.provideFilesAssociationsCompletionItems(location, range);
        }
        // files.exclude, search.exclude
        if (location.path[0] === 'files.exclude' || location.path[0] === 'search.exclude') {
            return this.provideExcludeCompletionItems(location, range);
        }
        // files.defaultLanguage
        if (location.path[0] === 'files.defaultLanguage') {
            return this.provideLanguageCompletionItems(location, range);
        }
        return this.provideLanguageOverridesCompletionItems(location, position);
    };
    SettingsDocument.prototype.provideWindowTitleCompletionItems = function (location, range) {
        var completions = [];
        completions.push(this.newSimpleCompletionItem('${activeEditorShort}', range, localize(0, null)));
        completions.push(this.newSimpleCompletionItem('${activeEditorMedium}', range, localize(1, null)));
        completions.push(this.newSimpleCompletionItem('${activeEditorLong}', range, localize(2, null)));
        completions.push(this.newSimpleCompletionItem('${rootName}', range, localize(3, null)));
        completions.push(this.newSimpleCompletionItem('${rootPath}', range, localize(4, null)));
        completions.push(this.newSimpleCompletionItem('${folderName}', range, localize(5, null)));
        completions.push(this.newSimpleCompletionItem('${folderPath}', range, localize(6, null)));
        completions.push(this.newSimpleCompletionItem('${appName}', range, localize(7, null)));
        completions.push(this.newSimpleCompletionItem('${dirty}', range, localize(8, null)));
        completions.push(this.newSimpleCompletionItem('${separator}', range, localize(9, null)));
        return Promise.resolve(completions);
    };
    SettingsDocument.prototype.provideFilesAssociationsCompletionItems = function (location, range) {
        var completions = [];
        // Key
        if (location.path.length === 1) {
            completions.push(this.newSnippetCompletionItem({
                label: localize(10, null),
                documentation: localize(11, null),
                snippet: location.isAtPropertyKey ? '"*.${1:extension}": "${2:language}"' : '{ "*.${1:extension}": "${2:language}" }',
                range: range
            }));
            completions.push(this.newSnippetCompletionItem({
                label: localize(12, null),
                documentation: localize(13, null),
                snippet: location.isAtPropertyKey ? '"/${1:path to file}/*.${2:extension}": "${3:language}"' : '{ "/${1:path to file}/*.${2:extension}": "${3:language}" }',
                range: range
            }));
        }
        else if (location.path.length === 2 && !location.isAtPropertyKey) {
            return this.provideLanguageCompletionItems(location, range);
        }
        return Promise.resolve(completions);
    };
    SettingsDocument.prototype.provideExcludeCompletionItems = function (location, range) {
        var completions = [];
        // Key
        if (location.path.length === 1) {
            completions.push(this.newSnippetCompletionItem({
                label: localize(14, null),
                documentation: localize(15, null),
                snippet: location.isAtPropertyKey ? '"**/*.${1:extension}": true' : '{ "**/*.${1:extension}": true }',
                range: range
            }));
            completions.push(this.newSnippetCompletionItem({
                label: localize(16, null),
                documentation: localize(17, null),
                snippet: location.isAtPropertyKey ? '"**/*.{ext1,ext2,ext3}": true' : '{ "**/*.{ext1,ext2,ext3}": true }',
                range: range
            }));
            completions.push(this.newSnippetCompletionItem({
                label: localize(18, null),
                documentation: localize(19, null),
                snippet: location.isAtPropertyKey ? '"**/*.${1:source-extension}": { "when": "$(basename).${2:target-extension}" }' : '{ "**/*.${1:source-extension}": { "when": "$(basename).${2:target-extension}" } }',
                range: range
            }));
            completions.push(this.newSnippetCompletionItem({
                label: localize(20, null),
                documentation: localize(21, null),
                snippet: location.isAtPropertyKey ? '"${1:name}": true' : '{ "${1:name}": true }',
                range: range
            }));
            completions.push(this.newSnippetCompletionItem({
                label: localize(22, null),
                documentation: localize(23, null),
                snippet: location.isAtPropertyKey ? '"{folder1,folder2,folder3}": true' : '{ "{folder1,folder2,folder3}": true }',
                range: range
            }));
            completions.push(this.newSnippetCompletionItem({
                label: localize(24, null),
                documentation: localize(25, null),
                snippet: location.isAtPropertyKey ? '"**/${1:name}": true' : '{ "**/${1:name}": true }',
                range: range
            }));
        }
        else {
            completions.push(this.newSimpleCompletionItem('false', range, localize(26, null)));
            completions.push(this.newSimpleCompletionItem('true', range, localize(27, null)));
            completions.push(this.newSnippetCompletionItem({
                label: localize(28, null),
                documentation: localize(29, null),
                snippet: '{ "when": "$(basename).${1:extension}" }',
                range: range
            }));
        }
        return Promise.resolve(completions);
    };
    SettingsDocument.prototype.provideLanguageCompletionItems = function (location, range, formatFunc) {
        var _this = this;
        if (formatFunc === void 0) { formatFunc = function (l) { return JSON.stringify(l); }; }
        return vscode.languages.getLanguages().then(function (languages) {
            return languages.map(function (l) {
                return _this.newSimpleCompletionItem(formatFunc(l), range);
            });
        });
    };
    SettingsDocument.prototype.provideLanguageOverridesCompletionItems = function (location, position) {
        var range = this.document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
        var text = this.document.getText(range);
        if (location.path.length === 0) {
            var snippet = '"[${1:language}]": {\n\t"$0"\n}';
            // Suggestion model word matching includes quotes,
            // hence exclude the starting quote from the snippet and the range
            // ending quote gets replaced
            if (text && text.startsWith('"')) {
                range = new vscode.Range(new vscode.Position(range.start.line, range.start.character + 1), range.end);
                snippet = snippet.substring(1);
            }
            return Promise.resolve([this.newSnippetCompletionItem({
                    label: localize(30, null),
                    documentation: localize(31, null),
                    snippet: snippet,
                    range: range
                })]);
        }
        if (location.path.length === 1 && location.previousNode && typeof location.previousNode.value === 'string' && location.previousNode.value.startsWith('[')) {
            // Suggestion model word matching includes closed sqaure bracket and ending quote
            // Hence include them in the proposal to replace
            return this.provideLanguageCompletionItems(location, range, function (language) { return "\"[" + language + "]\""; });
        }
        return Promise.resolve([]);
    };
    SettingsDocument.prototype.newSimpleCompletionItem = function (text, range, description, insertText) {
        var item = new vscode.CompletionItem(text);
        item.kind = vscode.CompletionItemKind.Value;
        item.detail = description;
        item.insertText = insertText ? insertText : text;
        item.range = range;
        return item;
    };
    SettingsDocument.prototype.newSnippetCompletionItem = function (o) {
        var item = new vscode.CompletionItem(o.label);
        item.kind = vscode.CompletionItemKind.Value;
        item.documentation = o.documentation;
        item.insertText = new vscode.SnippetString(o.snippet);
        item.range = o.range;
        return item;
    };
    return SettingsDocument;
}());
exports.SettingsDocument = SettingsDocument;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/configuration-editing/out/settingsDocumentHelper.js.map
