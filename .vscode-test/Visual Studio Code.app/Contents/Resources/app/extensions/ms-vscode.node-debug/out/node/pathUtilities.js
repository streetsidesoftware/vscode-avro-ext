/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Path = require("path");
var FS = require("fs");
var CP = require("child_process");
var glob = require('glob');
var minimatch = require('minimatch');
/**
  * The input paths must use the path syntax of the underlying operating system.
 */
function makePathAbsolute(absPath, relPath) {
    return Path.resolve(Path.dirname(absPath), relPath);
}
exports.makePathAbsolute = makePathAbsolute;
/**
 * Return the relative path between 'path' and 'target'.
 * The input paths must use the path syntax of the underlying operating system.
 */
function makeRelative(target, path) {
    var t = target.split(Path.sep);
    var p = path.split(Path.sep);
    var i = 0;
    for (; i < Math.min(t.length, p.length) && t[i] === p[i]; i++) {
    }
    var result = '';
    for (; i < p.length; i++) {
        result = Path.join(result, p[i]);
    }
    return result;
}
exports.makeRelative = makeRelative;
/**
 * Returns a path with a lower case drive letter.
 */
function normalizeDriveLetter(path) {
    var regex = /^([A-Z])(\:[\\\/].*)$/;
    if (regex.test(path)) {
        path = path.replace(regex, function (s, s1, s2) { return s1.toLowerCase() + s2; });
    }
    return path;
}
exports.normalizeDriveLetter = normalizeDriveLetter;
/**
 * Change back slashes to forward slashes;
 * on Windows and macOS convert to lower case.
 */
function pathNormalize(path) {
    path = path.replace(/\\/g, '/');
    if (process.platform === 'win32' || process.platform === 'darwin') {
        path = path.toLowerCase();
    }
    return path;
}
exports.pathNormalize = pathNormalize;
/**
 * On Windows change forward slashes to back slashes
 */
function pathToNative(path) {
    if (process.platform === 'win32') {
        path = path.replace(/\//g, '\\');
    }
    return path;
}
exports.pathToNative = pathToNative;
function pathCompare(path1, path2) {
    return normalizeDriveLetter(path1) === normalizeDriveLetter(path2);
}
exports.pathCompare = pathCompare;
/**
 * Given an absolute, normalized, and existing file path 'realPath' returns the exact path that the file has on disk.
 * On a case insensitive file system, the returned path might differ from the original path by character casing.
 * On a case sensitive file system, the returned path will always be identical to the original path.
 * In case of errors, null is returned. But you cannot use this function to verify that a path exists.
 * realPath does not handle '..' or '.' path segments and it does not take the locale into account.
 * Since a drive letter of a Windows path cannot be looked up, realPath normalizes the drive letter to lower case.
 */
function realPath(path) {
    var dir = Path.dirname(path);
    if (path === dir) {
        // is this an upper case drive letter?
        if (/^[A-Z]\:\\$/.test(path)) {
            path = path.toLowerCase();
        }
        return path;
    }
    var name = Path.basename(path).toLowerCase();
    try {
        var entries = FS.readdirSync(dir);
        var found = entries.filter(function (e) { return e.toLowerCase() === name; }); // use a case insensitive search
        if (found.length === 1) {
            // on a case sensitive filesystem we cannot determine here, whether the file exists or not, hence we need the 'file exists' precondition
            var prefix = realPath(dir); // recurse
            if (prefix) {
                return Path.join(prefix, found[0]);
            }
        }
        else if (found.length > 1) {
            // must be a case sensitive $filesystem
            var ix = found.indexOf(name);
            if (ix >= 0) {
                var prefix = realPath(dir); // recurse
                if (prefix) {
                    return Path.join(prefix, found[ix]);
                }
            }
        }
    }
    catch (error) {
        // silently ignore error
    }
    return null;
}
exports.realPath = realPath;
/**
 * Make sure that all directories of the given path exist (like mkdir -p).
 */
function mkdirs(path) {
    if (!FS.existsSync(path)) {
        mkdirs(Path.dirname(path));
        FS.mkdirSync(path);
    }
}
exports.mkdirs = mkdirs;
/*
 * Lookup the given program on the PATH and return its absolute path on success and undefined otherwise.
 */
function findOnPath(program) {
    var locator = process.platform === 'win32' ? 'C:\\Windows\\System32\\where.exe' : '/usr/bin/which';
    try {
        if (FS.existsSync(locator)) {
            var lines = CP.execSync(locator + " " + program).toString().split(/\r?\n/);
            if (process.platform === 'win32') {
                // return the first path that has a executable extension
                var executableExtensions = process.env['PATHEXT'].toUpperCase();
                for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                    var path = lines_1[_i];
                    var ext = Path.extname(path).toUpperCase();
                    if (ext && executableExtensions.indexOf(ext + ';') > 0) {
                        return path;
                    }
                }
            }
            else {
                // return the first path
                if (lines.length > 0) {
                    return lines[0];
                }
            }
            return undefined;
        }
        else {
            // do not report failure if 'locator' app doesn't exist
        }
        return program;
    }
    catch (err) {
        // fall through
    }
    // fail
    return undefined;
}
exports.findOnPath = findOnPath;
/*
 *
 */
function findExecutable(program) {
    if (process.platform === 'win32' && !Path.extname(program)) {
        var PATHEXT = process.env['PATHEXT'];
        if (PATHEXT) {
            var executableExtensions = PATHEXT.split(';');
            for (var _i = 0, executableExtensions_1 = executableExtensions; _i < executableExtensions_1.length; _i++) {
                var extension = executableExtensions_1[_i];
                var path = program + extension;
                if (FS.existsSync(path)) {
                    return path;
                }
            }
        }
    }
    if (FS.existsSync(program)) {
        return program;
    }
    return undefined;
}
exports.findExecutable = findExecutable;
//---- the following functions work with Windows and Unix-style paths independent from the underlying OS.
/**
 * Returns true if the Windows or Unix-style path is absolute.
 */
function isAbsolutePath(path) {
    if (path) {
        if (path.charAt(0) === '/') {
            return true;
        }
        if (/^[a-zA-Z]\:[\\\/]/.test(path)) {
            return true;
        }
    }
    return false;
}
exports.isAbsolutePath = isAbsolutePath;
/**
 * Convert the given Windows or Unix-style path into a normalized path that only uses forward slashes and has all superflous '..' sequences removed.
 * If the path starts with a Windows-style drive letter, a '/' is prepended.
 */
function normalize(path) {
    path = path.replace(/\\/g, '/');
    if (/^[a-zA-Z]\:\//.test(path)) {
        path = '/' + path;
    }
    path = Path.normalize(path); // use node's normalize to remove '<dir>/..' etc.
    path = path.replace(/\\/g, '/');
    return path;
}
exports.normalize = normalize;
/**
 * Convert the given normalized path into a Windows-style path.
 */
function toWindows(path) {
    if (/^\/[a-zA-Z]\:\//.test(path)) {
        path = path.substr(1);
    }
    path = path.replace(/\//g, '\\');
    return path;
}
exports.toWindows = toWindows;
/**
 * Append the given relative path to the absolute path and normalize the result.
 */
function join(absPath, relPath) {
    absPath = normalize(absPath);
    relPath = normalize(relPath);
    if (absPath.charAt(absPath.length - 1) === '/') {
        absPath = absPath + relPath;
    }
    else {
        absPath = absPath + '/' + relPath;
    }
    absPath = Path.normalize(absPath);
    absPath = absPath.replace(/\\/g, '/');
    return absPath;
}
exports.join = join;
/**
 * Return the relative path between 'from' and 'to'.
 */
function makeRelative2(from, to) {
    from = normalize(from);
    to = normalize(to);
    var froms = from.substr(1).split('/');
    var tos = to.substr(1).split('/');
    while (froms.length > 0 && tos.length > 0 && froms[0] === tos[0]) {
        froms.shift();
        tos.shift();
    }
    var l = froms.length - tos.length;
    if (l === 0) {
        l = tos.length - 1;
    }
    while (l > 0) {
        tos.unshift('..');
        l--;
    }
    return tos.join('/');
}
exports.makeRelative2 = makeRelative2;
function multiGlob(patterns, opts) {
    var globTasks = new Array();
    opts = extendObject({
        cache: Object.create(null),
        statCache: Object.create(null),
        realpathCache: Object.create(null),
        symlinks: Object.create(null),
        ignore: []
    }, opts);
    var isExclude = function (pattern) { return pattern[0] === '!'; };
    try {
        patterns.forEach(function (pattern, i) {
            if (isExclude(pattern)) {
                return;
            }
            var ignore = patterns.slice(i).filter(isExclude).map(function (pattern) { return pattern.slice(1); });
            globTasks.push({
                pattern: pattern,
                opts: extendObject(extendObject({}, opts), {
                    ignore: opts.ignore.concat(ignore)
                })
            });
        });
    }
    catch (err) {
        return Promise.reject(err);
    }
    return Promise.all(globTasks.map(function (task) {
        return new Promise(function (c, e) {
            glob(task.pattern, task.opts, function (err, files) {
                if (err) {
                    e(err);
                }
                else {
                    c(files);
                }
            });
        });
    })).then(function (results) {
        var set = new Set();
        for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
            var paths = results_1[_i];
            for (var _a = 0, paths_1 = paths; _a < paths_1.length; _a++) {
                var p = paths_1[_a];
                set.add(p);
            }
        }
        var array = new Array();
        set.forEach(function (v) { return array.push(Path.posix.normalize(v)); });
        return array;
    });
}
exports.multiGlob = multiGlob;
function multiGlobMatches(patterns, path) {
    var matched = false;
    for (var _i = 0, patterns_1 = patterns; _i < patterns_1.length; _i++) {
        var p = patterns_1[_i];
        var isExclude = p[0] === '!';
        if (matched !== isExclude) {
            break;
        }
        matched = minimatch(path, p);
    }
    return matched;
}
exports.multiGlobMatches = multiGlobMatches;
//---- misc
/**
 * Copy attributes from fromObject to toObject.
 */
function extendObject(toObject, fromObject) {
    for (var key in fromObject) {
        if (fromObject.hasOwnProperty(key)) {
            toObject[key] = fromObject[key];
        }
    }
    return toObject;
}
exports.extendObject = extendObject;
function stripBOM(s) {
    if (s && s[0] === '\uFEFF') {
        s = s.substr(1);
    }
    return s;
}
exports.stripBOM = stripBOM;

//# sourceMappingURL=../../out/node/pathUtilities.js.map
