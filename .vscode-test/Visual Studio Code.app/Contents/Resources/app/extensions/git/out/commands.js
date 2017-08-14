/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const git_1 = require("./git");
const model_1 = require("./model");
const uri_1 = require("./uri");
const staging_1 = require("./staging");
const path = require("path");
const os = require("os");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
class CheckoutItem {
    constructor(ref) {
        this.ref = ref;
    }
    get shortCommit() { return (this.ref.commit || '').substr(0, 8); }
    get treeish() { return this.ref.name; }
    get label() { return this.ref.name || this.shortCommit; }
    get description() { return this.shortCommit; }
    run(model) {
        return __awaiter(this, void 0, void 0, function* () {
            const ref = this.treeish;
            if (!ref) {
                return;
            }
            yield model.checkout(ref);
        });
    }
}
class CheckoutTagItem extends CheckoutItem {
    get description() {
        return localize(0, null, this.shortCommit);
    }
}
class CheckoutRemoteHeadItem extends CheckoutItem {
    get description() {
        return localize(1, null, this.shortCommit);
    }
    get treeish() {
        if (!this.ref.name) {
            return;
        }
        const match = /^[^/]+\/(.*)$/.exec(this.ref.name);
        return match ? match[1] : this.ref.name;
    }
}
class BranchDeleteItem {
    constructor(ref) {
        this.ref = ref;
    }
    get shortCommit() { return (this.ref.commit || '').substr(0, 8); }
    get branchName() { return this.ref.name; }
    get label() { return this.branchName || ''; }
    get description() { return this.shortCommit; }
    run(model, force) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.branchName) {
                return;
            }
            yield model.deleteBranch(this.branchName, force);
        });
    }
}
class MergeItem {
    constructor(ref) {
        this.ref = ref;
    }
    get label() { return this.ref.name || ''; }
    get description() { return this.ref.name || ''; }
    run(model) {
        return __awaiter(this, void 0, void 0, function* () {
            yield model.merge(this.ref.name || this.ref.commit);
        });
    }
}
const Commands = [];
function command(commandId, skipModelCheck = false, requiresDiffInformation = false) {
    return (target, key, descriptor) => {
        if (!(typeof descriptor.value === 'function')) {
            throw new Error('not supported');
        }
        Commands.push({ commandId, key, method: descriptor.value, skipModelCheck, requiresDiffInformation });
    };
}
class CommandCenter {
    constructor(git, model, outputChannel, telemetryReporter) {
        this.git = git;
        this.outputChannel = outputChannel;
        this.telemetryReporter = telemetryReporter;
        if (model) {
            this.model = model;
        }
        this.disposables = Commands
            .map(({ commandId, key, method, skipModelCheck, requiresDiffInformation }) => {
            const command = this.createCommand(commandId, key, method, skipModelCheck);
            if (requiresDiffInformation) {
                return vscode_1.commands.registerDiffInformationCommand(commandId, command);
            }
            else {
                return vscode_1.commands.registerCommand(commandId, command);
            }
        });
    }
    refresh() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.model.status();
        });
    }
    openResource(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._openResource(resource);
        });
    }
    _openResource(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const left = this.getLeftResource(resource);
            const right = this.getRightResource(resource);
            const title = this.getTitle(resource);
            if (!right) {
                // TODO
                console.error('oh no');
                return;
            }
            const viewColumn = vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.viewColumn || vscode_1.ViewColumn.One;
            if (!left) {
                return yield vscode_1.commands.executeCommand('vscode.open', right, viewColumn);
            }
            const opts = {
                preview: true,
                viewColumn
            };
            return yield vscode_1.commands.executeCommand('vscode.diff', left, right, title, opts);
        });
    }
    getLeftResource(resource) {
        switch (resource.type) {
            case model_1.Status.INDEX_MODIFIED:
            case model_1.Status.INDEX_RENAMED:
                return uri_1.toGitUri(resource.original, 'HEAD');
            case model_1.Status.MODIFIED:
                return uri_1.toGitUri(resource.resourceUri, '~');
        }
    }
    getRightResource(resource) {
        switch (resource.type) {
            case model_1.Status.INDEX_MODIFIED:
            case model_1.Status.INDEX_ADDED:
            case model_1.Status.INDEX_COPIED:
            case model_1.Status.INDEX_RENAMED:
                return uri_1.toGitUri(resource.resourceUri, '');
            case model_1.Status.INDEX_DELETED:
            case model_1.Status.DELETED:
                return uri_1.toGitUri(resource.resourceUri, 'HEAD');
            case model_1.Status.MODIFIED:
            case model_1.Status.UNTRACKED:
            case model_1.Status.IGNORED:
                const uriString = resource.resourceUri.toString();
                const [indexStatus] = this.model.indexGroup.resources.filter(r => r.resourceUri.toString() === uriString);
                if (indexStatus && indexStatus.renameResourceUri) {
                    return indexStatus.renameResourceUri;
                }
                return resource.resourceUri;
            case model_1.Status.BOTH_MODIFIED:
                return resource.resourceUri;
        }
    }
    getTitle(resource) {
        const basename = path.basename(resource.resourceUri.fsPath);
        switch (resource.type) {
            case model_1.Status.INDEX_MODIFIED:
            case model_1.Status.INDEX_RENAMED:
                return `${basename} (Index)`;
            case model_1.Status.MODIFIED:
                return `${basename} (Working Tree)`;
        }
        return '';
    }
    clone() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = yield vscode_1.window.showInputBox({
                prompt: localize(2, null),
                ignoreFocusOut: true
            });
            if (!url) {
                this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'no_URL' });
                return;
            }
            const config = vscode_1.workspace.getConfiguration('git');
            const value = config.get('defaultCloneDirectory') || os.homedir();
            const parentPath = yield vscode_1.window.showInputBox({
                prompt: localize(3, null),
                value,
                ignoreFocusOut: true
            });
            if (!parentPath) {
                this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'no_directory' });
                return;
            }
            const clonePromise = this.git.clone(url, parentPath);
            vscode_1.window.setStatusBarMessage(localize(4, null), clonePromise);
            try {
                const repositoryPath = yield clonePromise;
                const open = localize(5, null);
                const result = yield vscode_1.window.showInformationMessage(localize(6, null), open);
                const openFolder = result === open;
                this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'success' }, { openFolder: openFolder ? 1 : 0 });
                if (openFolder) {
                    vscode_1.commands.executeCommand('vscode.openFolder', vscode_1.Uri.file(repositoryPath));
                }
            }
            catch (err) {
                if (/already exists and is not an empty directory/.test(err && err.stderr || '')) {
                    this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'directory_not_empty' });
                }
                else {
                    this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'error' });
                }
                throw err;
            }
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.model.init();
        });
    }
    openFile(arg) {
        return __awaiter(this, void 0, void 0, function* () {
            let uri;
            if (arg instanceof vscode_1.Uri) {
                if (arg.scheme === 'git') {
                    uri = vscode_1.Uri.file(uri_1.fromGitUri(arg).path);
                }
                else if (arg.scheme === 'file') {
                    uri = arg;
                }
            }
            else {
                let resource = arg;
                if (!(resource instanceof model_1.Resource)) {
                    // can happen when called from a keybinding
                    resource = this.getSCMResource();
                }
                if (resource) {
                    uri = resource.resourceUri;
                }
            }
            if (!uri) {
                return;
            }
            const viewColumn = vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.viewColumn || vscode_1.ViewColumn.One;
            return yield vscode_1.commands.executeCommand('vscode.open', uri, viewColumn);
        });
    }
    openHEADFile(arg) {
        return __awaiter(this, void 0, void 0, function* () {
            let resource = undefined;
            if (arg instanceof model_1.Resource) {
                resource = arg;
            }
            else if (arg instanceof vscode_1.Uri) {
                resource = this.getSCMResource(arg);
            }
            else {
                resource = this.getSCMResource();
            }
            if (!resource) {
                return;
            }
            const HEAD = this.getLeftResource(resource);
            if (!HEAD) {
                vscode_1.window.showWarningMessage(localize(7, null, path.basename(resource.resourceUri.fsPath)));
                return;
            }
            return yield vscode_1.commands.executeCommand('vscode.open', HEAD);
        });
    }
    openChange(arg) {
        return __awaiter(this, void 0, void 0, function* () {
            let resource = undefined;
            if (arg instanceof model_1.Resource) {
                resource = arg;
            }
            else if (arg instanceof vscode_1.Uri) {
                resource = this.getSCMResource(arg);
            }
            else {
                resource = this.getSCMResource();
            }
            if (!resource) {
                return;
            }
            return yield this._openResource(resource);
        });
    }
    openFileFromUri(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            const resource = this.getSCMResource(uri);
            let uriToOpen;
            if (resource) {
                uriToOpen = resource.resourceUri;
            }
            else if (uri && uri.scheme === 'git') {
                const { path } = uri_1.fromGitUri(uri);
                uriToOpen = vscode_1.Uri.file(path);
            }
            else if (uri && uri.scheme === 'file') {
                uriToOpen = uri;
            }
            if (!uriToOpen) {
                return;
            }
            const viewColumn = vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.viewColumn || vscode_1.ViewColumn.One;
            return yield vscode_1.commands.executeCommand('vscode.open', uriToOpen, viewColumn);
        });
    }
    stage(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resourceStates.length === 0 || !(resourceStates[0].resourceUri instanceof vscode_1.Uri)) {
                const resource = this.getSCMResource();
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const resources = resourceStates
                .filter(s => s instanceof model_1.Resource && (s.resourceGroup instanceof model_1.WorkingTreeGroup || s.resourceGroup instanceof model_1.MergeGroup));
            if (!resources.length) {
                return;
            }
            return yield this.model.add(...resources);
        });
    }
    stageAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.model.add();
        });
    }
    stageSelectedRanges(diffs) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.activeTextEditor;
            if (!textEditor) {
                return;
            }
            const modifiedDocument = textEditor.document;
            const modifiedUri = modifiedDocument.uri;
            if (modifiedUri.scheme !== 'file') {
                return;
            }
            const originalUri = uri_1.toGitUri(modifiedUri, '~');
            const originalDocument = yield vscode_1.workspace.openTextDocument(originalUri);
            const selectedLines = staging_1.toLineRanges(textEditor.selections, modifiedDocument);
            const selectedDiffs = diffs
                .map(diff => selectedLines.reduce((result, range) => result || staging_1.intersectDiffWithRange(modifiedDocument, diff, range), null))
                .filter(d => !!d);
            if (!selectedDiffs.length) {
                return;
            }
            const result = staging_1.applyLineChanges(originalDocument, modifiedDocument, selectedDiffs);
            yield this.model.stage(modifiedUri, result);
        });
    }
    revertSelectedRanges(diffs) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.activeTextEditor;
            if (!textEditor) {
                return;
            }
            const modifiedDocument = textEditor.document;
            const modifiedUri = modifiedDocument.uri;
            if (modifiedUri.scheme !== 'file') {
                return;
            }
            const originalUri = uri_1.toGitUri(modifiedUri, '~');
            const originalDocument = yield vscode_1.workspace.openTextDocument(originalUri);
            const selections = textEditor.selections;
            const selectedDiffs = diffs.filter(diff => {
                const modifiedRange = diff.modifiedEndLineNumber === 0
                    ? new vscode_1.Range(modifiedDocument.lineAt(diff.modifiedStartLineNumber - 1).range.end, modifiedDocument.lineAt(diff.modifiedStartLineNumber).range.start)
                    : new vscode_1.Range(modifiedDocument.lineAt(diff.modifiedStartLineNumber - 1).range.start, modifiedDocument.lineAt(diff.modifiedEndLineNumber - 1).range.end);
                return selections.every(selection => !selection.intersection(modifiedRange));
            });
            if (selectedDiffs.length === diffs.length) {
                return;
            }
            const basename = path.basename(modifiedUri.fsPath);
            const message = localize(8, null, basename);
            const yes = localize(9, null);
            const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
            if (pick !== yes) {
                return;
            }
            const result = staging_1.applyLineChanges(originalDocument, modifiedDocument, selectedDiffs);
            const edit = new vscode_1.WorkspaceEdit();
            edit.replace(modifiedUri, new vscode_1.Range(new vscode_1.Position(0, 0), modifiedDocument.lineAt(modifiedDocument.lineCount - 1).range.end), result);
            vscode_1.workspace.applyEdit(edit);
        });
    }
    unstage(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resourceStates.length === 0 || !(resourceStates[0].resourceUri instanceof vscode_1.Uri)) {
                const resource = this.getSCMResource();
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const resources = resourceStates
                .filter(s => s instanceof model_1.Resource && s.resourceGroup instanceof model_1.IndexGroup);
            if (!resources.length) {
                return;
            }
            return yield this.model.revertFiles(...resources);
        });
    }
    unstageAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.model.revertFiles();
        });
    }
    unstageSelectedRanges(diffs) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.activeTextEditor;
            if (!textEditor) {
                return;
            }
            const modifiedDocument = textEditor.document;
            const modifiedUri = modifiedDocument.uri;
            if (modifiedUri.scheme !== 'git') {
                return;
            }
            const { ref } = uri_1.fromGitUri(modifiedUri);
            if (ref !== '') {
                return;
            }
            const originalUri = uri_1.toGitUri(modifiedUri, 'HEAD');
            const originalDocument = yield vscode_1.workspace.openTextDocument(originalUri);
            const selectedLines = staging_1.toLineRanges(textEditor.selections, modifiedDocument);
            const selectedDiffs = diffs
                .map(diff => selectedLines.reduce((result, range) => result || staging_1.intersectDiffWithRange(modifiedDocument, diff, range), null))
                .filter(d => !!d);
            if (!selectedDiffs.length) {
                return;
            }
            const invertedDiffs = selectedDiffs.map(staging_1.invertLineChange);
            const result = staging_1.applyLineChanges(modifiedDocument, originalDocument, invertedDiffs);
            yield this.model.stage(modifiedUri, result);
        });
    }
    clean(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resourceStates.length === 0 || !(resourceStates[0].resourceUri instanceof vscode_1.Uri)) {
                const resource = this.getSCMResource();
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const resources = resourceStates
                .filter(s => s instanceof model_1.Resource && s.resourceGroup instanceof model_1.WorkingTreeGroup);
            if (!resources.length) {
                return;
            }
            const message = resources.length === 1
                ? localize(10, null, path.basename(resources[0].resourceUri.fsPath))
                : localize(11, null, resources.length);
            const yes = localize(12, null);
            const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
            if (pick !== yes) {
                return;
            }
            yield this.model.clean(...resources);
        });
    }
    cleanAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const message = localize(13, null);
            const yes = localize(14, null);
            const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
            if (pick !== yes) {
                return;
            }
            yield this.model.clean(...this.model.workingTreeGroup.resources);
        });
    }
    smartCommit(getCommitMessage, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode_1.workspace.getConfiguration('git');
            const enableSmartCommit = config.get('enableSmartCommit') === true;
            const noStagedChanges = this.model.indexGroup.resources.length === 0;
            const noUnstagedChanges = this.model.workingTreeGroup.resources.length === 0;
            // no changes, and the user has not configured to commit all in this case
            if (!noUnstagedChanges && noStagedChanges && !enableSmartCommit) {
                // prompt the user if we want to commit all or not
                const message = localize(15, null);
                const yes = localize(16, null);
                const always = localize(17, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes, always);
                if (pick === always) {
                    config.update('enableSmartCommit', true, true);
                }
                else if (pick !== yes) {
                    return false; // do not commit on cancel
                }
            }
            if (!opts) {
                opts = { all: noStagedChanges };
            }
            if (
            // no changes
            (noStagedChanges && noUnstagedChanges)
                || (!opts.all && noStagedChanges)) {
                vscode_1.window.showInformationMessage(localize(18, null));
                return false;
            }
            const message = yield getCommitMessage();
            if (!message) {
                // TODO@joao: show modal dialog to confirm empty message commit
                return false;
            }
            yield this.model.commit(message, opts);
            return true;
        });
    }
    commitWithAnyInput(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = vscode_1.scm.inputBox.value;
            const getCommitMessage = () => __awaiter(this, void 0, void 0, function* () {
                if (message) {
                    return message;
                }
                return yield vscode_1.window.showInputBox({
                    placeHolder: localize(19, null),
                    prompt: localize(20, null),
                    ignoreFocusOut: true
                });
            });
            const didCommit = yield this.smartCommit(getCommitMessage, opts);
            if (message && didCommit) {
                vscode_1.scm.inputBox.value = yield this.model.getCommitTemplate();
            }
        });
    }
    commit() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput();
        });
    }
    commitWithInput() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!vscode_1.scm.inputBox.value) {
                return;
            }
            const didCommit = yield this.smartCommit(() => __awaiter(this, void 0, void 0, function* () { return vscode_1.scm.inputBox.value; }));
            if (didCommit) {
                vscode_1.scm.inputBox.value = yield this.model.getCommitTemplate();
            }
        });
    }
    commitStaged() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput({ all: false });
        });
    }
    commitStagedSigned() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput({ all: false, signoff: true });
        });
    }
    commitAll() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput({ all: true });
        });
    }
    commitAllSigned() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput({ all: true, signoff: true });
        });
    }
    undoCommit() {
        return __awaiter(this, void 0, void 0, function* () {
            const HEAD = this.model.HEAD;
            if (!HEAD || !HEAD.commit) {
                return;
            }
            const commit = yield this.model.getCommit('HEAD');
            yield this.model.reset('HEAD~');
            vscode_1.scm.inputBox.value = commit.message;
        });
    }
    checkout(treeish) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof treeish === 'string') {
                return yield this.model.checkout(treeish);
            }
            const config = vscode_1.workspace.getConfiguration('git');
            const checkoutType = config.get('checkoutType') || 'all';
            const includeTags = checkoutType === 'all' || checkoutType === 'tags';
            const includeRemotes = checkoutType === 'all' || checkoutType === 'remote';
            const heads = this.model.refs.filter(ref => ref.type === git_1.RefType.Head)
                .map(ref => new CheckoutItem(ref));
            const tags = (includeTags ? this.model.refs.filter(ref => ref.type === git_1.RefType.Tag) : [])
                .map(ref => new CheckoutTagItem(ref));
            const remoteHeads = (includeRemotes ? this.model.refs.filter(ref => ref.type === git_1.RefType.RemoteHead) : [])
                .map(ref => new CheckoutRemoteHeadItem(ref));
            const picks = [...heads, ...tags, ...remoteHeads];
            const placeHolder = localize(21, null);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            yield choice.run(this.model);
        });
    }
    branch() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield vscode_1.window.showInputBox({
                placeHolder: localize(22, null),
                prompt: localize(23, null),
                ignoreFocusOut: true
            });
            if (!result) {
                return;
            }
            const name = result.replace(/^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$/g, '-');
            yield this.model.branch(name);
        });
    }
    deleteBranch(name, force) {
        return __awaiter(this, void 0, void 0, function* () {
            let run;
            if (typeof name === 'string') {
                run = force => this.model.deleteBranch(name, force);
            }
            else {
                const currentHead = this.model.HEAD && this.model.HEAD.name;
                const heads = this.model.refs.filter(ref => ref.type === git_1.RefType.Head && ref.name !== currentHead)
                    .map(ref => new BranchDeleteItem(ref));
                const placeHolder = localize(24, null);
                const choice = yield vscode_1.window.showQuickPick(heads, { placeHolder });
                if (!choice || !choice.branchName) {
                    return;
                }
                name = choice.branchName;
                run = force => choice.run(this.model, force);
            }
            try {
                yield run(force);
            }
            catch (err) {
                if (err.gitErrorCode !== git_1.GitErrorCodes.BranchNotFullyMerged) {
                    throw err;
                }
                const message = localize(25, null, name);
                const yes = localize(26, null);
                const pick = yield vscode_1.window.showWarningMessage(message, yes);
                if (pick === yes) {
                    yield run(true);
                }
            }
        });
    }
    merge() {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode_1.workspace.getConfiguration('git');
            const checkoutType = config.get('checkoutType') || 'all';
            const includeRemotes = checkoutType === 'all' || checkoutType === 'remote';
            const heads = this.model.refs.filter(ref => ref.type === git_1.RefType.Head)
                .filter(ref => ref.name || ref.commit)
                .map(ref => new MergeItem(ref));
            const remoteHeads = (includeRemotes ? this.model.refs.filter(ref => ref.type === git_1.RefType.RemoteHead) : [])
                .filter(ref => ref.name || ref.commit)
                .map(ref => new MergeItem(ref));
            const picks = [...heads, ...remoteHeads];
            const placeHolder = localize(27, null);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            try {
                yield choice.run(this.model);
            }
            catch (err) {
                if (err.gitErrorCode !== git_1.GitErrorCodes.Conflict) {
                    throw err;
                }
                const message = localize(28, null);
                yield vscode_1.window.showWarningMessage(message);
            }
        });
    }
    pullFrom() {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = this.model.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(29, null));
                return;
            }
            const picks = remotes.map(r => ({ label: r.name, description: r.url }));
            const placeHolder = localize(30, null);
            const pick = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!pick) {
                return;
            }
            const branchName = yield vscode_1.window.showInputBox({
                placeHolder: localize(31, null),
                prompt: localize(32, null),
                ignoreFocusOut: true
            });
            if (!branchName) {
                return;
            }
            this.model.pull(false, pick.label, branchName);
        });
    }
    pull() {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = this.model.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(33, null));
                return;
            }
            yield this.model.pull();
        });
    }
    pullRebase() {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = this.model.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(34, null));
                return;
            }
            yield this.model.pullWithRebase();
        });
    }
    push() {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = this.model.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(35, null));
                return;
            }
            yield this.model.push();
        });
    }
    pushTo() {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = this.model.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(36, null));
                return;
            }
            if (!this.model.HEAD || !this.model.HEAD.name) {
                vscode_1.window.showWarningMessage(localize(37, null));
                return;
            }
            const branchName = this.model.HEAD.name;
            const picks = remotes.map(r => ({ label: r.name, description: r.url }));
            const placeHolder = localize(38, null, branchName);
            const pick = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!pick) {
                return;
            }
            this.model.pushTo(pick.label, branchName);
        });
    }
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            const HEAD = this.model.HEAD;
            if (!HEAD || !HEAD.upstream) {
                return;
            }
            const config = vscode_1.workspace.getConfiguration('git');
            const shouldPrompt = config.get('confirmSync') === true;
            if (shouldPrompt) {
                const message = localize(39, null, HEAD.upstream);
                const yes = localize(40, null);
                const neverAgain = localize(41, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes, neverAgain);
                if (pick === neverAgain) {
                    yield config.update('confirmSync', false, true);
                }
                else if (pick !== yes) {
                    return;
                }
            }
            yield this.model.sync();
        });
    }
    publish() {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = this.model.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(42, null));
                return;
            }
            const branchName = this.model.HEAD && this.model.HEAD.name || '';
            const picks = this.model.remotes.map(r => r.name);
            const placeHolder = localize(43, null, branchName);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            yield this.model.pushTo(choice, branchName, true);
        });
    }
    showOutput() {
        this.outputChannel.show();
    }
    ignore(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resourceStates.length === 0 || !(resourceStates[0].resourceUri instanceof vscode_1.Uri)) {
                const uri = vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.document.uri;
                if (!uri) {
                    return;
                }
                return yield this.model.ignore([uri]);
            }
            const uris = resourceStates
                .filter(s => s instanceof model_1.Resource)
                .map(r => r.resourceUri);
            if (!uris.length) {
                return;
            }
            yield this.model.ignore(uris);
        });
    }
    createCommand(id, key, method, skipModelCheck) {
        const result = (...args) => {
            if (!skipModelCheck && !this.model) {
                vscode_1.window.showInformationMessage(localize(44, null));
                return;
            }
            this.telemetryReporter.sendTelemetryEvent('git.command', { command: id });
            const result = Promise.resolve(method.apply(this, args));
            return result.catch((err) => __awaiter(this, void 0, void 0, function* () {
                let message;
                switch (err.gitErrorCode) {
                    case git_1.GitErrorCodes.DirtyWorkTree:
                        message = localize(45, null);
                        break;
                    case git_1.GitErrorCodes.PushRejected:
                        message = localize(46, null);
                        break;
                    default:
                        const hint = (err.stderr || err.message || String(err))
                            .replace(/^error: /mi, '')
                            .replace(/^> husky.*$/mi, '')
                            .split(/[\r\n]/)
                            .filter(line => !!line)[0];
                        message = hint
                            ? localize(47, null, hint)
                            : localize(48, null);
                        break;
                }
                if (!message) {
                    console.error(err);
                    return;
                }
                const outputChannel = this.outputChannel;
                const openOutputChannelChoice = localize(49, null);
                const choice = yield vscode_1.window.showErrorMessage(message, openOutputChannelChoice);
                if (choice === openOutputChannelChoice) {
                    outputChannel.show();
                }
            }));
        };
        // patch this object, so people can call methods directly
        this[key] = result;
        return result;
    }
    getSCMResource(uri) {
        uri = uri ? uri : vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.document.uri;
        if (!uri) {
            return undefined;
        }
        if (uri.scheme === 'git') {
            const { path } = uri_1.fromGitUri(uri);
            uri = vscode_1.Uri.file(path);
        }
        if (uri.scheme === 'file') {
            const uriString = uri.toString();
            return this.model.workingTreeGroup.resources.filter(r => r.resourceUri.toString() === uriString)[0]
                || this.model.indexGroup.resources.filter(r => r.resourceUri.toString() === uriString)[0];
        }
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
__decorate([
    command('git.refresh')
], CommandCenter.prototype, "refresh", null);
__decorate([
    command('git.openResource')
], CommandCenter.prototype, "openResource", null);
__decorate([
    command('git.clone', true)
], CommandCenter.prototype, "clone", null);
__decorate([
    command('git.init')
], CommandCenter.prototype, "init", null);
__decorate([
    command('git.openFile')
], CommandCenter.prototype, "openFile", null);
__decorate([
    command('git.openHEADFile')
], CommandCenter.prototype, "openHEADFile", null);
__decorate([
    command('git.openChange')
], CommandCenter.prototype, "openChange", null);
__decorate([
    command('git.openFileFromUri')
], CommandCenter.prototype, "openFileFromUri", null);
__decorate([
    command('git.stage')
], CommandCenter.prototype, "stage", null);
__decorate([
    command('git.stageAll')
], CommandCenter.prototype, "stageAll", null);
__decorate([
    command('git.stageSelectedRanges', false, true)
], CommandCenter.prototype, "stageSelectedRanges", null);
__decorate([
    command('git.revertSelectedRanges', false, true)
], CommandCenter.prototype, "revertSelectedRanges", null);
__decorate([
    command('git.unstage')
], CommandCenter.prototype, "unstage", null);
__decorate([
    command('git.unstageAll')
], CommandCenter.prototype, "unstageAll", null);
__decorate([
    command('git.unstageSelectedRanges', false, true)
], CommandCenter.prototype, "unstageSelectedRanges", null);
__decorate([
    command('git.clean')
], CommandCenter.prototype, "clean", null);
__decorate([
    command('git.cleanAll')
], CommandCenter.prototype, "cleanAll", null);
__decorate([
    command('git.commit')
], CommandCenter.prototype, "commit", null);
__decorate([
    command('git.commitWithInput')
], CommandCenter.prototype, "commitWithInput", null);
__decorate([
    command('git.commitStaged')
], CommandCenter.prototype, "commitStaged", null);
__decorate([
    command('git.commitStagedSigned')
], CommandCenter.prototype, "commitStagedSigned", null);
__decorate([
    command('git.commitAll')
], CommandCenter.prototype, "commitAll", null);
__decorate([
    command('git.commitAllSigned')
], CommandCenter.prototype, "commitAllSigned", null);
__decorate([
    command('git.undoCommit')
], CommandCenter.prototype, "undoCommit", null);
__decorate([
    command('git.checkout')
], CommandCenter.prototype, "checkout", null);
__decorate([
    command('git.branch')
], CommandCenter.prototype, "branch", null);
__decorate([
    command('git.deleteBranch')
], CommandCenter.prototype, "deleteBranch", null);
__decorate([
    command('git.merge')
], CommandCenter.prototype, "merge", null);
__decorate([
    command('git.pullFrom')
], CommandCenter.prototype, "pullFrom", null);
__decorate([
    command('git.pull')
], CommandCenter.prototype, "pull", null);
__decorate([
    command('git.pullRebase')
], CommandCenter.prototype, "pullRebase", null);
__decorate([
    command('git.push')
], CommandCenter.prototype, "push", null);
__decorate([
    command('git.pushTo')
], CommandCenter.prototype, "pushTo", null);
__decorate([
    command('git.sync')
], CommandCenter.prototype, "sync", null);
__decorate([
    command('git.publish')
], CommandCenter.prototype, "publish", null);
__decorate([
    command('git.showOutput')
], CommandCenter.prototype, "showOutput", null);
__decorate([
    command('git.ignore')
], CommandCenter.prototype, "ignore", null);
exports.CommandCenter = CommandCenter;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/git/out/commands.js.map
