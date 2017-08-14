/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var path = require("path");
var nls = require("vscode-nls");
var localize = nls.loadMessageBundle(__filename);
var previewStrings = {
    cspAlertMessageText: localize(0, null),
    cspAlertMessageTitle: localize(1, null),
    cspAlertMessageLabel: localize(2, null)
};
function isMarkdownFile(document) {
    return document.languageId === 'markdown'
        && document.uri.scheme !== 'markdown'; // prevent processing of own documents
}
exports.isMarkdownFile = isMarkdownFile;
function getMarkdownUri(uri) {
    if (uri.scheme === 'markdown') {
        return uri;
    }
    return uri.with({
        scheme: 'markdown',
        path: uri.path + '.rendered',
        query: uri.toString()
    });
}
exports.getMarkdownUri = getMarkdownUri;
var MarkdownPreviewConfig = (function () {
    function MarkdownPreviewConfig() {
        var editorConfig = vscode.workspace.getConfiguration('editor');
        var markdownConfig = vscode.workspace.getConfiguration('markdown');
        var markdownEditorConfig = vscode.workspace.getConfiguration('[markdown]');
        this.scrollBeyondLastLine = editorConfig.get('scrollBeyondLastLine', false);
        this.wordWrap = editorConfig.get('wordWrap', 'off') !== 'off';
        if (markdownEditorConfig && markdownEditorConfig['editor.wordWrap']) {
            this.wordWrap = markdownEditorConfig['editor.wordWrap'] !== 'off';
        }
        this.previewFrontMatter = markdownConfig.get('previewFrontMatter', 'hide');
        this.scrollPreviewWithEditorSelection = !!markdownConfig.get('preview.scrollPreviewWithEditorSelection', true);
        this.scrollEditorWithPreview = !!markdownConfig.get('preview.scrollEditorWithPreview', true);
        this.lineBreaks = !!markdownConfig.get('preview.breaks', false);
        this.doubleClickToSwitchToEditor = !!markdownConfig.get('preview.doubleClickToSwitchToEditor', true);
        this.markEditorSelection = !!markdownConfig.get('preview.markEditorSelection', true);
        this.fontFamily = markdownConfig.get('preview.fontFamily', undefined);
        this.fontSize = Math.max(8, +markdownConfig.get('preview.fontSize', NaN));
        this.lineHeight = Math.max(0.6, +markdownConfig.get('preview.lineHeight', NaN));
        this.styles = markdownConfig.get('styles', []);
    }
    MarkdownPreviewConfig.getCurrentConfig = function () {
        return new MarkdownPreviewConfig();
    };
    MarkdownPreviewConfig.prototype.isEqualTo = function (otherConfig) {
        for (var key in this) {
            if (this.hasOwnProperty(key) && key !== 'styles') {
                if (this[key] !== otherConfig[key]) {
                    return false;
                }
            }
        }
        // Check styles
        if (this.styles.length !== otherConfig.styles.length) {
            return false;
        }
        for (var i = 0; i < this.styles.length; ++i) {
            if (this.styles[i] !== otherConfig.styles[i]) {
                return false;
            }
        }
        return true;
    };
    return MarkdownPreviewConfig;
}());
var MDDocumentContentProvider = (function () {
    function MDDocumentContentProvider(engine, context, cspArbiter, logger) {
        this.engine = engine;
        this.context = context;
        this.cspArbiter = cspArbiter;
        this.logger = logger;
        this._onDidChange = new vscode.EventEmitter();
        this._waiting = false;
        this.extraStyles = [];
        this.extraScripts = [];
        this.config = MarkdownPreviewConfig.getCurrentConfig();
    }
    MDDocumentContentProvider.prototype.addScript = function (resource) {
        this.extraScripts.push(resource);
    };
    MDDocumentContentProvider.prototype.addStyle = function (resource) {
        this.extraStyles.push(resource);
    };
    MDDocumentContentProvider.prototype.getMediaPath = function (mediaFile) {
        return vscode.Uri.file(this.context.asAbsolutePath(path.join('media', mediaFile))).toString();
    };
    MDDocumentContentProvider.prototype.fixHref = function (resource, href) {
        if (!href) {
            return href;
        }
        // Use href if it is already an URL
        var hrefUri = vscode.Uri.parse(href);
        if (['file', 'http', 'https'].indexOf(hrefUri.scheme) >= 0) {
            return hrefUri.toString();
        }
        // Use href as file URI if it is absolute
        if (path.isAbsolute(href)) {
            return vscode.Uri.file(href).toString();
        }
        // use a workspace relative path if there is a workspace
        var rootPath = vscode.workspace.rootPath;
        if (rootPath) {
            return vscode.Uri.file(path.join(rootPath, href)).toString();
        }
        // otherwise look relative to the markdown file
        return vscode.Uri.file(path.join(path.dirname(resource.fsPath), href)).toString();
    };
    MDDocumentContentProvider.prototype.computeCustomStyleSheetIncludes = function (uri) {
        var _this = this;
        if (this.config.styles && Array.isArray(this.config.styles)) {
            return this.config.styles.map(function (style) {
                return "<link rel=\"stylesheet\" class=\"code-user-style\" data-source=\"" + style.replace(/"/g, '&quot;') + "\" href=\"" + _this.fixHref(uri, style) + "\" type=\"text/css\" media=\"screen\">";
            }).join('\n');
        }
        return '';
    };
    MDDocumentContentProvider.prototype.getSettingsOverrideStyles = function (nonce) {
        return "<style nonce=\"" + nonce + "\">\n\t\t\tbody {\n\t\t\t\t" + (this.config.fontFamily ? "font-family: " + this.config.fontFamily + ";" : '') + "\n\t\t\t\t" + (isNaN(this.config.fontSize) ? '' : "font-size: " + this.config.fontSize + "px;") + "\n\t\t\t\t" + (isNaN(this.config.lineHeight) ? '' : "line-height: " + this.config.lineHeight + ";") + "\n\t\t\t}\n\t\t</style>";
    };
    MDDocumentContentProvider.prototype.getStyles = function (uri, nonce) {
        var baseStyles = [
            this.getMediaPath('markdown.css'),
            this.getMediaPath('tomorrow.css')
        ].concat(this.extraStyles.map(function (resource) { return resource.toString(); }));
        return baseStyles.map(function (href) { return "<link rel=\"stylesheet\" type=\"text/css\" href=\"" + href + "\">"; }).join('\n') + "\n\t\t\t" + this.getSettingsOverrideStyles(nonce) + "\n\t\t\t" + this.computeCustomStyleSheetIncludes(uri);
    };
    MDDocumentContentProvider.prototype.getScripts = function (nonce) {
        var scripts = [this.getMediaPath('main.js')].concat(this.extraScripts.map(function (resource) { return resource.toString(); }));
        return scripts
            .map(function (source) { return "<script async src=\"" + source + "\" nonce=\"" + nonce + "\"></script>"; })
            .join('\n');
    };
    MDDocumentContentProvider.prototype.provideTextDocumentContent = function (uri) {
        var _this = this;
        var sourceUri = vscode.Uri.parse(uri.query);
        var initialLine = undefined;
        var editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === sourceUri.fsPath) {
            initialLine = editor.selection.active.line;
        }
        return vscode.workspace.openTextDocument(sourceUri).then(function (document) {
            _this.config = MarkdownPreviewConfig.getCurrentConfig();
            var initialData = {
                previewUri: uri.toString(),
                source: sourceUri.toString(),
                line: initialLine,
                scrollPreviewWithEditorSelection: _this.config.scrollPreviewWithEditorSelection,
                scrollEditorWithPreview: _this.config.scrollEditorWithPreview,
                doubleClickToSwitchToEditor: _this.config.doubleClickToSwitchToEditor
            };
            _this.logger.log('provideTextDocumentContent', initialData);
            // Content Security Policy
            var nonce = new Date().getTime() + '' + new Date().getMilliseconds();
            var csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; img-src 'self' http: https: data:; media-src 'self' http: https: data:; child-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'self' 'unsafe-inline' http: https: data:; font-src 'self' http: https: data:;\">";
            if (_this.cspArbiter.isEnhancedSecurityDisableForWorkspace(vscode.workspace.rootPath || sourceUri.toString())) {
                csp = '';
            }
            var body = _this.engine.render(sourceUri, _this.config.previewFrontMatter === 'hide', document.getText());
            return "<!DOCTYPE html>\n\t\t\t\t<html>\n\t\t\t\t<head>\n\t\t\t\t\t<meta http-equiv=\"Content-type\" content=\"text/html;charset=UTF-8\">\n\t\t\t\t\t" + csp + "\n\t\t\t\t\t<meta id=\"vscode-markdown-preview-data\" data-settings=\"" + JSON.stringify(initialData).replace(/"/g, '&quot;') + "\" data-strings=\"" + JSON.stringify(previewStrings).replace(/"/g, '&quot;') + "\">\n\t\t\t\t\t<script src=\"" + _this.getMediaPath('csp.js') + "\" nonce=\"" + nonce + "\"></script>\n\t\t\t\t\t<script src=\"" + _this.getMediaPath('loading.js') + "\" nonce=\"" + nonce + "\"></script>\n\t\t\t\t\t" + _this.getStyles(uri, nonce) + "\n\t\t\t\t\t<base href=\"" + document.uri.toString(true) + "\">\n\t\t\t\t</head>\n\t\t\t\t<body class=\"vscode-body " + (_this.config.scrollBeyondLastLine ? 'scrollBeyondLastLine' : '') + " " + (_this.config.wordWrap ? 'wordWrap' : '') + " " + (_this.config.markEditorSelection ? 'showEditorSelection' : '') + "\">\n\t\t\t\t\t" + body + "\n\t\t\t\t\t<div class=\"code-line\" data-line=\"" + document.lineCount + "\"></div>\n\t\t\t\t\t" + _this.getScripts(nonce) + "\n\t\t\t\t</body>\n\t\t\t\t</html>";
        });
    };
    MDDocumentContentProvider.prototype.updateConfiguration = function () {
        var _this = this;
        var newConfig = MarkdownPreviewConfig.getCurrentConfig();
        if (!this.config.isEqualTo(newConfig)) {
            this.config = newConfig;
            // update all generated md documents
            vscode.workspace.textDocuments.forEach(function (document) {
                if (document.uri.scheme === 'markdown') {
                    _this.update(document.uri);
                }
            });
        }
    };
    Object.defineProperty(MDDocumentContentProvider.prototype, "onDidChange", {
        get: function () {
            return this._onDidChange.event;
        },
        enumerable: true,
        configurable: true
    });
    MDDocumentContentProvider.prototype.update = function (uri) {
        var _this = this;
        if (!this._waiting) {
            this._waiting = true;
            setTimeout(function () {
                _this._waiting = false;
                _this._onDidChange.fire(uri);
            }, 300);
        }
    };
    return MDDocumentContentProvider;
}());
exports.MDDocumentContentProvider = MDDocumentContentProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/markdown/out/previewContentProvider.js.map
