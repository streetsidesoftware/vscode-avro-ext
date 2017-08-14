/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Path = require("path");
var FS = require("fs");
var CRYPTO = require("crypto");
var OS = require("os");
var XHR = require("request-light");
var SM = require("source-map");
var PathUtils = require("./pathUtilities");
var URI_1 = require("./URI");
var util = require('../../node_modules/source-map/lib/util.js');
var Bias;
(function (Bias) {
    Bias[Bias["GREATEST_LOWER_BOUND"] = 1] = "GREATEST_LOWER_BOUND";
    Bias[Bias["LEAST_UPPER_BOUND"] = 2] = "LEAST_UPPER_BOUND";
})(Bias = exports.Bias || (exports.Bias = {}));
var SourceMaps = (function () {
    function SourceMaps(session, generatedCodeDirectory, generatedCodeGlobs) {
        var _this = this;
        this._sourceMapCache = new Map(); // all cached source maps
        this._generatedToSourceMaps = new Map(); // generated file -> SourceMap
        this._sourceToGeneratedMaps = new Map(); // source file -> SourceMap
        this._session = session;
        generatedCodeGlobs = generatedCodeGlobs || [];
        if (generatedCodeDirectory) {
            generatedCodeGlobs.push(generatedCodeDirectory + '/**/*.js'); // backward compatibility: turn old outDir into a glob pattern
        }
        // try to find all source files upfront asynchroneously
        if (generatedCodeGlobs.length > 0) {
            this._preLoad = PathUtils.multiGlob(generatedCodeGlobs).then(function (paths) {
                return Promise.all(paths.map(function (path) {
                    return _this._findSourceMapUrlInFile(path).then(function (uri) {
                        return _this._getSourceMap(uri, path);
                    }).catch(function (err) {
                        return null;
                    });
                })).then(function (results) {
                    return void 0;
                }).catch(function (err) {
                    // silently ignore errors
                    return void 0;
                });
            });
        }
        else {
            this._preLoad = Promise.resolve(void 0);
        }
    }
    SourceMaps.prototype.MapPathFromSource = function (pathToSource) {
        var _this = this;
        return this._preLoad.then(function () {
            return _this._findSourceToGeneratedMapping(pathToSource).then(function (map) {
                return map ? map.generatedPath() : null;
            });
        });
    };
    SourceMaps.prototype.MapFromSource = function (pathToSource, line, column, bias) {
        var _this = this;
        return this._preLoad.then(function () {
            return _this._findSourceToGeneratedMapping(pathToSource).then(function (map) {
                if (map) {
                    line += 1; // source map impl is 1 based
                    var mr = map.generatedPositionFor(pathToSource, line, column, bias);
                    if (mr && typeof mr.line === 'number') {
                        return {
                            path: map.generatedPath(),
                            line: mr.line - 1,
                            column: mr.column
                        };
                    }
                }
                return null;
            });
        });
    };
    SourceMaps.prototype.MapToSource = function (pathToGenerated, content, line, column) {
        var _this = this;
        return this._preLoad.then(function () {
            return _this._findGeneratedToSourceMapping(pathToGenerated, content).then(function (map) {
                if (map) {
                    line += 1; // source map impl is 1 based
                    var mr = map.originalPositionFor(line, column, Bias.GREATEST_LOWER_BOUND);
                    if (!mr) {
                        mr = map.originalPositionFor(line, column, Bias.LEAST_UPPER_BOUND);
                    }
                    if (mr && mr.source) {
                        return {
                            path: mr.source,
                            content: mr.content,
                            line: mr.line - 1,
                            column: mr.column
                        };
                    }
                }
                return null;
            });
        });
    };
    //---- private -----------------------------------------------------------------------
    /**
     * Tries to find a SourceMap for the given source.
     * This is a bit tricky because the source does not contain any information about where
     * the generated code or the source map is located.
     * The code relies on the source cache populated by the exhaustive search over the 'outDirs' glob patterns
     * and some heuristics.
     */
    SourceMaps.prototype._findSourceToGeneratedMapping = function (pathToSource) {
        var _this = this;
        if (!pathToSource) {
            return Promise.resolve(null);
        }
        // try to find in cache by source path
        var pathToSourceKey = PathUtils.pathNormalize(pathToSource);
        var map = this._sourceToGeneratedMaps.get(pathToSourceKey);
        if (map) {
            return Promise.resolve(map);
        }
        var pathToGenerated = pathToSource;
        return Promise.resolve(map).then(function (map) {
            // heuristic: try to find the generated code side by side to the source
            var ext = Path.extname(pathToSource);
            if (ext !== '.js') {
                // use heuristic: change extension to ".js" and find a map for it
                var pos = pathToSource.lastIndexOf('.');
                if (pos >= 0) {
                    pathToGenerated = pathToSource.substr(0, pos) + '.js';
                    return _this._findGeneratedToSourceMapping(pathToGenerated);
                }
            }
            return map;
        }).then(function (map) {
            if (!map) {
                // heuristic for VSCode extension host support:
                // we know that the plugin has an "out" directory next to the "src" directory
                // TODO: get rid of this and use glob patterns instead
                if (!map) {
                    var srcSegment = Path.sep + 'src' + Path.sep;
                    if (pathToGenerated.indexOf(srcSegment) >= 0) {
                        var outSegment = Path.sep + 'out' + Path.sep;
                        return _this._findGeneratedToSourceMapping(pathToGenerated.replace(srcSegment, outSegment));
                    }
                }
            }
            return map;
        }).then(function (map) {
            if (map) {
                // remember found map for source key
                _this._sourceToGeneratedMaps.set(pathToSourceKey, map);
            }
            return map;
        });
    };
    /**
     * Tries to find a SourceMap for the given path to a generated file.
     * This is simple if the generated file has the 'sourceMappingURL' at the end.
     * If not, we are using some heuristics...
     */
    SourceMaps.prototype._findGeneratedToSourceMapping = function (pathToGenerated, content) {
        var _this = this;
        if (!pathToGenerated) {
            return Promise.resolve(null);
        }
        var pathToGeneratedKey = PathUtils.pathNormalize(pathToGenerated);
        var map = this._generatedToSourceMaps.get(pathToGeneratedKey);
        if (map) {
            return Promise.resolve(map);
        }
        // try to find a source map URL in the generated file
        return this._findSourceMapUrlInFile(pathToGenerated, content).then(function (uri) {
            if (uri) {
                return _this._getSourceMap(uri, pathToGenerated);
            }
            // heuristic: try to find map file side-by-side to the generated source
            var map_path = pathToGenerated + '.map';
            if (FS.existsSync(map_path)) {
                return _this._getSourceMap(URI_1.URI.file(map_path), pathToGenerated);
            }
            return Promise.resolve(null);
        });
    };
    /**
     * Try to find the 'sourceMappingURL' in content or the file with the given path.
     * Returns null if no source map url is found or if an error occured.
     */
    SourceMaps.prototype._findSourceMapUrlInFile = function (pathToGenerated, content) {
        var _this = this;
        if (content) {
            return Promise.resolve(this._findSourceMapUrl(content, pathToGenerated));
        }
        return this._readFile(pathToGenerated).then(function (content) {
            return _this._findSourceMapUrl(content, pathToGenerated);
        }).catch(function (err) {
            return null;
        });
    };
    /**
     * Try to find the 'sourceMappingURL' at the end of the given contents.
     * Relative file paths are converted into absolute paths.
     * Returns null if no source map url is found.
     */
    SourceMaps.prototype._findSourceMapUrl = function (contents, pathToGenerated) {
        var lines = contents.split('\n');
        for (var l = lines.length - 1; l >= Math.max(lines.length - 10, 0); l--) {
            var line = lines[l].trim();
            var matches = SourceMaps.SOURCE_MAPPING_MATCHER.exec(line);
            if (matches && matches.length === 2) {
                var uri = matches[1].trim();
                if (pathToGenerated) {
                    this._log("_findSourceMapUrl: source map url found at end of generated file '" + pathToGenerated + "'");
                    return URI_1.URI.parse(uri, Path.dirname(pathToGenerated));
                }
                else {
                    this._log("_findSourceMapUrl: source map url found at end of generated content");
                    return URI_1.URI.parse(uri);
                }
            }
        }
        return null;
    };
    /**
     * Returns a (cached) SourceMap specified via the given uri.
     */
    SourceMaps.prototype._getSourceMap = function (uri, pathToGenerated) {
        var _this = this;
        if (!uri) {
            return Promise.resolve(null);
        }
        // use sha256 to ensure the hash value can be used in filenames
        var hash = CRYPTO.createHash('sha256').update(uri.uri()).digest('hex');
        var promise = this._sourceMapCache.get(hash);
        if (!promise) {
            try {
                promise = this._loadSourceMap(uri, pathToGenerated, hash)
                    .catch(function (err) {
                    _this._log("_loadSourceMap: loading source map '" + uri.uri() + "' failed with exception: " + err);
                    return null;
                });
                this._sourceMapCache.set(hash, promise);
            }
            catch (err) {
                this._log("_loadSourceMap: loading source map '" + uri.uri() + "' failed with exception: " + err);
                promise = Promise.resolve(null);
            }
        }
        return promise;
    };
    /**
     * Loads a SourceMap specified by the given uri.
     */
    SourceMaps.prototype._loadSourceMap = function (uri, pathToGenerated, hash) {
        var _this = this;
        if (uri.isFile()) {
            var map_path_1 = uri.filePath();
            return this._readFile(map_path_1).then(function (content) {
                return _this._registerSourceMap(new SourceMap(map_path_1, pathToGenerated, content));
            });
        }
        if (uri.isData()) {
            var data = uri.data();
            if (data) {
                try {
                    var buffer = new Buffer(data, 'base64');
                    var json = buffer.toString();
                    if (json) {
                        return Promise.resolve(this._registerSourceMap(new SourceMap(pathToGenerated, pathToGenerated, json)));
                    }
                }
                catch (e) {
                    throw new Error("exception while processing data url");
                }
            }
            throw new Error("exception while processing data url");
        }
        if (uri.isHTTP()) {
            var cache_path = Path.join(OS.tmpdir(), 'com.microsoft.VSCode', 'node-debug', 'sm-cache');
            var path_1 = Path.join(cache_path, hash);
            return Promise.resolve(FS.existsSync(path_1)).then(function (exists) {
                if (exists) {
                    return _this._readFile(path_1).then(function (content) {
                        return _this._registerSourceMap(new SourceMap(pathToGenerated, pathToGenerated, content));
                    });
                }
                var options = {
                    url: uri.uri(),
                    followRedirects: 5
                };
                return XHR.xhr(options).then(function (response) {
                    return _this._writeFile(path_1, response.responseText).then(function (content) {
                        return _this._registerSourceMap(new SourceMap(pathToGenerated, pathToGenerated, content));
                    });
                }).catch(function (error) {
                    return Promise.reject(XHR.getErrorStatusDescription(error.status) || error.toString());
                });
            });
        }
        throw new Error("url is not a valid source map");
    };
    /**
     * Register the given source map in all maps.
     */
    SourceMaps.prototype._registerSourceMap = function (map) {
        if (map) {
            var genPath = PathUtils.pathNormalize(map.generatedPath());
            this._generatedToSourceMaps.set(genPath, map);
            var sourcePaths = map.allSourcePaths();
            for (var _i = 0, sourcePaths_1 = sourcePaths; _i < sourcePaths_1.length; _i++) {
                var path = sourcePaths_1[_i];
                var key = PathUtils.pathNormalize(path);
                this._sourceToGeneratedMaps.set(key, map);
                this._log("_registerSourceMap: " + key + " -> " + genPath);
            }
        }
        return map;
    };
    SourceMaps.prototype._readFile = function (path, encoding) {
        if (encoding === void 0) { encoding = 'utf8'; }
        return new Promise(function (resolve, reject) {
            FS.readFile(path, encoding, function (err, fileContents) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(PathUtils.stripBOM(fileContents));
                }
            });
        });
    };
    SourceMaps.prototype._writeFile = function (path, data) {
        return new Promise(function (resolve, reject) {
            PathUtils.mkdirs(Path.dirname(path));
            FS.writeFile(path, data, function (err) {
                if (err) {
                    // ignore error
                    // reject(err);
                }
                resolve(data);
            });
        });
    };
    SourceMaps.prototype._log = function (message) {
        this._session.log('sm', message);
    };
    return SourceMaps;
}());
SourceMaps.SOURCE_MAPPING_MATCHER = new RegExp('^//[#@] ?sourceMappingURL=(.+)$');
exports.SourceMaps = SourceMaps;
var SourceMap = (function () {
    function SourceMap(mapPath, generatedPath, json) {
        var _this = this;
        this._sourcemapLocation = this.fixPath(Path.dirname(mapPath));
        var sm = JSON.parse(json);
        if (!generatedPath) {
            var file = sm.file;
            if (!PathUtils.isAbsolutePath(file)) {
                generatedPath = PathUtils.makePathAbsolute(mapPath, file);
            }
        }
        generatedPath = PathUtils.pathToNative(generatedPath);
        this._generatedFile = generatedPath;
        // fix all paths for use with the source-map npm module.
        sm.sourceRoot = this.fixPath(sm.sourceRoot, '');
        for (var i = 0; i < sm.sources.length; i++) {
            sm.sources[i] = this.fixPath(sm.sources[i]);
        }
        this._sourceRoot = sm.sourceRoot;
        // use source-map utilities to normalize sources entries
        this._sources = sm.sources
            .map(util.normalize)
            .map(function (source) {
            return _this._sourceRoot && util.isAbsolute(_this._sourceRoot) && util.isAbsolute(source)
                ? util.relative(_this._sourceRoot, source)
                : source;
        });
        try {
            this._smc = new SM.SourceMapConsumer(sm);
        }
        catch (e) {
            // ignore exception and leave _smc undefined
        }
    }
    /*
     * The generated file this source map belongs to.
     */
    SourceMap.prototype.generatedPath = function () {
        return this._generatedFile;
    };
    SourceMap.prototype.allSourcePaths = function () {
        var paths = new Array();
        for (var _i = 0, _a = this._sources; _i < _a.length; _i++) {
            var name_1 = _a[_i];
            if (!util.isAbsolute(name_1)) {
                name_1 = util.join(this._sourceRoot, name_1);
            }
            var path = this.absolutePath(name_1);
            paths.push(path);
        }
        return paths;
    };
    /*
     * Finds the nearest source location for the given location in the generated file.
     * Returns null if sourcemap is invalid.
     */
    SourceMap.prototype.originalPositionFor = function (line, column, bias) {
        if (!this._smc) {
            return null;
        }
        var needle = {
            line: line,
            column: column,
            bias: bias || Bias.LEAST_UPPER_BOUND
        };
        var mp = this._smc.originalPositionFor(needle);
        if (mp.source) {
            // if source map has inlined source, return it
            var src = this._smc.sourceContentFor(mp.source);
            if (src) {
                mp.content = src;
            }
            // map result back to absolute path
            mp.source = this.absolutePath(mp.source);
            mp.source = PathUtils.pathToNative(mp.source);
        }
        return mp;
    };
    /*
     * Finds the nearest location in the generated file for the given source location.
     * Returns null if sourcemap is invalid.
     */
    SourceMap.prototype.generatedPositionFor = function (absPath, line, column, bias) {
        if (!this._smc) {
            return null;
        }
        // make sure that we use an entry from the "sources" array that matches the passed absolute path
        var source = this.findSource(absPath);
        if (source) {
            var needle = {
                source: source,
                line: line,
                column: column,
                bias: bias || Bias.LEAST_UPPER_BOUND
            };
            return this._smc.generatedPositionFor(needle);
        }
        return null;
    };
    /**
     * fix a path for use with the source-map npm module because:
     * - source map sources are URLs, so even on Windows they should be using forward slashes.
     * - the source-map library expects forward slashes and their relative path logic
     *   (specifically the "normalize" function) gives incorrect results when passing in backslashes.
     * - paths starting with drive letters are not recognized as absolute by the source-map library.
     */
    SourceMap.prototype.fixPath = function (path, dflt) {
        if (path) {
            path = path.replace(/\\/g, '/');
            // if path starts with a drive letter convert path to a file url so that the source-map library can handle it
            if (/^[a-zA-Z]\:\//.test(path)) {
                // Windows drive letter must be prefixed with a slash
                path = encodeURI('file:///' + path);
            }
            return path;
        }
        return dflt;
    };
    /**
     * undo the fix
     */
    SourceMap.prototype.unfixPath = function (path) {
        var prefix = 'file://';
        if (path.indexOf(prefix) === 0) {
            path = path.substr(prefix.length);
            path = decodeURI(path);
            if (/^\/[a-zA-Z]\:\//.test(path)) {
                path = path.substr(1); // remove additional '/'
            }
        }
        return path;
    };
    /**
     * returns the first entry from the sources array that matches the given absPath
     * or null otherwise.
     */
    SourceMap.prototype.findSource = function (absPath) {
        absPath = PathUtils.pathNormalize(absPath);
        for (var _i = 0, _a = this._sources; _i < _a.length; _i++) {
            var name_2 = _a[_i];
            if (!util.isAbsolute(name_2)) {
                name_2 = util.join(this._sourceRoot, name_2);
            }
            var path = this.absolutePath(name_2);
            path = PathUtils.pathNormalize(path);
            if (absPath === path) {
                return name_2;
            }
        }
        return null;
    };
    /**
     * Tries to make the given path absolute by prefixing it with the source map's location.
     * Any url schemes are removed.
     */
    SourceMap.prototype.absolutePath = function (path) {
        if (!util.isAbsolute(path)) {
            path = util.join(this._sourcemapLocation, path);
        }
        return this.unfixPath(path);
    };
    return SourceMap;
}());
exports.SourceMap = SourceMap;

//# sourceMappingURL=../../out/node/sourceMaps.js.map
