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
const util_1 = require("./util");
const decorators_1 = require("./decorators");
const path = require("path");
const nls = require("vscode-nls");
const fs = require("fs");
const timeout = (millis) => new Promise(c => setTimeout(c, millis));
const localize = nls.loadMessageBundle(__filename);
const iconsRootPath = path.join(path.dirname(__dirname), 'resources', 'icons');
function getIconUri(iconName, theme) {
    return vscode_1.Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
}
var State;
(function (State) {
    State[State["Uninitialized"] = 0] = "Uninitialized";
    State[State["Idle"] = 1] = "Idle";
    State[State["NotAGitRepository"] = 2] = "NotAGitRepository";
})(State = exports.State || (exports.State = {}));
var Status;
(function (Status) {
    Status[Status["INDEX_MODIFIED"] = 0] = "INDEX_MODIFIED";
    Status[Status["INDEX_ADDED"] = 1] = "INDEX_ADDED";
    Status[Status["INDEX_DELETED"] = 2] = "INDEX_DELETED";
    Status[Status["INDEX_RENAMED"] = 3] = "INDEX_RENAMED";
    Status[Status["INDEX_COPIED"] = 4] = "INDEX_COPIED";
    Status[Status["MODIFIED"] = 5] = "MODIFIED";
    Status[Status["DELETED"] = 6] = "DELETED";
    Status[Status["UNTRACKED"] = 7] = "UNTRACKED";
    Status[Status["IGNORED"] = 8] = "IGNORED";
    Status[Status["ADDED_BY_US"] = 9] = "ADDED_BY_US";
    Status[Status["ADDED_BY_THEM"] = 10] = "ADDED_BY_THEM";
    Status[Status["DELETED_BY_US"] = 11] = "DELETED_BY_US";
    Status[Status["DELETED_BY_THEM"] = 12] = "DELETED_BY_THEM";
    Status[Status["BOTH_ADDED"] = 13] = "BOTH_ADDED";
    Status[Status["BOTH_DELETED"] = 14] = "BOTH_DELETED";
    Status[Status["BOTH_MODIFIED"] = 15] = "BOTH_MODIFIED";
})(Status = exports.Status || (exports.Status = {}));
class Resource {
    constructor(workspaceRoot, _resourceGroup, _resourceUri, _type, _renameResourceUri) {
        this.workspaceRoot = workspaceRoot;
        this._resourceGroup = _resourceGroup;
        this._resourceUri = _resourceUri;
        this._type = _type;
        this._renameResourceUri = _renameResourceUri;
    }
    get resourceUri() {
        if (this.renameResourceUri && (this._type === Status.MODIFIED || this._type === Status.DELETED || this._type === Status.INDEX_RENAMED || this._type === Status.INDEX_COPIED)) {
            return this.renameResourceUri;
        }
        return this._resourceUri;
    }
    get command() {
        return {
            command: 'git.openResource',
            title: localize(0, null),
            arguments: [this]
        };
    }
    get resourceGroup() { return this._resourceGroup; }
    get type() { return this._type; }
    get original() { return this._resourceUri; }
    get renameResourceUri() { return this._renameResourceUri; }
    getIconPath(theme) {
        switch (this.type) {
            case Status.INDEX_MODIFIED: return Resource.Icons[theme].Modified;
            case Status.MODIFIED: return Resource.Icons[theme].Modified;
            case Status.INDEX_ADDED: return Resource.Icons[theme].Added;
            case Status.INDEX_DELETED: return Resource.Icons[theme].Deleted;
            case Status.DELETED: return Resource.Icons[theme].Deleted;
            case Status.INDEX_RENAMED: return Resource.Icons[theme].Renamed;
            case Status.INDEX_COPIED: return Resource.Icons[theme].Copied;
            case Status.UNTRACKED: return Resource.Icons[theme].Untracked;
            case Status.IGNORED: return Resource.Icons[theme].Ignored;
            case Status.BOTH_DELETED: return Resource.Icons[theme].Conflict;
            case Status.ADDED_BY_US: return Resource.Icons[theme].Conflict;
            case Status.DELETED_BY_THEM: return Resource.Icons[theme].Conflict;
            case Status.ADDED_BY_THEM: return Resource.Icons[theme].Conflict;
            case Status.DELETED_BY_US: return Resource.Icons[theme].Conflict;
            case Status.BOTH_ADDED: return Resource.Icons[theme].Conflict;
            case Status.BOTH_MODIFIED: return Resource.Icons[theme].Conflict;
            default: return void 0;
        }
    }
    get strikeThrough() {
        switch (this.type) {
            case Status.DELETED:
            case Status.BOTH_DELETED:
            case Status.DELETED_BY_THEM:
            case Status.DELETED_BY_US:
            case Status.INDEX_DELETED:
                return true;
            default:
                return false;
        }
    }
    get faded() {
        const workspaceRootPath = this.workspaceRoot.fsPath;
        return this.resourceUri.fsPath.substr(0, workspaceRootPath.length) !== workspaceRootPath;
    }
    get decorations() {
        const light = { iconPath: this.getIconPath('light') };
        const dark = { iconPath: this.getIconPath('dark') };
        const strikeThrough = this.strikeThrough;
        const faded = this.faded;
        return { strikeThrough, faded, light, dark };
    }
}
Resource.Icons = {
    light: {
        Modified: getIconUri('status-modified', 'light'),
        Added: getIconUri('status-added', 'light'),
        Deleted: getIconUri('status-deleted', 'light'),
        Renamed: getIconUri('status-renamed', 'light'),
        Copied: getIconUri('status-copied', 'light'),
        Untracked: getIconUri('status-untracked', 'light'),
        Ignored: getIconUri('status-ignored', 'light'),
        Conflict: getIconUri('status-conflict', 'light'),
    },
    dark: {
        Modified: getIconUri('status-modified', 'dark'),
        Added: getIconUri('status-added', 'dark'),
        Deleted: getIconUri('status-deleted', 'dark'),
        Renamed: getIconUri('status-renamed', 'dark'),
        Copied: getIconUri('status-copied', 'dark'),
        Untracked: getIconUri('status-untracked', 'dark'),
        Ignored: getIconUri('status-ignored', 'dark'),
        Conflict: getIconUri('status-conflict', 'dark')
    }
};
__decorate([
    decorators_1.memoize
], Resource.prototype, "resourceUri", null);
__decorate([
    decorators_1.memoize
], Resource.prototype, "command", null);
__decorate([
    decorators_1.memoize
], Resource.prototype, "faded", null);
exports.Resource = Resource;
class ResourceGroup {
    constructor(_id, _label, _resources) {
        this._id = _id;
        this._label = _label;
        this._resources = _resources;
    }
    get id() { return this._id; }
    get contextKey() { return this._id; }
    get label() { return this._label; }
    get resources() { return this._resources; }
}
exports.ResourceGroup = ResourceGroup;
class MergeGroup extends ResourceGroup {
    constructor(resources = []) {
        super(MergeGroup.ID, localize(1, null), resources);
    }
}
MergeGroup.ID = 'merge';
exports.MergeGroup = MergeGroup;
class IndexGroup extends ResourceGroup {
    constructor(resources = []) {
        super(IndexGroup.ID, localize(2, null), resources);
    }
}
IndexGroup.ID = 'index';
exports.IndexGroup = IndexGroup;
class WorkingTreeGroup extends ResourceGroup {
    constructor(resources = []) {
        super(WorkingTreeGroup.ID, localize(3, null), resources);
    }
}
WorkingTreeGroup.ID = 'workingTree';
exports.WorkingTreeGroup = WorkingTreeGroup;
var Operation;
(function (Operation) {
    Operation[Operation["Status"] = 1] = "Status";
    Operation[Operation["Add"] = 2] = "Add";
    Operation[Operation["RevertFiles"] = 4] = "RevertFiles";
    Operation[Operation["Commit"] = 8] = "Commit";
    Operation[Operation["Clean"] = 16] = "Clean";
    Operation[Operation["Branch"] = 32] = "Branch";
    Operation[Operation["Checkout"] = 64] = "Checkout";
    Operation[Operation["Reset"] = 128] = "Reset";
    Operation[Operation["Fetch"] = 256] = "Fetch";
    Operation[Operation["Pull"] = 512] = "Pull";
    Operation[Operation["Push"] = 1024] = "Push";
    Operation[Operation["Sync"] = 2048] = "Sync";
    Operation[Operation["Init"] = 4096] = "Init";
    Operation[Operation["Show"] = 8192] = "Show";
    Operation[Operation["Stage"] = 16384] = "Stage";
    Operation[Operation["GetCommitTemplate"] = 32768] = "GetCommitTemplate";
    Operation[Operation["DeleteBranch"] = 65536] = "DeleteBranch";
    Operation[Operation["Merge"] = 131072] = "Merge";
    Operation[Operation["Ignore"] = 262144] = "Ignore";
})(Operation = exports.Operation || (exports.Operation = {}));
// function getOperationName(operation: Operation): string {
// 	switch (operation) {
// 		case Operation.Status: return 'Status';
// 		case Operation.Add: return 'Add';
// 		case Operation.RevertFiles: return 'RevertFiles';
// 		case Operation.Commit: return 'Commit';
// 		case Operation.Clean: return 'Clean';
// 		case Operation.Branch: return 'Branch';
// 		case Operation.Checkout: return 'Checkout';
// 		case Operation.Reset: return 'Reset';
// 		case Operation.Fetch: return 'Fetch';
// 		case Operation.Pull: return 'Pull';
// 		case Operation.Push: return 'Push';
// 		case Operation.Sync: return 'Sync';
// 		case Operation.Init: return 'Init';
// 		case Operation.Show: return 'Show';
// 		case Operation.Stage: return 'Stage';
// 		case Operation.GetCommitTemplate: return 'GetCommitTemplate';
// 		default: return 'unknown';
// 	}
// }
function isReadOnly(operation) {
    switch (operation) {
        case Operation.Show:
        case Operation.GetCommitTemplate:
            return true;
        default:
            return false;
    }
}
function shouldShowProgress(operation) {
    switch (operation) {
        case Operation.Fetch:
            return false;
        default:
            return true;
    }
}
class OperationsImpl {
    constructor(operations = 0) {
        this.operations = operations;
        // noop
    }
    start(operation) {
        return new OperationsImpl(this.operations | operation);
    }
    end(operation) {
        return new OperationsImpl(this.operations & ~operation);
    }
    isRunning(operation) {
        return (this.operations & operation) !== 0;
    }
    isIdle() {
        return this.operations === 0;
    }
}
class Model {
    constructor(_git, workspaceRootPath) {
        this._git = _git;
        this._onDidChangeRepository = new vscode_1.EventEmitter();
        this.onDidChangeRepository = this._onDidChangeRepository.event;
        this._onDidChangeState = new vscode_1.EventEmitter();
        this.onDidChangeState = this._onDidChangeState.event;
        this._onDidChangeResources = new vscode_1.EventEmitter();
        this.onDidChangeResources = this._onDidChangeResources.event;
        this._onRunOperation = new vscode_1.EventEmitter();
        this.onRunOperation = this._onRunOperation.event;
        this._onDidRunOperation = new vscode_1.EventEmitter();
        this.onDidRunOperation = this._onDidRunOperation.event;
        this._mergeGroup = new MergeGroup([]);
        this._indexGroup = new IndexGroup([]);
        this._workingTreeGroup = new WorkingTreeGroup([]);
        this._refs = [];
        this._remotes = [];
        this._operations = new OperationsImpl();
        this._state = State.Uninitialized;
        this.isRepositoryHuge = false;
        this.didWarnAboutLimit = false;
        this.repositoryDisposable = util_1.EmptyDisposable;
        this.disposables = [];
        this.workspaceRoot = vscode_1.Uri.file(workspaceRootPath);
        const fsWatcher = vscode_1.workspace.createFileSystemWatcher('**');
        this.onWorkspaceChange = util_1.anyEvent(fsWatcher.onDidChange, fsWatcher.onDidCreate, fsWatcher.onDidDelete);
        this.disposables.push(fsWatcher);
        this.status();
    }
    get onDidChange() {
        return util_1.anyEvent(this.onDidChangeState, this.onDidChangeResources);
    }
    get onDidChangeOperations() {
        return util_1.anyEvent(this.onRunOperation, this.onDidRunOperation);
    }
    get mergeGroup() { return this._mergeGroup; }
    get indexGroup() { return this._indexGroup; }
    get workingTreeGroup() { return this._workingTreeGroup; }
    get HEAD() {
        return this._HEAD;
    }
    get refs() {
        return this._refs;
    }
    get remotes() {
        return this._remotes;
    }
    get operations() { return this._operations; }
    get state() { return this._state; }
    set state(state) {
        this._state = state;
        this._onDidChangeState.fire(state);
        this._HEAD = undefined;
        this._refs = [];
        this._remotes = [];
        this._mergeGroup = new MergeGroup();
        this._indexGroup = new IndexGroup();
        this._workingTreeGroup = new WorkingTreeGroup();
        this._onDidChangeResources.fire();
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state !== State.NotAGitRepository) {
                return;
            }
            yield this._git.init(this.workspaceRoot.fsPath);
            yield this.status();
        });
    }
    status() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Status);
        });
    }
    add(...resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Add, () => this.repository.add(resources.map(r => r.resourceUri.fsPath)));
        });
    }
    stage(uri, contents) {
        return __awaiter(this, void 0, void 0, function* () {
            const relativePath = path.relative(this.repository.root, uri.fsPath).replace(/\\/g, '/');
            yield this.run(Operation.Stage, () => this.repository.stage(relativePath, contents));
        });
    }
    revertFiles(...resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.RevertFiles, () => this.repository.revertFiles('HEAD', resources.map(r => r.resourceUri.fsPath)));
        });
    }
    commit(message, opts = Object.create(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Commit, () => __awaiter(this, void 0, void 0, function* () {
                if (opts.all) {
                    yield this.repository.add([]);
                }
                yield this.repository.commit(message, opts);
            }));
        });
    }
    clean(...resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Clean, () => __awaiter(this, void 0, void 0, function* () {
                const toClean = [];
                const toCheckout = [];
                resources.forEach(r => {
                    switch (r.type) {
                        case Status.UNTRACKED:
                        case Status.IGNORED:
                            toClean.push(r.resourceUri.fsPath);
                            break;
                        default:
                            toCheckout.push(r.resourceUri.fsPath);
                            break;
                    }
                });
                const promises = [];
                if (toClean.length > 0) {
                    promises.push(this.repository.clean(toClean));
                }
                if (toCheckout.length > 0) {
                    promises.push(this.repository.checkout('', toCheckout));
                }
                yield Promise.all(promises);
            }));
        });
    }
    branch(name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Branch, () => this.repository.branch(name, true));
        });
    }
    deleteBranch(name, force) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.DeleteBranch, () => this.repository.deleteBranch(name, force));
        });
    }
    merge(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Merge, () => this.repository.merge(ref));
        });
    }
    checkout(treeish) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Checkout, () => this.repository.checkout(treeish, []));
        });
    }
    getCommit(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getCommit(ref);
        });
    }
    reset(treeish, hard) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Reset, () => this.repository.reset(treeish, hard));
        });
    }
    fetch() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.run(Operation.Fetch, () => this.repository.fetch());
            }
            catch (err) {
                // noop
            }
        });
    }
    pullWithRebase() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Pull, () => this.repository.pull(true));
        });
    }
    pull(rebase, remote, name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Pull, () => this.repository.pull(rebase, remote, name));
        });
    }
    push() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Push, () => this.repository.push());
        });
    }
    pullFrom(rebase, remote, branch) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Pull, () => this.repository.pull(rebase, remote, branch));
        });
    }
    pushTo(remote, name, setUpstream = false) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Push, () => this.repository.push(remote, name, setUpstream));
        });
    }
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Sync, () => __awaiter(this, void 0, void 0, function* () {
                yield this.repository.pull();
                const shouldPush = this.HEAD && typeof this.HEAD.ahead === 'number' ? this.HEAD.ahead > 0 : true;
                if (shouldPush) {
                    yield this.repository.push();
                }
            }));
        });
    }
    show(ref, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.Show, () => __awaiter(this, void 0, void 0, function* () {
                const relativePath = path.relative(this.repository.root, filePath).replace(/\\/g, '/');
                const configFiles = vscode_1.workspace.getConfiguration('files');
                const encoding = configFiles.get('encoding');
                return yield this.repository.buffer(`${ref}:${relativePath}`, encoding);
            }));
        });
    }
    getCommitTemplate() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.GetCommitTemplate, () => __awaiter(this, void 0, void 0, function* () { return this.repository.getCommitTemplate(); }));
        });
    }
    ignore(files) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.Ignore, () => __awaiter(this, void 0, void 0, function* () {
                const ignoreFile = `${this.repository.root}${path.sep}.gitignore`;
                const textToAppend = files
                    .map(uri => path.relative(this.repository.root, uri.fsPath).replace(/\\/g, '/'))
                    .join('\n');
                const document = (yield new Promise(c => fs.exists(ignoreFile, c)))
                    ? yield vscode_1.workspace.openTextDocument(ignoreFile)
                    : yield vscode_1.workspace.openTextDocument(vscode_1.Uri.file(ignoreFile).with({ scheme: 'untitled' }));
                yield vscode_1.window.showTextDocument(document);
                const edit = new vscode_1.WorkspaceEdit();
                const lastLine = document.lineAt(document.lineCount - 1);
                const text = lastLine.isEmptyOrWhitespace ? `${textToAppend}\n` : `\n${textToAppend}\n`;
                edit.insert(document.uri, lastLine.range.end, text);
                vscode_1.workspace.applyEdit(edit);
            }));
        });
    }
    run(operation, runOperation = () => Promise.resolve(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            const run = () => __awaiter(this, void 0, void 0, function* () {
                this._operations = this._operations.start(operation);
                this._onRunOperation.fire(operation);
                try {
                    yield this.assertIdleState();
                    const result = yield this.retryRun(runOperation);
                    if (!isReadOnly(operation)) {
                        yield this.updateModelState();
                    }
                    return result;
                }
                catch (err) {
                    if (err.gitErrorCode === git_1.GitErrorCodes.NotAGitRepository) {
                        this.repositoryDisposable.dispose();
                        const disposables = [];
                        this.onWorkspaceChange(this.onFSChange, this, disposables);
                        this.repositoryDisposable = util_1.combinedDisposable(disposables);
                        this.state = State.NotAGitRepository;
                    }
                    throw err;
                }
                finally {
                    this._operations = this._operations.end(operation);
                    this._onDidRunOperation.fire(operation);
                }
            });
            return shouldShowProgress(operation)
                ? vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.SourceControl }, run)
                : run();
        });
    }
    retryRun(runOperation = () => Promise.resolve(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            let attempt = 0;
            while (true) {
                try {
                    attempt++;
                    return yield runOperation();
                }
                catch (err) {
                    if (err.gitErrorCode === git_1.GitErrorCodes.RepositoryIsLocked && attempt <= 10) {
                        // quatratic backoff
                        yield timeout(Math.pow(attempt, 2) * 50);
                    }
                    else {
                        throw err;
                    }
                }
            }
        });
    }
    /* We use the native Node `watch` for faster, non debounced events.
     * That way we hopefully get the events during the operations we're
     * performing, thus sparing useless `git status` calls to refresh
     * the model's state.
     */
    assertIdleState() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === State.Idle) {
                return;
            }
            this.repositoryDisposable.dispose();
            const disposables = [];
            const repositoryRoot = yield this._git.getRepositoryRoot(this.workspaceRoot.fsPath);
            this.repository = this._git.open(repositoryRoot);
            const onGitChange = util_1.filterEvent(this.onWorkspaceChange, uri => /\/\.git\//.test(uri.path));
            const onRelevantGitChange = util_1.filterEvent(onGitChange, uri => !/\/\.git\/index\.lock$/.test(uri.path));
            onRelevantGitChange(this.onFSChange, this, disposables);
            onRelevantGitChange(this._onDidChangeRepository.fire, this._onDidChangeRepository, disposables);
            const onNonGitChange = util_1.filterEvent(this.onWorkspaceChange, uri => !/\/\.git\//.test(uri.path));
            onNonGitChange(this.onFSChange, this, disposables);
            this.repositoryDisposable = util_1.combinedDisposable(disposables);
            this.isRepositoryHuge = false;
            this.didWarnAboutLimit = false;
            this.state = State.Idle;
        });
    }
    updateModelState() {
        return __awaiter(this, void 0, void 0, function* () {
            const { status, didHitLimit } = yield this.repository.getStatus();
            const config = vscode_1.workspace.getConfiguration('git');
            const shouldIgnore = config.get('ignoreLimitWarning') === true;
            this.isRepositoryHuge = didHitLimit;
            if (didHitLimit && !shouldIgnore && !this.didWarnAboutLimit) {
                const ok = { title: localize(4, null), isCloseAffordance: true };
                const neverAgain = { title: localize(5, null) };
                vscode_1.window.showWarningMessage(localize(6, null, this.repository.root), ok, neverAgain).then(result => {
                    if (result === neverAgain) {
                        config.update('ignoreLimitWarning', true, false);
                    }
                });
                this.didWarnAboutLimit = true;
            }
            let HEAD;
            try {
                HEAD = yield this.repository.getHEAD();
                if (HEAD.name) {
                    try {
                        HEAD = yield this.repository.getBranch(HEAD.name);
                    }
                    catch (err) {
                        // noop
                    }
                }
            }
            catch (err) {
                // noop
            }
            const [refs, remotes] = yield Promise.all([this.repository.getRefs(), this.repository.getRemotes()]);
            this._HEAD = HEAD;
            this._refs = refs;
            this._remotes = remotes;
            const index = [];
            const workingTree = [];
            const merge = [];
            status.forEach(raw => {
                const uri = vscode_1.Uri.file(path.join(this.repository.root, raw.path));
                const renameUri = raw.rename ? vscode_1.Uri.file(path.join(this.repository.root, raw.rename)) : undefined;
                switch (raw.x + raw.y) {
                    case '??': return workingTree.push(new Resource(this.workspaceRoot, this.workingTreeGroup, uri, Status.UNTRACKED));
                    case '!!': return workingTree.push(new Resource(this.workspaceRoot, this.workingTreeGroup, uri, Status.IGNORED));
                    case 'DD': return merge.push(new Resource(this.workspaceRoot, this.mergeGroup, uri, Status.BOTH_DELETED));
                    case 'AU': return merge.push(new Resource(this.workspaceRoot, this.mergeGroup, uri, Status.ADDED_BY_US));
                    case 'UD': return merge.push(new Resource(this.workspaceRoot, this.mergeGroup, uri, Status.DELETED_BY_THEM));
                    case 'UA': return merge.push(new Resource(this.workspaceRoot, this.mergeGroup, uri, Status.ADDED_BY_THEM));
                    case 'DU': return merge.push(new Resource(this.workspaceRoot, this.mergeGroup, uri, Status.DELETED_BY_US));
                    case 'AA': return merge.push(new Resource(this.workspaceRoot, this.mergeGroup, uri, Status.BOTH_ADDED));
                    case 'UU': return merge.push(new Resource(this.workspaceRoot, this.mergeGroup, uri, Status.BOTH_MODIFIED));
                }
                let isModifiedInIndex = false;
                switch (raw.x) {
                    case 'M':
                        index.push(new Resource(this.workspaceRoot, this.indexGroup, uri, Status.INDEX_MODIFIED));
                        isModifiedInIndex = true;
                        break;
                    case 'A':
                        index.push(new Resource(this.workspaceRoot, this.indexGroup, uri, Status.INDEX_ADDED));
                        break;
                    case 'D':
                        index.push(new Resource(this.workspaceRoot, this.indexGroup, uri, Status.INDEX_DELETED));
                        break;
                    case 'R':
                        index.push(new Resource(this.workspaceRoot, this.indexGroup, uri, Status.INDEX_RENAMED, renameUri));
                        break;
                    case 'C':
                        index.push(new Resource(this.workspaceRoot, this.indexGroup, uri, Status.INDEX_COPIED, renameUri));
                        break;
                }
                switch (raw.y) {
                    case 'M':
                        workingTree.push(new Resource(this.workspaceRoot, this.workingTreeGroup, uri, Status.MODIFIED, renameUri));
                        break;
                    case 'D':
                        workingTree.push(new Resource(this.workspaceRoot, this.workingTreeGroup, uri, Status.DELETED, renameUri));
                        break;
                }
            });
            this._mergeGroup = new MergeGroup(merge);
            this._indexGroup = new IndexGroup(index);
            this._workingTreeGroup = new WorkingTreeGroup(workingTree);
            this._onDidChangeResources.fire();
        });
    }
    onFSChange(uri) {
        const config = vscode_1.workspace.getConfiguration('git');
        const autorefresh = config.get('autorefresh');
        if (!autorefresh) {
            return;
        }
        if (this.isRepositoryHuge) {
            return;
        }
        if (!this.operations.isIdle()) {
            return;
        }
        this.eventuallyUpdateWhenIdleAndWait();
    }
    eventuallyUpdateWhenIdleAndWait() {
        this.updateWhenIdleAndWait();
    }
    updateWhenIdleAndWait() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.whenIdle();
            yield this.status();
            yield timeout(5000);
        });
    }
    whenIdle() {
        return __awaiter(this, void 0, void 0, function* () {
            while (!this.operations.isIdle()) {
                yield util_1.eventToPromise(this.onDidRunOperation);
            }
        });
    }
    dispose() {
        this.repositoryDisposable.dispose();
        this.disposables = util_1.dispose(this.disposables);
    }
}
__decorate([
    decorators_1.memoize
], Model.prototype, "onDidChange", null);
__decorate([
    decorators_1.memoize
], Model.prototype, "onDidChangeOperations", null);
__decorate([
    decorators_1.throttle
], Model.prototype, "init", null);
__decorate([
    decorators_1.throttle
], Model.prototype, "status", null);
__decorate([
    decorators_1.throttle
], Model.prototype, "fetch", null);
__decorate([
    decorators_1.throttle
], Model.prototype, "pullWithRebase", null);
__decorate([
    decorators_1.throttle
], Model.prototype, "pull", null);
__decorate([
    decorators_1.throttle
], Model.prototype, "push", null);
__decorate([
    decorators_1.throttle
], Model.prototype, "sync", null);
__decorate([
    decorators_1.throttle
], Model.prototype, "updateModelState", null);
__decorate([
    decorators_1.debounce(1000)
], Model.prototype, "eventuallyUpdateWhenIdleAndWait", null);
__decorate([
    decorators_1.throttle
], Model.prototype, "updateWhenIdleAndWait", null);
exports.Model = Model;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/git/out/model.js.map
