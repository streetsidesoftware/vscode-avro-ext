/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var previewContentProvider_1 = require("./previewContentProvider");
var nls = require("vscode-nls");
var localize = nls.loadMessageBundle(__filename);
var ExtensionContentSecurityPolicyArbiter = (function () {
    function ExtensionContentSecurityPolicyArbiter(globalState) {
        this.globalState = globalState;
        this.key = 'trusted_preview_workspace:';
    }
    ExtensionContentSecurityPolicyArbiter.prototype.isEnhancedSecurityDisableForWorkspace = function (rootPath) {
        return this.globalState.get(this.key + rootPath, false);
    };
    ExtensionContentSecurityPolicyArbiter.prototype.addTrustedWorkspace = function (rootPath) {
        return this.globalState.update(this.key + rootPath, true);
    };
    ExtensionContentSecurityPolicyArbiter.prototype.removeTrustedWorkspace = function (rootPath) {
        return this.globalState.update(this.key + rootPath, false);
    };
    return ExtensionContentSecurityPolicyArbiter;
}());
exports.ExtensionContentSecurityPolicyArbiter = ExtensionContentSecurityPolicyArbiter;
var PreviewSecuritySelection;
(function (PreviewSecuritySelection) {
    PreviewSecuritySelection[PreviewSecuritySelection["None"] = 0] = "None";
    PreviewSecuritySelection[PreviewSecuritySelection["DisableEnhancedSecurityForWorkspace"] = 1] = "DisableEnhancedSecurityForWorkspace";
    PreviewSecuritySelection[PreviewSecuritySelection["EnableEnhancedSecurityForWorkspace"] = 2] = "EnableEnhancedSecurityForWorkspace";
})(PreviewSecuritySelection || (PreviewSecuritySelection = {}));
var PreviewSecuritySelector = (function () {
    function PreviewSecuritySelector(cspArbiter, contentProvider) {
        this.cspArbiter = cspArbiter;
        this.contentProvider = contentProvider;
    }
    PreviewSecuritySelector.prototype.showSecutitySelectorForWorkspace = function (resource) {
        var _this = this;
        var workspacePath = vscode.workspace.rootPath || resource;
        if (!workspacePath) {
            return;
        }
        var sourceUri = null;
        if (resource) {
            sourceUri = previewContentProvider_1.getMarkdownUri(vscode.Uri.parse(resource));
        }
        if (!sourceUri && vscode.window.activeTextEditor) {
            sourceUri = previewContentProvider_1.getMarkdownUri(vscode.window.activeTextEditor.document.uri);
        }
        vscode.window.showQuickPick([
            {
                id: PreviewSecuritySelection.EnableEnhancedSecurityForWorkspace,
                label: localize(0, null),
                description: '',
                detail: this.cspArbiter.isEnhancedSecurityDisableForWorkspace(workspacePath)
                    ? ''
                    : localize(1, null)
            }, {
                id: PreviewSecuritySelection.DisableEnhancedSecurityForWorkspace,
                label: localize(2, null),
                description: '',
                detail: this.cspArbiter.isEnhancedSecurityDisableForWorkspace(workspacePath)
                    ? localize(3, null)
                    : ''
            },
        ], {
            placeHolder: localize(4, null),
        }).then(function (selection) {
            if (!workspacePath) {
                return false;
            }
            switch (selection && selection.id) {
                case PreviewSecuritySelection.DisableEnhancedSecurityForWorkspace:
                    return _this.cspArbiter.addTrustedWorkspace(workspacePath).then(function () { return true; });
                case PreviewSecuritySelection.EnableEnhancedSecurityForWorkspace:
                    return _this.cspArbiter.removeTrustedWorkspace(workspacePath).then(function () { return true; });
            }
            return false;
        }).then(function (shouldUpdate) {
            if (shouldUpdate && sourceUri) {
                _this.contentProvider.update(sourceUri);
            }
        });
    };
    return PreviewSecuritySelector;
}());
exports.PreviewSecuritySelector = PreviewSecuritySelector;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/markdown/out/security.js.map
