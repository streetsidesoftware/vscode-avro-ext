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
const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");
const events_1 = require("events");
const iconv = require("iconv-lite");
const util_1 = require("./util");
const readdir = util_1.denodeify(fs.readdir);
const readfile = util_1.denodeify(fs.readFile);
var RefType;
(function (RefType) {
    RefType[RefType["Head"] = 0] = "Head";
    RefType[RefType["RemoteHead"] = 1] = "RemoteHead";
    RefType[RefType["Tag"] = 2] = "Tag";
})(RefType = exports.RefType || (exports.RefType = {}));
function parseVersion(raw) {
    return raw.replace(/^git version /, '');
}
function findSpecificGit(path) {
    return new Promise((c, e) => {
        const buffers = [];
        const child = cp.spawn(path, ['--version']);
        child.stdout.on('data', (b) => buffers.push(b));
        child.on('error', e);
        child.on('exit', code => code ? e(new Error('Not found')) : c({ path, version: parseVersion(Buffer.concat(buffers).toString('utf8').trim()) }));
    });
}
function findGitDarwin() {
    return new Promise((c, e) => {
        cp.exec('which git', (err, gitPathBuffer) => {
            if (err) {
                return e('git not found');
            }
            const path = gitPathBuffer.toString().replace(/^\s+|\s+$/g, '');
            function getVersion(path) {
                // make sure git executes
                cp.exec('git --version', (err, stdout) => {
                    if (err) {
                        return e('git not found');
                    }
                    return c({ path, version: parseVersion(stdout.toString('utf8').trim()) });
                });
            }
            if (path !== '/usr/bin/git') {
                return getVersion(path);
            }
            // must check if XCode is installed
            cp.exec('xcode-select -p', (err) => {
                if (err && err.code === 2) {
                    // git is not installed, and launching /usr/bin/git
                    // will prompt the user to install it
                    return e('git not found');
                }
                getVersion(path);
            });
        });
    });
}
function findSystemGitWin32(base) {
    if (!base) {
        return Promise.reject('Not found');
    }
    return findSpecificGit(path.join(base, 'Git', 'cmd', 'git.exe'));
}
function findGitHubGitWin32() {
    const github = path.join(process.env['LOCALAPPDATA'], 'GitHub');
    return readdir(github).then(children => {
        const git = children.filter(child => /^PortableGit/.test(child))[0];
        if (!git) {
            return Promise.reject('Not found');
        }
        return findSpecificGit(path.join(github, git, 'cmd', 'git.exe'));
    });
}
function findGitWin32() {
    return findSystemGitWin32(process.env['ProgramW6432'])
        .then(void 0, () => findSystemGitWin32(process.env['ProgramFiles(x86)']))
        .then(void 0, () => findSystemGitWin32(process.env['ProgramFiles']))
        .then(void 0, () => findSpecificGit('git'))
        .then(void 0, () => findGitHubGitWin32());
}
function findGit(hint) {
    var first = hint ? findSpecificGit(hint) : Promise.reject(null);
    return first.then(void 0, () => {
        switch (process.platform) {
            case 'darwin': return findGitDarwin();
            case 'win32': return findGitWin32();
            default: return findSpecificGit('git');
        }
    });
}
exports.findGit = findGit;
function exec(child, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!child.stdout || !child.stderr) {
            throw new GitError({
                message: 'Failed to get stdout or stderr from git process.'
            });
        }
        const disposables = [];
        const once = (ee, name, fn) => {
            ee.once(name, fn);
            disposables.push(util_1.toDisposable(() => ee.removeListener(name, fn)));
        };
        const on = (ee, name, fn) => {
            ee.on(name, fn);
            disposables.push(util_1.toDisposable(() => ee.removeListener(name, fn)));
        };
        let encoding = options.encoding || 'utf8';
        encoding = iconv.encodingExists(encoding) ? encoding : 'utf8';
        const [exitCode, stdout, stderr] = yield Promise.all([
            new Promise((c, e) => {
                once(child, 'error', e);
                once(child, 'exit', c);
            }),
            new Promise(c => {
                const buffers = [];
                on(child.stdout, 'data', b => buffers.push(b));
                once(child.stdout, 'close', () => c(iconv.decode(Buffer.concat(buffers), encoding)));
            }),
            new Promise(c => {
                const buffers = [];
                on(child.stderr, 'data', b => buffers.push(b));
                once(child.stderr, 'close', () => c(Buffer.concat(buffers).toString('utf8')));
            })
        ]);
        util_1.dispose(disposables);
        return { exitCode, stdout, stderr };
    });
}
class GitError {
    constructor(data) {
        if (data.error) {
            this.error = data.error;
            this.message = data.error.message;
        }
        else {
            this.error = void 0;
        }
        this.message = this.message || data.message || 'Git error';
        this.stdout = data.stdout;
        this.stderr = data.stderr;
        this.exitCode = data.exitCode;
        this.gitErrorCode = data.gitErrorCode;
        this.gitCommand = data.gitCommand;
    }
    toString() {
        let result = this.message + ' ' + JSON.stringify({
            exitCode: this.exitCode,
            gitErrorCode: this.gitErrorCode,
            gitCommand: this.gitCommand,
            stdout: this.stdout,
            stderr: this.stderr
        }, [], 2);
        if (this.error) {
            result += this.error.stack;
        }
        return result;
    }
}
exports.GitError = GitError;
exports.GitErrorCodes = {
    BadConfigFile: 'BadConfigFile',
    AuthenticationFailed: 'AuthenticationFailed',
    NoUserNameConfigured: 'NoUserNameConfigured',
    NoUserEmailConfigured: 'NoUserEmailConfigured',
    NoRemoteRepositorySpecified: 'NoRemoteRepositorySpecified',
    NotAGitRepository: 'NotAGitRepository',
    NotAtRepositoryRoot: 'NotAtRepositoryRoot',
    Conflict: 'Conflict',
    UnmergedChanges: 'UnmergedChanges',
    PushRejected: 'PushRejected',
    RemoteConnectionError: 'RemoteConnectionError',
    DirtyWorkTree: 'DirtyWorkTree',
    CantOpenResource: 'CantOpenResource',
    GitNotFound: 'GitNotFound',
    CantCreatePipe: 'CantCreatePipe',
    CantAccessRemote: 'CantAccessRemote',
    RepositoryNotFound: 'RepositoryNotFound',
    RepositoryIsLocked: 'RepositoryIsLocked',
    BranchNotFullyMerged: 'BranchNotFullyMerged',
    NoRemoteReference: 'NoRemoteReference'
};
function getGitErrorCode(stderr) {
    if (/Another git process seems to be running in this repository|If no other git process is currently running/.test(stderr)) {
        return exports.GitErrorCodes.RepositoryIsLocked;
    }
    else if (/Authentication failed/.test(stderr)) {
        return exports.GitErrorCodes.AuthenticationFailed;
    }
    else if (/Not a git repository/.test(stderr)) {
        return exports.GitErrorCodes.NotAGitRepository;
    }
    else if (/bad config file/.test(stderr)) {
        return exports.GitErrorCodes.BadConfigFile;
    }
    else if (/cannot make pipe for command substitution|cannot create standard input pipe/.test(stderr)) {
        return exports.GitErrorCodes.CantCreatePipe;
    }
    else if (/Repository not found/.test(stderr)) {
        return exports.GitErrorCodes.RepositoryNotFound;
    }
    else if (/unable to access/.test(stderr)) {
        return exports.GitErrorCodes.CantAccessRemote;
    }
    else if (/branch '.+' is not fully merged/.test(stderr)) {
        return exports.GitErrorCodes.BranchNotFullyMerged;
    }
    else if (/Couldn\'t find remote ref/.test(stderr)) {
        return exports.GitErrorCodes.NoRemoteReference;
    }
    return void 0;
}
class Git {
    constructor(options) {
        this._onOutput = new events_1.EventEmitter();
        this.gitPath = options.gitPath;
        this.version = options.version;
        this.env = options.env || {};
    }
    get onOutput() { return this._onOutput; }
    open(repository) {
        return new Repository(this, repository);
    }
    init(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.exec(repository, ['init']);
            return;
        });
    }
    clone(url, parentPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const folderName = url.replace(/^.*\//, '').replace(/\.git$/, '') || 'repository';
            const folderPath = path.join(parentPath, folderName);
            yield util_1.mkdirp(parentPath);
            yield this.exec(parentPath, ['clone', url, folderPath]);
            return folderPath;
        });
    }
    getRepositoryRoot(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.exec(path, ['rev-parse', '--show-toplevel']);
            return result.stdout.trim();
        });
    }
    exec(cwd, args, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            options = util_1.assign({ cwd }, options || {});
            return yield this._exec(args, options);
        });
    }
    stream(cwd, args, options = {}) {
        options = util_1.assign({ cwd }, options || {});
        return this.spawn(args, options);
    }
    _exec(args, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const child = this.spawn(args, options);
            if (options.input) {
                child.stdin.end(options.input, 'utf8');
            }
            const result = yield exec(child, options);
            if (options.log !== false && result.stderr.length > 0) {
                this.log(`${result.stderr}\n`);
            }
            if (result.exitCode) {
                return Promise.reject(new GitError({
                    message: 'Failed to execute git',
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: result.exitCode,
                    gitErrorCode: getGitErrorCode(result.stderr),
                    gitCommand: args[0]
                }));
            }
            return result;
        });
    }
    spawn(args, options = {}) {
        if (!this.gitPath) {
            throw new Error('git could not be found in the system.');
        }
        if (!options) {
            options = {};
        }
        if (!options.stdio && !options.input) {
            options.stdio = ['ignore', null, null]; // Unless provided, ignore stdin and leave default streams for stdout and stderr
        }
        options.env = util_1.assign({}, process.env, this.env, options.env || {}, {
            VSCODE_GIT_COMMAND: args[0],
            LC_ALL: 'en_US.UTF-8',
            LANG: 'en_US.UTF-8'
        });
        if (options.log !== false) {
            this.log(`git ${args.join(' ')}\n`);
        }
        return cp.spawn(this.gitPath, args, options);
    }
    log(output) {
        this._onOutput.emit('log', output);
    }
}
exports.Git = Git;
class GitStatusParser {
    constructor() {
        this.lastRaw = '';
        this.result = [];
    }
    get status() {
        return this.result;
    }
    update(raw) {
        let i = 0;
        let nextI;
        raw = this.lastRaw + raw;
        while ((nextI = this.parseEntry(raw, i)) !== undefined) {
            i = nextI;
        }
        this.lastRaw = raw.substr(i);
    }
    parseEntry(raw, i) {
        if (i + 4 >= raw.length) {
            return;
        }
        let lastIndex;
        const entry = {
            x: raw.charAt(i++),
            y: raw.charAt(i++),
            rename: undefined,
            path: ''
        };
        // space
        i++;
        if (entry.x === 'R' || entry.x === 'C') {
            lastIndex = raw.indexOf('\0', i);
            if (lastIndex === -1) {
                return;
            }
            entry.rename = raw.substring(i, lastIndex);
            i = lastIndex + 1;
        }
        lastIndex = raw.indexOf('\0', i);
        if (lastIndex === -1) {
            return;
        }
        entry.path = raw.substring(i, lastIndex);
        // If path ends with slash, it must be a nested git repo
        if (entry.path[entry.path.length - 1] !== '/') {
            this.result.push(entry);
        }
        return lastIndex + 1;
    }
}
exports.GitStatusParser = GitStatusParser;
class Repository {
    constructor(_git, repositoryRoot) {
        this._git = _git;
        this.repositoryRoot = repositoryRoot;
    }
    get git() {
        return this._git;
    }
    get root() {
        return this.repositoryRoot;
    }
    // TODO@Joao: rename to exec
    run(args, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.git.exec(this.repositoryRoot, args, options);
        });
    }
    stream(args, options = {}) {
        return this.git.stream(this.repositoryRoot, args, options);
    }
    spawn(args, options = {}) {
        return this.git.spawn(args, options);
    }
    config(scope, key, value, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['config'];
            if (scope) {
                args.push('--' + scope);
            }
            args.push(key);
            if (value) {
                args.push(value);
            }
            const result = yield this.run(args, options);
            return result.stdout;
        });
    }
    buffer(object, encoding = 'utf8') {
        return __awaiter(this, void 0, void 0, function* () {
            const child = this.stream(['show', object]);
            if (!child.stdout) {
                return Promise.reject('Can\'t open file from git');
            }
            const { exitCode, stdout } = yield exec(child, { encoding });
            if (exitCode) {
                return Promise.reject(new GitError({
                    message: 'Could not show object.',
                    exitCode
                }));
            }
            return stdout;
            // TODO@joao
            // return new Promise((c, e) => {
            // detectMimesFromStream(child.stdout, null, (err, result) => {
            // 	if (err) {
            // 		e(err);
            // 	} else if (isBinaryMime(result.mimes)) {
            // 		e(<IFileOperationResult>{
            // 			message: localize('fileBinaryError', "File seems to be binary and cannot be opened as text"),
            // 			fileOperationResult: FileOperationResult.FILE_IS_BINARY
            // 		});
            // 	} else {
            // c(this.doBuffer(object));
            // 	}
            // });
            // });
        });
    }
    add(paths) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['add', '-A', '--'];
            if (paths && paths.length) {
                args.push.apply(args, paths);
            }
            else {
                args.push('.');
            }
            yield this.run(args);
        });
    }
    stage(path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const child = this.stream(['hash-object', '--stdin', '-w'], { stdio: [null, null, null] });
            child.stdin.end(data, 'utf8');
            const { exitCode, stdout } = yield exec(child);
            if (exitCode) {
                throw new GitError({
                    message: 'Could not hash object.',
                    exitCode: exitCode
                });
            }
            yield this.run(['update-index', '--cacheinfo', '100644', stdout, path]);
        });
    }
    checkout(treeish, paths) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['checkout', '-q'];
            if (treeish) {
                args.push(treeish);
            }
            if (paths && paths.length) {
                args.push('--');
                args.push.apply(args, paths);
            }
            try {
                yield this.run(args);
            }
            catch (err) {
                if (/Please, commit your changes or stash them/.test(err.stderr || '')) {
                    err.gitErrorCode = exports.GitErrorCodes.DirtyWorkTree;
                }
                throw err;
            }
        });
    }
    commit(message, opts = Object.create(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['commit', '--quiet', '--allow-empty-message', '--file', '-'];
            if (opts.all) {
                args.push('--all');
            }
            if (opts.amend) {
                args.push('--amend');
            }
            if (opts.signoff) {
                args.push('--signoff');
            }
            try {
                yield this.run(args, { input: message || '' });
            }
            catch (commitErr) {
                if (/not possible because you have unmerged files/.test(commitErr.stderr || '')) {
                    commitErr.gitErrorCode = exports.GitErrorCodes.UnmergedChanges;
                    throw commitErr;
                }
                try {
                    yield this.run(['config', '--get-all', 'user.name']);
                }
                catch (err) {
                    err.gitErrorCode = exports.GitErrorCodes.NoUserNameConfigured;
                    throw err;
                }
                try {
                    yield this.run(['config', '--get-all', 'user.email']);
                }
                catch (err) {
                    err.gitErrorCode = exports.GitErrorCodes.NoUserEmailConfigured;
                    throw err;
                }
                throw commitErr;
            }
        });
    }
    branch(name, checkout) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = checkout ? ['checkout', '-q', '-b', name] : ['branch', '-q', name];
            yield this.run(args);
        });
    }
    deleteBranch(name, force) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['branch', force ? '-D' : '-d', name];
            yield this.run(args);
        });
    }
    merge(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['merge', ref];
            try {
                yield this.run(args);
            }
            catch (err) {
                if (/^CONFLICT /m.test(err.stdout || '')) {
                    err.gitErrorCode = exports.GitErrorCodes.Conflict;
                }
                throw err;
            }
        });
    }
    clean(paths) {
        return __awaiter(this, void 0, void 0, function* () {
            const pathsByGroup = util_1.groupBy(paths, p => path.dirname(p));
            const groups = Object.keys(pathsByGroup).map(k => pathsByGroup[k]);
            const tasks = groups.map(paths => () => this.run(['clean', '-f', '-q', '--'].concat(paths)));
            for (let task of tasks) {
                yield task();
            }
        });
    }
    undo() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(['clean', '-fd']);
            try {
                yield this.run(['checkout', '--', '.']);
            }
            catch (err) {
                if (/did not match any file\(s\) known to git\./.test(err.stderr || '')) {
                    return;
                }
                throw err;
            }
        });
    }
    reset(treeish, hard = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['reset'];
            if (hard) {
                args.push('--hard');
            }
            args.push(treeish);
            yield this.run(args);
        });
    }
    revertFiles(treeish, paths) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.run(['branch']);
            let args;
            // In case there are no branches, we must use rm --cached
            if (!result.stdout) {
                args = ['rm', '--cached', '-r', '--'];
            }
            else {
                args = ['reset', '-q', treeish, '--'];
            }
            if (paths && paths.length) {
                args.push.apply(args, paths);
            }
            else {
                args.push('.');
            }
            try {
                yield this.run(args);
            }
            catch (err) {
                // In case there are merge conflicts to be resolved, git reset will output
                // some "needs merge" data. We try to get around that.
                if (/([^:]+: needs merge\n)+/m.test(err.stdout || '')) {
                    return;
                }
                throw err;
            }
        });
    }
    fetch() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.run(['fetch']);
            }
            catch (err) {
                if (/No remote repository specified\./.test(err.stderr || '')) {
                    err.gitErrorCode = exports.GitErrorCodes.NoRemoteRepositorySpecified;
                }
                else if (/Could not read from remote repository/.test(err.stderr || '')) {
                    err.gitErrorCode = exports.GitErrorCodes.RemoteConnectionError;
                }
                throw err;
            }
        });
    }
    pull(rebase, remote, branch) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['pull'];
            if (rebase) {
                args.push('-r');
            }
            if (remote && branch) {
                args.push(remote);
                args.push(branch);
            }
            try {
                yield this.run(args);
            }
            catch (err) {
                if (/^CONFLICT \([^)]+\): \b/m.test(err.stdout || '')) {
                    err.gitErrorCode = exports.GitErrorCodes.Conflict;
                }
                else if (/Please tell me who you are\./.test(err.stderr || '')) {
                    err.gitErrorCode = exports.GitErrorCodes.NoUserNameConfigured;
                }
                else if (/Could not read from remote repository/.test(err.stderr || '')) {
                    err.gitErrorCode = exports.GitErrorCodes.RemoteConnectionError;
                }
                else if (/Pull is not possible because you have unmerged files|Cannot pull with rebase: You have unstaged changes|Your local changes to the following files would be overwritten|Please, commit your changes before you can merge/.test(err.stderr)) {
                    err.gitErrorCode = exports.GitErrorCodes.DirtyWorkTree;
                }
                throw err;
            }
        });
    }
    push(remote, name, setUpstream = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['push'];
            if (setUpstream) {
                args.push('-u');
            }
            if (remote) {
                args.push(remote);
            }
            if (name) {
                args.push(name);
            }
            try {
                yield this.run(args);
            }
            catch (err) {
                if (/^error: failed to push some refs to\b/m.test(err.stderr || '')) {
                    err.gitErrorCode = exports.GitErrorCodes.PushRejected;
                }
                else if (/Could not read from remote repository/.test(err.stderr || '')) {
                    err.gitErrorCode = exports.GitErrorCodes.RemoteConnectionError;
                }
                throw err;
            }
        });
    }
    getStatus(limit = 5000) {
        return new Promise((c, e) => {
            const parser = new GitStatusParser();
            const child = this.stream(['status', '-z', '-u']);
            const onExit = exitCode => {
                if (exitCode !== 0) {
                    const stderr = stderrData.join('');
                    return e(new GitError({
                        message: 'Failed to execute git',
                        stderr,
                        exitCode,
                        gitErrorCode: getGitErrorCode(stderr),
                        gitCommand: 'status'
                    }));
                }
                c({ status: parser.status, didHitLimit: false });
            };
            const onStdoutData = (raw) => {
                parser.update(raw);
                if (parser.status.length > 5000) {
                    child.removeListener('exit', onExit);
                    child.stdout.removeListener('data', onStdoutData);
                    child.kill();
                    c({ status: parser.status.slice(0, 5000), didHitLimit: true });
                }
            };
            child.stdout.setEncoding('utf8');
            child.stdout.on('data', onStdoutData);
            const stderrData = [];
            child.stderr.setEncoding('utf8');
            child.stderr.on('data', raw => stderrData.push(raw));
            child.on('error', e);
            child.on('exit', onExit);
        });
    }
    getHEAD() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.run(['symbolic-ref', '--short', 'HEAD']);
                if (!result.stdout) {
                    throw new Error('Not in a branch');
                }
                return { name: result.stdout.trim(), commit: void 0, type: RefType.Head };
            }
            catch (err) {
                const result = yield this.run(['rev-parse', 'HEAD']);
                if (!result.stdout) {
                    throw new Error('Error parsing HEAD');
                }
                return { name: void 0, commit: result.stdout.trim(), type: RefType.Head };
            }
        });
    }
    getRefs() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.run(['for-each-ref', '--format', '%(refname) %(objectname)']);
            const fn = (line) => {
                let match;
                if (match = /^refs\/heads\/([^ ]+) ([0-9a-f]{40})$/.exec(line)) {
                    return { name: match[1], commit: match[2], type: RefType.Head };
                }
                else if (match = /^refs\/remotes\/([^/]+)\/([^ ]+) ([0-9a-f]{40})$/.exec(line)) {
                    return { name: `${match[1]}/${match[2]}`, commit: match[3], type: RefType.RemoteHead, remote: match[1] };
                }
                else if (match = /^refs\/tags\/([^ ]+) ([0-9a-f]{40})$/.exec(line)) {
                    return { name: match[1], commit: match[2], type: RefType.Tag };
                }
                return null;
            };
            return result.stdout.trim().split('\n')
                .filter(line => !!line)
                .map(fn)
                .filter(ref => !!ref);
        });
    }
    getRemotes() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.run(['remote', '--verbose']);
            const regex = /^([^\s]+)\s+([^\s]+)\s/;
            const rawRemotes = result.stdout.trim().split('\n')
                .filter(b => !!b)
                .map(line => regex.exec(line))
                .filter(g => !!g)
                .map((groups) => ({ name: groups[1], url: groups[2] }));
            return util_1.uniqBy(rawRemotes, remote => remote.name);
        });
    }
    getBranch(name) {
        return __awaiter(this, void 0, void 0, function* () {
            if (name === 'HEAD') {
                return this.getHEAD();
            }
            const result = yield this.run(['rev-parse', name]);
            if (!result.stdout) {
                return Promise.reject(new Error('No such branch'));
            }
            const commit = result.stdout.trim();
            try {
                const res2 = yield this.run(['rev-parse', '--symbolic-full-name', '--abbrev-ref', name + '@{u}']);
                const upstream = res2.stdout.trim();
                const res3 = yield this.run(['rev-list', '--left-right', name + '...' + upstream]);
                let ahead = 0, behind = 0;
                let i = 0;
                while (i < res3.stdout.length) {
                    switch (res3.stdout.charAt(i)) {
                        case '<':
                            ahead++;
                            break;
                        case '>':
                            behind++;
                            break;
                        default:
                            i++;
                            break;
                    }
                    while (res3.stdout.charAt(i++) !== '\n') { }
                }
                return { name, type: RefType.Head, commit, upstream, ahead, behind };
            }
            catch (err) {
                return { name, type: RefType.Head, commit };
            }
        });
    }
    getCommitTemplate() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.run(['config', '--get', 'commit.template']);
                if (!result.stdout) {
                    return '';
                }
                // https://github.com/git/git/blob/3a0f269e7c82aa3a87323cb7ae04ac5f129f036b/path.c#L612
                const homedir = os.homedir();
                let templatePath = result.stdout.trim()
                    .replace(/^~([^\/]*)\//, (_, user) => `${user ? path.join(path.dirname(homedir), user) : homedir}/`);
                if (!path.isAbsolute(templatePath)) {
                    templatePath = path.join(this.repositoryRoot, templatePath);
                }
                const raw = yield readfile(templatePath, 'utf8');
                return raw.replace(/^\s*#.*$\n?/gm, '').trim();
            }
            catch (err) {
                return '';
            }
        });
    }
    getCommit(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.run(['show', '-s', '--format=%H\n%B', ref]);
            const match = /^([0-9a-f]{40})\n([^]*)$/m.exec(result.stdout.trim());
            if (!match) {
                return Promise.reject('bad commit format');
            }
            return { hash: match[1], message: match[2] };
        });
    }
}
exports.Repository = Repository;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/git/out/git.js.map
