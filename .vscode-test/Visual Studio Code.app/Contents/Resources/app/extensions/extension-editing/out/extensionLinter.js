"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var jsonc_parser_1 = require("jsonc-parser");
var nls = require("vscode-nls");
var MarkdownIt = require("markdown-it");
var parse5 = require("parse5");
var vscode_1 = require("vscode");
var product = require('../../../product.json');
var allowedBadgeProviders = (product.extensionAllowedBadgeProviders || []).map(function (s) { return s.toLowerCase(); });
var localize = nls.loadMessageBundle(__filename);
var httpsRequired = localize(0, null);
var svgsNotValid = localize(1, null);
var embeddedSvgsNotValid = localize(2, null);
var dataUrlsNotValid = localize(3, null);
var relativeUrlRequiresHttpsRepository = localize(4, null);
var Context;
(function (Context) {
    Context[Context["ICON"] = 0] = "ICON";
    Context[Context["BADGE"] = 1] = "BADGE";
    Context[Context["MARKDOWN"] = 2] = "MARKDOWN";
})(Context || (Context = {}));
var ExtensionLinter = (function () {
    function ExtensionLinter(context) {
        var _this = this;
        this.context = context;
        this.diagnosticsCollection = vscode_1.languages.createDiagnosticCollection('extension-editing');
        this.fileWatcher = vscode_1.workspace.createFileSystemWatcher('**/package.json');
        this.disposables = [this.diagnosticsCollection, this.fileWatcher];
        this.folderToPackageJsonInfo = {};
        this.packageJsonQ = new Set();
        this.readmeQ = new Set();
        this.markdownIt = new MarkdownIt();
        this.disposables.push(vscode_1.workspace.onDidOpenTextDocument(function (document) { return _this.queue(document); }), vscode_1.workspace.onDidChangeTextDocument(function (event) { return _this.queue(event.document); }), vscode_1.workspace.onDidCloseTextDocument(function (document) { return _this.clear(document); }), this.fileWatcher.onDidChange(function (uri) { return _this.packageJsonChanged(_this.getUriFolder(uri)); }), this.fileWatcher.onDidCreate(function (uri) { return _this.packageJsonChanged(_this.getUriFolder(uri)); }), this.fileWatcher.onDidDelete(function (uri) { return _this.packageJsonChanged(_this.getUriFolder(uri)); }));
        vscode_1.workspace.textDocuments.forEach(function (document) { return _this.queue(document); });
    }
    ExtensionLinter.prototype.queue = function (document) {
        var p = document.uri.path;
        if (document.languageId === 'json' && endsWith(p, '/package.json')) {
            this.packageJsonQ.add(document);
            this.startTimer();
        }
        this.queueReadme(document);
    };
    ExtensionLinter.prototype.queueReadme = function (document) {
        var p = document.uri.path;
        if (document.languageId === 'markdown' && (endsWith(p.toLowerCase(), '/readme.md') || endsWith(p.toLowerCase(), '/changelog.md'))) {
            this.readmeQ.add(document);
            this.startTimer();
        }
    };
    ExtensionLinter.prototype.startTimer = function () {
        var _this = this;
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(function () {
            _this.lint()
                .catch(console.error);
        }, 300);
    };
    ExtensionLinter.prototype.lint = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.lintPackageJson();
                        return [4 /*yield*/, this.lintReadme()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ExtensionLinter.prototype.lintPackageJson = function () {
        var _this = this;
        this.packageJsonQ.forEach(function (document) {
            _this.packageJsonQ.delete(document);
            if (document.isClosed) {
                return;
            }
            var diagnostics = [];
            var tree = jsonc_parser_1.parseTree(document.getText());
            var info = _this.readPackageJsonInfo(_this.getUriFolder(document.uri), tree);
            if (info.isExtension) {
                var icon = jsonc_parser_1.findNodeAtLocation(tree, ['icon']);
                if (icon && icon.type === 'string') {
                    _this.addDiagnostics(diagnostics, document, icon.offset + 1, icon.offset + icon.length - 1, icon.value, Context.ICON, info);
                }
                var badges = jsonc_parser_1.findNodeAtLocation(tree, ['badges']);
                if (badges && badges.type === 'array') {
                    badges.children.map(function (child) { return jsonc_parser_1.findNodeAtLocation(child, ['url']); })
                        .filter(function (url) { return url && url.type === 'string'; })
                        .map(function (url) { return _this.addDiagnostics(diagnostics, document, url.offset + 1, url.offset + url.length - 1, url.value, Context.BADGE, info); });
                }
            }
            _this.diagnosticsCollection.set(document.uri, diagnostics);
        });
    };
    ExtensionLinter.prototype.lintReadme = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var _loop_1, this_1, _i, _a, document, state_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _loop_1 = function (document) {
                            var folder, info, tree, text, tokens, tokensAndPositions, diagnostics, svgStart;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        this_1.readmeQ.delete(document);
                                        if (document.isClosed) {
                                            return [2 /*return*/, { value: void 0 }];
                                        }
                                        folder = this_1.getUriFolder(document.uri);
                                        info = this_1.folderToPackageJsonInfo[folder.toString()];
                                        if (!!info) return [3 /*break*/, 2];
                                        return [4 /*yield*/, this_1.loadPackageJson(folder)];
                                    case 1:
                                        tree = _a.sent();
                                        info = this_1.readPackageJsonInfo(folder, tree);
                                        _a.label = 2;
                                    case 2:
                                        if (!info.isExtension) {
                                            this_1.diagnosticsCollection.set(document.uri, []);
                                            return [2 /*return*/, { value: void 0 }];
                                        }
                                        text = document.getText();
                                        tokens = this_1.markdownIt.parse(text, {});
                                        tokensAndPositions = (function toTokensAndPositions(tokens, begin, end) {
                                            var _this = this;
                                            if (begin === void 0) { begin = 0; }
                                            if (end === void 0) { end = text.length; }
                                            var tokensAndPositions = tokens.map(function (token) {
                                                if (token.map) {
                                                    var tokenBegin = document.offsetAt(new vscode_1.Position(token.map[0], 0));
                                                    var tokenEnd = begin = document.offsetAt(new vscode_1.Position(token.map[1], 0));
                                                    return {
                                                        token: token,
                                                        begin: tokenBegin,
                                                        end: tokenEnd
                                                    };
                                                }
                                                var image = token.type === 'image' && _this.locateToken(text, begin, end, token, token.attrGet('src'));
                                                var other = image || _this.locateToken(text, begin, end, token, token.content);
                                                return other || {
                                                    token: token,
                                                    begin: begin,
                                                    end: begin
                                                };
                                            });
                                            return tokensAndPositions.concat.apply(tokensAndPositions, tokensAndPositions.filter(function (tnp) { return tnp.token.children && tnp.token.children.length; })
                                                .map(function (tnp) { return toTokensAndPositions.call(_this, tnp.token.children, tnp.begin, tnp.end); }));
                                        }).call(this_1, tokens);
                                        diagnostics = [];
                                        tokensAndPositions.filter(function (tnp) { return tnp.token.type === 'image' && tnp.token.attrGet('src'); })
                                            .map(function (inp) {
                                            var src = inp.token.attrGet('src');
                                            var begin = text.indexOf(src, inp.begin);
                                            if (begin !== -1 && begin < inp.end) {
                                                _this.addDiagnostics(diagnostics, document, begin, begin + src.length, src, Context.MARKDOWN, info);
                                            }
                                            else {
                                                var content = inp.token.content;
                                                var begin_1 = text.indexOf(content, inp.begin);
                                                if (begin_1 !== -1 && begin_1 < inp.end) {
                                                    _this.addDiagnostics(diagnostics, document, begin_1, begin_1 + content.length, src, Context.MARKDOWN, info);
                                                }
                                            }
                                        });
                                        tokensAndPositions.filter(function (tnp) { return tnp.token.type === 'text' && tnp.token.content; })
                                            .map(function (tnp) {
                                            var parser = new parse5.SAXParser({ locationInfo: true });
                                            parser.on('startTag', function (name, attrs, selfClosing, location) {
                                                if (name === 'img') {
                                                    var src = attrs.find(function (a) { return a.name === 'src'; });
                                                    if (src && src.value) {
                                                        var begin = text.indexOf(src.value, tnp.begin + location.startOffset);
                                                        if (begin !== -1 && begin < tnp.end) {
                                                            _this.addDiagnostics(diagnostics, document, begin, begin + src.value.length, src.value, Context.MARKDOWN, info);
                                                        }
                                                    }
                                                }
                                                else if (name === 'svg') {
                                                    var begin = tnp.begin + location.startOffset;
                                                    var end = tnp.begin + location.endOffset;
                                                    var range = new vscode_1.Range(document.positionAt(begin), document.positionAt(end));
                                                    svgStart = new vscode_1.Diagnostic(range, embeddedSvgsNotValid, vscode_1.DiagnosticSeverity.Warning);
                                                    diagnostics.push(svgStart);
                                                }
                                            });
                                            parser.on('endTag', function (name, location) {
                                                if (name === 'svg' && svgStart) {
                                                    var end = tnp.begin + location.endOffset;
                                                    svgStart.range = new vscode_1.Range(svgStart.range.start, document.positionAt(end));
                                                }
                                            });
                                            parser.write(tnp.token.content);
                                            parser.end();
                                        });
                                        this_1.diagnosticsCollection.set(document.uri, diagnostics);
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, _a = Array.from(this.readmeQ);
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        document = _a[_i];
                        return [5 /*yield**/, _loop_1(document)];
                    case 2:
                        state_1 = _b.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        ;
                        return [2 /*return*/];
                }
            });
        });
    };
    ExtensionLinter.prototype.locateToken = function (text, begin, end, token, content) {
        if (content) {
            var tokenBegin = text.indexOf(content, begin);
            if (tokenBegin !== -1) {
                var tokenEnd = tokenBegin + content.length;
                if (tokenEnd <= end) {
                    begin = tokenEnd;
                    return {
                        token: token,
                        begin: tokenBegin,
                        end: tokenEnd
                    };
                }
            }
        }
    };
    ExtensionLinter.prototype.readPackageJsonInfo = function (folder, tree) {
        var engine = tree && jsonc_parser_1.findNodeAtLocation(tree, ['engines', 'vscode']);
        var repo = tree && jsonc_parser_1.findNodeAtLocation(tree, ['repository', 'url']);
        var info = {
            isExtension: !!(engine && engine.type === 'string'),
            hasHttpsRepository: !!(repo && repo.type === 'string' && repo.value && parseUri(repo.value).scheme.toLowerCase() === 'https')
        };
        var str = folder.toString();
        var oldInfo = this.folderToPackageJsonInfo[str];
        if (oldInfo && (oldInfo.isExtension !== info.isExtension || oldInfo.hasHttpsRepository !== info.hasHttpsRepository)) {
            this.packageJsonChanged(folder); // clears this.folderToPackageJsonInfo[str]
        }
        this.folderToPackageJsonInfo[str] = info;
        return info;
    };
    ExtensionLinter.prototype.loadPackageJson = function (folder) {
        return __awaiter(this, void 0, void 0, function () {
            var file, exists, document;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        file = folder.with({ path: path.posix.join(folder.path, 'package.json') });
                        return [4 /*yield*/, fileExists(file.fsPath)];
                    case 1:
                        exists = _a.sent();
                        if (!exists) {
                            return [2 /*return*/, undefined];
                        }
                        return [4 /*yield*/, vscode_1.workspace.openTextDocument(file)];
                    case 2:
                        document = _a.sent();
                        return [2 /*return*/, jsonc_parser_1.parseTree(document.getText())];
                }
            });
        });
    };
    ExtensionLinter.prototype.packageJsonChanged = function (folder) {
        var _this = this;
        delete this.folderToPackageJsonInfo[folder.toString()];
        var str = folder.toString().toLowerCase();
        vscode_1.workspace.textDocuments.filter(function (document) { return _this.getUriFolder(document.uri).toString().toLowerCase() === str; })
            .forEach(function (document) { return _this.queueReadme(document); });
    };
    ExtensionLinter.prototype.getUriFolder = function (uri) {
        return uri.with({ path: path.posix.dirname(uri.path) });
    };
    ExtensionLinter.prototype.addDiagnostics = function (diagnostics, document, begin, end, src, context, info) {
        var uri = parseUri(src);
        var scheme = uri.scheme.toLowerCase();
        if (scheme && scheme !== 'https' && scheme !== 'data') {
            var range = new vscode_1.Range(document.positionAt(begin), document.positionAt(end));
            diagnostics.push(new vscode_1.Diagnostic(range, httpsRequired, vscode_1.DiagnosticSeverity.Warning));
        }
        if (scheme === 'data') {
            var range = new vscode_1.Range(document.positionAt(begin), document.positionAt(end));
            diagnostics.push(new vscode_1.Diagnostic(range, dataUrlsNotValid, vscode_1.DiagnosticSeverity.Warning));
        }
        if (!scheme && !info.hasHttpsRepository) {
            var range = new vscode_1.Range(document.positionAt(begin), document.positionAt(end));
            diagnostics.push(new vscode_1.Diagnostic(range, relativeUrlRequiresHttpsRepository, vscode_1.DiagnosticSeverity.Warning));
        }
        if (endsWith(uri.path.toLowerCase(), '.svg') && allowedBadgeProviders.indexOf(uri.authority.toLowerCase()) === -1) {
            var range = new vscode_1.Range(document.positionAt(begin), document.positionAt(end));
            diagnostics.push(new vscode_1.Diagnostic(range, svgsNotValid, vscode_1.DiagnosticSeverity.Warning));
        }
    };
    ExtensionLinter.prototype.clear = function (document) {
        this.diagnosticsCollection.delete(document.uri);
        this.packageJsonQ.delete(document);
    };
    ExtensionLinter.prototype.dispose = function () {
        this.disposables.forEach(function (d) { return d.dispose(); });
        this.disposables = [];
    };
    return ExtensionLinter;
}());
exports.ExtensionLinter = ExtensionLinter;
function endsWith(haystack, needle) {
    var diff = haystack.length - needle.length;
    if (diff > 0) {
        return haystack.indexOf(needle, diff) === diff;
    }
    else if (diff === 0) {
        return haystack === needle;
    }
    else {
        return false;
    }
}
function fileExists(path) {
    return new Promise(function (resolve, reject) {
        fs.lstat(path, function (err, stats) {
            if (!err) {
                resolve(true);
            }
            else if (err.code === 'ENOENT') {
                resolve(false);
            }
            else {
                reject(err);
            }
        });
    });
}
function parseUri(src) {
    try {
        return vscode_1.Uri.parse(src);
    }
    catch (err) {
        try {
            return vscode_1.Uri.parse(encodeURI(src));
        }
        catch (err) {
            return vscode_1.Uri.parse('');
        }
    }
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/extension-editing/out/extensionLinter.js.map
