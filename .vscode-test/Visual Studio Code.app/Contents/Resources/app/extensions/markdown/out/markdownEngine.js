/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var path = require("path");
var tableOfContentsProvider_1 = require("./tableOfContentsProvider");
var FrontMatterRegex = /^---\s*[^]*?(-{3}|\.{3})\s*/;
var MarkdownEngine = (function () {
    function MarkdownEngine() {
        this.plugins = [];
    }
    MarkdownEngine.prototype.addPlugin = function (factory) {
        if (this.md) {
            this.usePlugin(factory);
        }
        else {
            this.plugins.push(factory);
        }
    };
    MarkdownEngine.prototype.usePlugin = function (factory) {
        try {
            this.md = factory(this.md);
        }
        catch (e) {
            // noop
        }
    };
    Object.defineProperty(MarkdownEngine.prototype, "engine", {
        get: function () {
            var _this = this;
            if (!this.md) {
                var hljs_1 = require('highlight.js');
                var mdnh = require('markdown-it-named-headers');
                this.md = require('markdown-it')({
                    html: true,
                    highlight: function (str, lang) {
                        if (lang && hljs_1.getLanguage(lang)) {
                            try {
                                return "<pre class=\"hljs\"><code><div>" + hljs_1.highlight(lang, str, true).value + "</div></code></pre>";
                            }
                            catch (error) { }
                        }
                        return "<pre class=\"hljs\"><code><div>" + _this.engine.utils.escapeHtml(str) + "</div></code></pre>";
                    }
                }).use(mdnh, {
                    slugify: function (header) { return tableOfContentsProvider_1.TableOfContentsProvider.slugify(header); }
                });
                for (var _i = 0, _a = this.plugins; _i < _a.length; _i++) {
                    var plugin = _a[_i];
                    this.usePlugin(plugin);
                }
                this.plugins = [];
                for (var _b = 0, _c = ['paragraph_open', 'heading_open', 'image', 'code_block', 'blockquote_open', 'list_item_open']; _b < _c.length; _b++) {
                    var renderName = _c[_b];
                    this.addLineNumberRenderer(this.md, renderName);
                }
                this.addLinkNormalizer(this.md);
                this.addLinkValidator(this.md);
            }
            this.md.set({ breaks: vscode.workspace.getConfiguration('markdown').get('preview.breaks', false) });
            return this.md;
        },
        enumerable: true,
        configurable: true
    });
    MarkdownEngine.prototype.stripFrontmatter = function (text) {
        var offset = 0;
        var frontMatterMatch = FrontMatterRegex.exec(text);
        if (frontMatterMatch) {
            var frontMatter = frontMatterMatch[0];
            offset = frontMatter.split(/\r\n|\n|\r/g).length - 1;
            text = text.substr(frontMatter.length);
        }
        return { text: text, offset: offset };
    };
    MarkdownEngine.prototype.render = function (document, stripFrontmatter, text) {
        var offset = 0;
        if (stripFrontmatter) {
            var markdownContent = this.stripFrontmatter(text);
            offset = markdownContent.offset;
            text = markdownContent.text;
        }
        this.currentDocument = document;
        this.firstLine = offset;
        return this.engine.render(text);
    };
    MarkdownEngine.prototype.parse = function (document, source) {
        var _a = this.stripFrontmatter(source), text = _a.text, offset = _a.offset;
        this.currentDocument = document;
        return this.engine.parse(text, {}).map(function (token) {
            if (token.map) {
                token.map[0] += offset;
            }
            return token;
        });
    };
    MarkdownEngine.prototype.addLineNumberRenderer = function (md, ruleName) {
        var _this = this;
        var original = md.renderer.rules[ruleName];
        md.renderer.rules[ruleName] = function (tokens, idx, options, env, self) {
            var token = tokens[idx];
            if (token.map && token.map.length) {
                token.attrSet('data-line', _this.firstLine + token.map[0]);
                token.attrJoin('class', 'code-line');
            }
            if (original) {
                return original(tokens, idx, options, env, self);
            }
            else {
                return self.renderToken(tokens, idx, options, env, self);
            }
        };
    };
    MarkdownEngine.prototype.addLinkNormalizer = function (md) {
        var _this = this;
        var normalizeLink = md.normalizeLink;
        md.normalizeLink = function (link) {
            try {
                var uri = vscode.Uri.parse(link);
                if (!uri.scheme && uri.path && !uri.fragment) {
                    // Assume it must be a file
                    if (uri.path[0] === '/') {
                        uri = vscode.Uri.file(path.join(vscode.workspace.rootPath || '', uri.path));
                    }
                    else {
                        uri = vscode.Uri.file(path.join(path.dirname(_this.currentDocument.path), uri.path));
                    }
                    return normalizeLink(uri.toString(true));
                }
            }
            catch (e) {
                // noop
            }
            return normalizeLink(link);
        };
    };
    MarkdownEngine.prototype.addLinkValidator = function (md) {
        var validateLink = md.validateLink;
        md.validateLink = function (link) {
            // support file:// links
            return validateLink(link) || link.indexOf('file:') === 0;
        };
    };
    return MarkdownEngine;
}());
exports.MarkdownEngine = MarkdownEngine;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/markdown/out/markdownEngine.js.map
