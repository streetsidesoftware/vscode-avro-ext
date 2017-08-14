/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var TableOfContentsProvider = (function () {
    function TableOfContentsProvider(engine, document) {
        this.engine = engine;
        this.document = document;
    }
    TableOfContentsProvider.prototype.getToc = function () {
        if (!this.toc) {
            try {
                this.toc = this.buildToc(this.document);
            }
            catch (e) {
                this.toc = [];
            }
        }
        return this.toc;
    };
    TableOfContentsProvider.prototype.lookup = function (fragment) {
        var slug = TableOfContentsProvider.slugify(fragment);
        for (var _i = 0, _a = this.getToc(); _i < _a.length; _i++) {
            var entry = _a[_i];
            if (entry.slug === slug) {
                return entry.line;
            }
        }
        return NaN;
    };
    TableOfContentsProvider.prototype.buildToc = function (document) {
        var toc = [];
        var tokens = this.engine.parse(document.uri, document.getText());
        for (var _i = 0, _a = tokens.filter(function (token) { return token.type === 'heading_open'; }); _i < _a.length; _i++) {
            var heading = _a[_i];
            var lineNumber = heading.map[0];
            var line = document.lineAt(lineNumber);
            var href = TableOfContentsProvider.slugify(line.text);
            if (href) {
                toc.push({
                    slug: href,
                    text: TableOfContentsProvider.getHeaderText(line.text),
                    line: lineNumber,
                    location: new vscode.Location(document.uri, line.range)
                });
            }
        }
        return toc;
    };
    TableOfContentsProvider.getHeaderText = function (header) {
        return header.replace(/^\s*(#+)\s*(.*?)\s*\1*$/, function (_, level, word) { return level + " " + word.trim(); });
    };
    TableOfContentsProvider.slugify = function (header) {
        return encodeURI(header.trim()
            .toLowerCase()
            .replace(/[\]\[\!\"\#\$\%\&\'\(\)\*\+\,\.\/\:\;\<\=\>\?\@\\\^\_\{\|\}\~]/g, '')
            .replace(/\s+/g, '-')
            .replace(/^\-+/, '')
            .replace(/\-+$/, ''));
    };
    return TableOfContentsProvider;
}());
exports.TableOfContentsProvider = TableOfContentsProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/markdown/out/tableOfContentsProvider.js.map
