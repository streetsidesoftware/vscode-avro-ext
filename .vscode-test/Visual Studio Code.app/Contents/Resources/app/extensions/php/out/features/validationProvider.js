/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var cp = require("child_process");
var string_decoder_1 = require("string_decoder");
var vscode = require("vscode");
var async_1 = require("./utils/async");
var nls = require("vscode-nls");
var localize = nls.loadMessageBundle(__filename);
var LineDecoder = (function () {
    function LineDecoder(encoding) {
        if (encoding === void 0) { encoding = 'utf8'; }
        this.stringDecoder = new string_decoder_1.StringDecoder(encoding);
        this.remaining = null;
    }
    LineDecoder.prototype.write = function (buffer) {
        var result = [];
        var value = this.remaining
            ? this.remaining + this.stringDecoder.write(buffer)
            : this.stringDecoder.write(buffer);
        if (value.length < 1) {
            return result;
        }
        var start = 0;
        var ch;
        while (start < value.length && ((ch = value.charCodeAt(start)) === 13 || ch === 10)) {
            start++;
        }
        var idx = start;
        while (idx < value.length) {
            ch = value.charCodeAt(idx);
            if (ch === 13 || ch === 10) {
                result.push(value.substring(start, idx));
                idx++;
                while (idx < value.length && ((ch = value.charCodeAt(idx)) === 13 || ch === 10)) {
                    idx++;
                }
                start = idx;
            }
            else {
                idx++;
            }
        }
        this.remaining = start < value.length ? value.substr(start) : null;
        return result;
    };
    LineDecoder.prototype.end = function () {
        return this.remaining;
    };
    return LineDecoder;
}());
exports.LineDecoder = LineDecoder;
var RunTrigger;
(function (RunTrigger) {
    RunTrigger[RunTrigger["onSave"] = 0] = "onSave";
    RunTrigger[RunTrigger["onType"] = 1] = "onType";
})(RunTrigger || (RunTrigger = {}));
(function (RunTrigger) {
    RunTrigger.strings = {
        onSave: 'onSave',
        onType: 'onType'
    };
    RunTrigger.from = function (value) {
        if (value === 'onType') {
            return RunTrigger.onType;
        }
        else {
            return RunTrigger.onSave;
        }
    };
})(RunTrigger || (RunTrigger = {}));
var CheckedExecutablePath = 'php.validate.checkedExecutablePath';
var PHPValidationProvider = (function () {
    function PHPValidationProvider(workspaceStore) {
        this.workspaceStore = workspaceStore;
        this.executable = null;
        this.validationEnabled = true;
        this.trigger = RunTrigger.onSave;
        this.pauseValidation = false;
    }
    PHPValidationProvider.prototype.activate = function (subscriptions) {
        var _this = this;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
        subscriptions.push(this);
        vscode.workspace.onDidChangeConfiguration(this.loadConfiguration, this, subscriptions);
        this.loadConfiguration();
        vscode.workspace.onDidOpenTextDocument(this.triggerValidate, this, subscriptions);
        vscode.workspace.onDidCloseTextDocument(function (textDocument) {
            _this.diagnosticCollection.delete(textDocument.uri);
            delete _this.delayers[textDocument.uri.toString()];
        }, null, subscriptions);
        subscriptions.push(vscode.commands.registerCommand('php.untrustValidationExecutable', this.untrustValidationExecutable, this));
    };
    PHPValidationProvider.prototype.dispose = function () {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
    };
    PHPValidationProvider.prototype.loadConfiguration = function () {
        var _this = this;
        var section = vscode.workspace.getConfiguration('php');
        var oldExecutable = this.executable;
        if (section) {
            this.validationEnabled = section.get('validate.enable', true);
            var inspect = section.inspect('validate.executablePath');
            if (inspect && inspect.workspaceValue) {
                this.executable = inspect.workspaceValue;
                this.executableIsUserDefined = false;
            }
            else if (inspect && inspect.globalValue) {
                this.executable = inspect.globalValue;
                this.executableIsUserDefined = true;
            }
            else {
                this.executable = undefined;
                this.executableIsUserDefined = undefined;
            }
            this.trigger = RunTrigger.from(section.get('validate.run', RunTrigger.strings.onSave));
        }
        if (this.executableIsUserDefined !== true && this.workspaceStore.get(CheckedExecutablePath, undefined) !== void 0) {
            vscode.commands.executeCommand('setContext', 'php.untrustValidationExecutableContext', true);
        }
        this.delayers = Object.create(null);
        if (this.pauseValidation) {
            this.pauseValidation = oldExecutable === this.executable;
        }
        if (this.documentListener) {
            this.documentListener.dispose();
        }
        this.diagnosticCollection.clear();
        if (this.validationEnabled) {
            if (this.trigger === RunTrigger.onType) {
                this.documentListener = vscode.workspace.onDidChangeTextDocument(function (e) {
                    _this.triggerValidate(e.document);
                });
            }
            else {
                this.documentListener = vscode.workspace.onDidSaveTextDocument(this.triggerValidate, this);
            }
            // Configuration has changed. Reevaluate all documents.
            vscode.workspace.textDocuments.forEach(this.triggerValidate, this);
        }
    };
    PHPValidationProvider.prototype.untrustValidationExecutable = function () {
        this.workspaceStore.update(CheckedExecutablePath, undefined);
        vscode.commands.executeCommand('setContext', 'php.untrustValidationExecutableContext', false);
    };
    PHPValidationProvider.prototype.triggerValidate = function (textDocument) {
        var _this = this;
        if (textDocument.languageId !== 'php' || this.pauseValidation || !this.validationEnabled) {
            return;
        }
        var trigger = function () {
            var key = textDocument.uri.toString();
            var delayer = _this.delayers[key];
            if (!delayer) {
                delayer = new async_1.ThrottledDelayer(_this.trigger === RunTrigger.onType ? 250 : 0);
                _this.delayers[key] = delayer;
            }
            delayer.trigger(function () { return _this.doValidate(textDocument); });
        };
        if (this.executableIsUserDefined !== void 0 && !this.executableIsUserDefined) {
            var checkedExecutablePath = this.workspaceStore.get(CheckedExecutablePath, undefined);
            if (!checkedExecutablePath || checkedExecutablePath !== this.executable) {
                vscode.window.showInformationMessage(localize(0, null, this.executable), {
                    title: localize(1, null),
                    id: 'yes'
                }, {
                    title: localize(2, null),
                    isCloseAffordance: true,
                    id: 'no'
                }).then(function (selected) {
                    if (!selected || selected.id === 'no') {
                        _this.pauseValidation = true;
                    }
                    else if (selected.id === 'yes') {
                        _this.workspaceStore.update(CheckedExecutablePath, _this.executable);
                        vscode.commands.executeCommand('setContext', 'php.untrustValidationExecutableContext', true);
                        trigger();
                    }
                });
                return;
            }
        }
        trigger();
    };
    PHPValidationProvider.prototype.doValidate = function (textDocument) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var executable = _this.executable || 'php';
            var decoder = new LineDecoder();
            var diagnostics = [];
            var processLine = function (line) {
                var matches = line.match(PHPValidationProvider.MatchExpression);
                if (matches) {
                    var message = matches[1];
                    var line_1 = parseInt(matches[3]) - 1;
                    var diagnostic = new vscode.Diagnostic(new vscode.Range(line_1, 0, line_1, Number.MAX_VALUE), message);
                    diagnostics.push(diagnostic);
                }
            };
            var options = vscode.workspace.rootPath ? { cwd: vscode.workspace.rootPath } : undefined;
            var args;
            if (_this.trigger === RunTrigger.onSave) {
                args = PHPValidationProvider.FileArgs.slice(0);
                args.push(textDocument.fileName);
            }
            else {
                args = PHPValidationProvider.BufferArgs;
            }
            try {
                var childProcess = cp.spawn(executable, args, options);
                childProcess.on('error', function (error) {
                    if (_this.pauseValidation) {
                        resolve();
                        return;
                    }
                    _this.showError(error, executable);
                    _this.pauseValidation = true;
                    resolve();
                });
                if (childProcess.pid) {
                    if (_this.trigger === RunTrigger.onType) {
                        childProcess.stdin.write(textDocument.getText());
                        childProcess.stdin.end();
                    }
                    childProcess.stdout.on('data', function (data) {
                        decoder.write(data).forEach(processLine);
                    });
                    childProcess.stdout.on('end', function () {
                        var line = decoder.end();
                        if (line) {
                            processLine(line);
                        }
                        _this.diagnosticCollection.set(textDocument.uri, diagnostics);
                        resolve();
                    });
                }
                else {
                    resolve();
                }
            }
            catch (error) {
                _this.showError(error, executable);
            }
        });
    };
    PHPValidationProvider.prototype.showError = function (error, executable) {
        var message = null;
        if (error.code === 'ENOENT') {
            if (this.executable) {
                message = localize(3, null, executable);
            }
            else {
                message = localize(4, null);
            }
        }
        else {
            message = error.message ? error.message : localize(5, null, executable);
        }
        vscode.window.showInformationMessage(message);
    };
    return PHPValidationProvider;
}());
PHPValidationProvider.MatchExpression = /(?:(?:Parse|Fatal) error): (.*)(?: in )(.*?)(?: on line )(\d+)/;
PHPValidationProvider.BufferArgs = ['-l', '-n', '-d', 'display_errors=On', '-d', 'log_errors=Off'];
PHPValidationProvider.FileArgs = ['-l', '-n', '-d', 'display_errors=On', '-d', 'log_errors=Off', '-f'];
exports.default = PHPValidationProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/php/out/features/validationProvider.js.map
