/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const model_1 = require("./model");
const util_1 = require("./util");
const uri_1 = require("./uri");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
class GitSCMProvider {
    constructor(model, commandCenter, statusBarCommands) {
        this.model = model;
        this.commandCenter = commandCenter;
        this.statusBarCommands = statusBarCommands;
        this.disposables = [];
        this._sourceControl = vscode_1.scm.createSourceControl('git', 'Git');
        this.disposables.push(this._sourceControl);
        this._sourceControl.acceptInputCommand = { command: 'git.commitWithInput', title: localize(0, null) };
        this._sourceControl.quickDiffProvider = this;
        this.statusBarCommands.onDidChange(this.onDidStatusBarCommandsChange, this, this.disposables);
        this.onDidStatusBarCommandsChange();
        this.mergeGroup = this._sourceControl.createResourceGroup(model.mergeGroup.id, model.mergeGroup.label);
        this.indexGroup = this._sourceControl.createResourceGroup(model.indexGroup.id, model.indexGroup.label);
        this.workingTreeGroup = this._sourceControl.createResourceGroup(model.workingTreeGroup.id, model.workingTreeGroup.label);
        this.mergeGroup.hideWhenEmpty = true;
        this.indexGroup.hideWhenEmpty = true;
        this.disposables.push(this.mergeGroup);
        this.disposables.push(this.indexGroup);
        this.disposables.push(this.workingTreeGroup);
        model.onDidChange(this.onDidModelChange, this, this.disposables);
        this.updateCommitTemplate();
    }
    get contextKey() { return 'git'; }
    get onDidChange() {
        return util_1.mapEvent(this.model.onDidChange, () => this);
    }
    get label() { return 'Git'; }
    get stateContextKey() {
        switch (this.model.state) {
            case model_1.State.Uninitialized: return 'uninitialized';
            case model_1.State.Idle: return 'idle';
            case model_1.State.NotAGitRepository: return 'norepo';
            default: return '';
        }
    }
    get count() {
        const countBadge = vscode_1.workspace.getConfiguration('git').get('countBadge');
        const total = this.model.mergeGroup.resources.length
            + this.model.indexGroup.resources.length
            + this.model.workingTreeGroup.resources.length;
        switch (countBadge) {
            case 'off': return 0;
            case 'tracked': return total - this.model.workingTreeGroup.resources.filter(r => r.type === model_1.Status.UNTRACKED || r.type === model_1.Status.IGNORED).length;
            default: return total;
        }
    }
    get sourceControl() {
        return this._sourceControl;
    }
    updateCommitTemplate() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._sourceControl.commitTemplate = yield this.model.getCommitTemplate();
            }
            catch (e) {
                // noop
            }
        });
    }
    provideOriginalResource(uri) {
        if (uri.scheme !== 'file') {
            return;
        }
        return uri_1.toGitUri(uri, '', true);
    }
    onDidModelChange() {
        this.mergeGroup.resourceStates = this.model.mergeGroup.resources;
        this.indexGroup.resourceStates = this.model.indexGroup.resources;
        this.workingTreeGroup.resourceStates = this.model.workingTreeGroup.resources;
        this._sourceControl.count = this.count;
        vscode_1.commands.executeCommand('setContext', 'gitState', this.stateContextKey);
    }
    onDidStatusBarCommandsChange() {
        this._sourceControl.statusBarCommands = this.statusBarCommands.commands;
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
exports.GitSCMProvider = GitSCMProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/git/out/scmProvider.js.map
