/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var EE = require("events");
var nls = require("vscode-nls");
var localize = nls.loadMessageBundle(__filename);
var NodeV8Message = (function () {
    function NodeV8Message(type) {
        this.seq = 0;
        this.type = type;
    }
    return NodeV8Message;
}());
exports.NodeV8Message = NodeV8Message;
var NodeV8Response = (function (_super) {
    __extends(NodeV8Response, _super);
    function NodeV8Response(request, message) {
        var _this = _super.call(this, 'response') || this;
        _this.request_seq = request.seq;
        _this.command = request.command;
        if (message) {
            _this.success = false;
            _this.message = message;
        }
        else {
            _this.success = true;
        }
        return _this;
    }
    return NodeV8Response;
}(NodeV8Message));
exports.NodeV8Response = NodeV8Response;
var NodeV8Event = (function (_super) {
    __extends(NodeV8Event, _super);
    function NodeV8Event(event, body) {
        var _this = _super.call(this, 'event') || this;
        _this.event = event;
        if (body) {
            _this.body = body;
        }
        return _this;
    }
    return NodeV8Event;
}(NodeV8Message));
exports.NodeV8Event = NodeV8Event;
//---- the protocol implementation
var NodeV8Protocol = (function (_super) {
    __extends(NodeV8Protocol, _super);
    function NodeV8Protocol(responseHook) {
        var _this = _super.call(this) || this;
        _this._pendingRequests = new Map();
        _this.embeddedHostVersion = -1;
        _this._responseHook = responseHook;
        return _this;
    }
    NodeV8Protocol.prototype.startDispatch = function (inStream, outStream) {
        var _this = this;
        this._sequence = 1;
        this._writableStream = outStream;
        inStream.on('data', function (data) { return _this.execute(data); });
        inStream.on('close', function () {
            _this.emitEvent(new NodeV8Event('close'));
        });
        inStream.on('error', function (error) {
            _this.emitEvent(new NodeV8Event('error'));
        });
        outStream.on('error', function (error) {
            _this.emitEvent(new NodeV8Event('error'));
        });
        inStream.resume();
    };
    NodeV8Protocol.prototype.stop = function () {
        if (this._writableStream) {
            this._writableStream.end();
        }
    };
    NodeV8Protocol.prototype.command = function (command, args, cb) {
        this._command(command, args, NodeV8Protocol.TIMEOUT, cb);
    };
    NodeV8Protocol.prototype.command2 = function (command, args, timeout) {
        var _this = this;
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return new Promise(function (resolve, reject) {
            _this._command(command, args, timeout, function (response) {
                if (response.success) {
                    resolve(response);
                }
                else {
                    if (!response.command) {
                        // some responses don't have the 'command' attribute.
                        response.command = command;
                    }
                    reject(response);
                }
            });
        });
    };
    NodeV8Protocol.prototype.backtrace = function (args, timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('backtrace', args);
    };
    NodeV8Protocol.prototype.restartFrame = function (args, timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('restartframe', args);
    };
    NodeV8Protocol.prototype.evaluate = function (args, timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('evaluate', args);
    };
    NodeV8Protocol.prototype.scripts = function (args, timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('scripts', args);
    };
    NodeV8Protocol.prototype.setVariableValue = function (args, timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('setvariablevalue', args);
    };
    NodeV8Protocol.prototype.frame = function (args, timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('frame', args);
    };
    NodeV8Protocol.prototype.setBreakpoint = function (args, timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('setbreakpoint', args);
    };
    NodeV8Protocol.prototype.setExceptionBreak = function (args, timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('setexceptionbreak', args);
    };
    NodeV8Protocol.prototype.clearBreakpoint = function (args, timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('clearbreakpoint', args);
    };
    NodeV8Protocol.prototype.listBreakpoints = function (timeout) {
        if (timeout === void 0) { timeout = NodeV8Protocol.TIMEOUT; }
        return this.command2('listbreakpoints');
    };
    NodeV8Protocol.prototype.sendEvent = function (event) {
        this.send('event', event);
    };
    NodeV8Protocol.prototype.sendResponse = function (response) {
        if (response.seq > 0) {
            // console.error('attempt to send more than one response for command {0}', response.command);
        }
        else {
            this.send('response', response);
        }
    };
    // ---- private ------------------------------------------------------------
    NodeV8Protocol.prototype._command = function (command, args, timeout, cb) {
        var _this = this;
        var request = {
            command: command
        };
        if (args && Object.keys(args).length > 0) {
            request.arguments = args;
        }
        if (!this._writableStream) {
            if (cb) {
                cb(new NodeV8Response(request, localize(0, null)));
            }
            return;
        }
        if (this._unresponsiveMode) {
            if (cb) {
                cb(new NodeV8Response(request, localize(1, null)));
            }
            return;
        }
        this.send('request', request);
        if (cb) {
            this._pendingRequests.set(request.seq, cb);
            var timer_1 = setTimeout(function () {
                clearTimeout(timer_1);
                var clb = _this._pendingRequests.get(request.seq);
                if (clb) {
                    _this._pendingRequests.delete(request.seq);
                    clb(new NodeV8Response(request, localize(2, null, timeout)));
                    _this._unresponsiveMode = true;
                    _this.emitEvent(new NodeV8Event('diagnostic', { reason: "request '" + command + "' timed out'" }));
                }
            }, timeout);
        }
    };
    NodeV8Protocol.prototype.emitEvent = function (event) {
        this.emit(event.event, event);
    };
    NodeV8Protocol.prototype.send = function (typ, message) {
        message.type = typ;
        message.seq = this._sequence++;
        var json = JSON.stringify(message);
        var data = 'Content-Length: ' + Buffer.byteLength(json, 'utf8') + '\r\n\r\n' + json;
        if (this._writableStream) {
            this._writableStream.write(data);
        }
    };
    NodeV8Protocol.prototype.internalDispatch = function (message) {
        switch (message.type) {
            case 'event':
                var e = message;
                this.emitEvent(e);
                break;
            case 'response':
                if (this._unresponsiveMode) {
                    this._unresponsiveMode = false;
                    this.emitEvent(new NodeV8Event('diagnostic', { reason: 'responsive' }));
                }
                var response = message;
                var clb = this._pendingRequests.get(response.request_seq);
                if (clb) {
                    this._pendingRequests.delete(response.request_seq);
                    if (this._responseHook) {
                        this._responseHook(response);
                    }
                    clb(response);
                }
                break;
            default:
                break;
        }
    };
    NodeV8Protocol.prototype.execute = function (data) {
        this._rawData = this._rawData ? Buffer.concat([this._rawData, data]) : data;
        while (true) {
            if (this._contentLength >= 0) {
                if (this._rawData.length >= this._contentLength) {
                    var message = this._rawData.toString('utf8', 0, this._contentLength);
                    this._rawData = this._rawData.slice(this._contentLength);
                    this._contentLength = -1;
                    if (message.length > 0) {
                        try {
                            this.internalDispatch(JSON.parse(message));
                        }
                        catch (e) {
                        }
                    }
                    continue; // there may be more complete messages to process
                }
            }
            else {
                var idx = this._rawData.indexOf(NodeV8Protocol.TWO_CRLF);
                if (idx !== -1) {
                    var header = this._rawData.toString('utf8', 0, idx);
                    var lines = header.split('\r\n');
                    for (var i = 0; i < lines.length; i++) {
                        var pair = lines[i].split(/: +/);
                        switch (pair[0]) {
                            case 'V8-Version':
                                var match0 = pair[1].match(/(\d+(?:\.\d+)+)/);
                                if (match0 && match0.length === 2) {
                                    this.v8Version = match0[1];
                                }
                                break;
                            case 'Embedding-Host':
                                var match = pair[1].match(/node\sv(\d+)\.(\d+)\.(\d+)/);
                                if (match && match.length === 4) {
                                    this.embeddedHostVersion = (parseInt(match[1]) * 100 + parseInt(match[2])) * 100 + parseInt(match[3]);
                                }
                                else if (pair[1] === 'Electron') {
                                    this.embeddedHostVersion = 60500; // TODO this needs to be detected in a smarter way by looking at the V8 version in Electron
                                }
                                var match1 = pair[1].match(/node\s(v\d+\.\d+\.\d+)/);
                                if (match1 && match1.length === 2) {
                                    this.hostVersion = match1[1];
                                }
                                break;
                            case 'Content-Length':
                                this._contentLength = +pair[1];
                                break;
                        }
                    }
                    this._rawData = this._rawData.slice(idx + NodeV8Protocol.TWO_CRLF.length);
                    continue; // try to handle a complete message
                }
            }
            break;
        }
    };
    return NodeV8Protocol;
}(EE.EventEmitter));
NodeV8Protocol.TIMEOUT = 10000;
NodeV8Protocol.TWO_CRLF = '\r\n\r\n';
exports.NodeV8Protocol = NodeV8Protocol;

//# sourceMappingURL=../../out/node/nodeV8Protocol.js.map
