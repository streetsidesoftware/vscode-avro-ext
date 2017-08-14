"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const nls = require("vscode-nls");
const localize = nls.config(process.env.VSCODE_NLS_CONFIG)();
function runtimeNotFound(_runtime) {
    return {
        id: 2001,
        format: localize('VSND2001', "Cannot find runtime '{0}' on PATH.", '{_runtime}'),
        variables: { _runtime }
    };
}
exports.runtimeNotFound = runtimeNotFound;
function cannotLaunchInTerminal(_error) {
    return {
        id: 2011,
        format: localize('VSND2011', "Cannot launch debug target in terminal ({0}).", '{_error}'),
        variables: { _error }
    };
}
exports.cannotLaunchInTerminal = cannotLaunchInTerminal;
function cannotLaunchDebugTarget(_error) {
    return {
        id: 2017,
        format: localize('VSND2017', "Cannot launch debug target ({0}).", '{_error}'),
        variables: { _error },
        showUser: true,
        sendTelemetry: true
    };
}
exports.cannotLaunchDebugTarget = cannotLaunchDebugTarget;
function unknownConsoleType(consoleType) {
    return {
        id: 2028,
        format: localize('VSND2028', "Unknown console type '{0}'.", consoleType)
    };
}
exports.unknownConsoleType = unknownConsoleType;
function cannotLaunchBecauseSourceMaps(programPath) {
    return {
        id: 2002,
        format: localize('VSND2002', "Cannot launch program '{0}'; configuring source maps might help.", '{path}'),
        variables: { path: programPath }
    };
}
exports.cannotLaunchBecauseSourceMaps = cannotLaunchBecauseSourceMaps;
function cannotLaunchBecauseOutFiles(programPath) {
    return {
        id: 2003,
        format: localize('VSND2003', "Cannot launch program '{0}'; setting the '{1}' attribute might help.", '{path}', 'outDir or outFiles'),
        variables: { path: programPath }
    };
}
exports.cannotLaunchBecauseOutFiles = cannotLaunchBecauseOutFiles;
function cannotLoadEnvVarsFromFile(error) {
    return {
        id: 2029,
        format: localize('VSND2029', "Can't load environment variables from file ({0}).", '{_error}'),
        variables: { _error: error }
    };
}
exports.cannotLoadEnvVarsFromFile = cannotLoadEnvVarsFromFile;

//# sourceMappingURL=errors.js.map
