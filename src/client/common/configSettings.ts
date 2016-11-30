'use strict';

import * as vscode from 'vscode';
import { SystemVariables } from './systemVariables';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as child_process from 'child_process';

export const IS_WINDOWS = /^win/.test(process.platform);

export interface IPythonSettings {
    pythonPath: string;
    jediPath: string;
    devOptions: string[];
    linting: ILintingSettings;
    formatting: IFormattingSettings;
    unitTest: IUnitTestSettings;
    autoComplete: IAutoCompeteSettings;
    terminal: ITerminalSettings;
    sortImports: ISortImportSettings;
    workspaceSymbols: IWorkspaceSymbolSettings;
}

export interface ISortImportSettings {
    args: string[];
}

export interface IUnitTestSettings {
    promptToConfigure: boolean;
    debugPort: number;
    nosetestsEnabled: boolean;
    nosetestPath: string;
    nosetestArgs: string[];
    pyTestEnabled: boolean;
    pyTestPath: string;
    pyTestArgs: string[];
    unittestEnabled: boolean;
    unittestArgs: string[];
    outputWindow: string;
}
export interface IPylintCategorySeverity {
    convention: vscode.DiagnosticSeverity;
    refactor: vscode.DiagnosticSeverity;
    warning: vscode.DiagnosticSeverity;
    error: vscode.DiagnosticSeverity;
    fatal: vscode.DiagnosticSeverity;
}
export interface ILintingSettings {
    enabled: boolean;
    ignorePatterns: string[];
    prospectorEnabled: boolean;
    prospectorArgs: string[];
    pylintEnabled: boolean;
    pylintArgs: string[];
    pep8Enabled: boolean;
    pep8Args: string[];
    pylamaEnabled: boolean;
    pylamaArgs: string[];
    flake8Enabled: boolean;
    flake8Args: string[];
    pydocstyleEnabled: boolean;
    pydocstyleArgs: string[];
    lintOnTextChange: boolean;
    lintOnSave: boolean;
    maxNumberOfProblems: number;
    pylintCategorySeverity: IPylintCategorySeverity;
    prospectorPath: string;
    pylintPath: string;
    pep8Path: string;
    pylamaPath: string;
    flake8Path: string;
    pydocstylePath: string;
    outputWindow: string;
    mypyEnabled: boolean;
    mypyArgs: string[];
    mypyPath: string;
}
export interface IFormattingSettings {
    provider: string;
    autopep8Path: string;
    autopep8Args: string[];
    yapfPath: string;
    yapfArgs: string[];
    formatOnSave: boolean;
    outputWindow: string;
}
export interface IAutoCompeteSettings {
    addBrackets: boolean;
    extraPaths: string[];
}
export interface IWorkspaceSymbolSettings {
    enabled: boolean;
    tagFilePath: string;
    rebuildOnStart: boolean;
    rebuildOnFileSave: boolean;
    ctagsPath: string;
    exclusionPatterns: string[];
}
export interface ITerminalSettings {
    executeInFileDir: boolean;
    launchArgs: string[];
}
export interface JupyterSettings {
    appendResults: boolean;
    defaultKernel: string;
    startupCode: string[];
}

const IS_TEST_EXECUTION = process.env['PYTHON_DONJAYAMANNE_TEST'] === '1';

export class PythonSettings extends EventEmitter implements IPythonSettings {
    private static pythonSettings: PythonSettings = new PythonSettings();
    private disposables: vscode.Disposable[] = [];
    constructor() {
        super();
        if (PythonSettings.pythonSettings) {
            throw new Error('Singleton class, Use getInstance method');
        }
        this.disposables.push(vscode.workspace.onDidChangeConfiguration(() => {
            this.initializeSettings();
        }));

        this.initializeSettings();
    }
    public static getInstance(): PythonSettings {
        return PythonSettings.pythonSettings;
    }
    private initializeSettings() {
        const systemVariables: SystemVariables = new SystemVariables();
        const workspaceRoot = (IS_TEST_EXECUTION || typeof vscode.workspace.rootPath !== 'string') ? __dirname : vscode.workspace.rootPath;
        let pythonSettings = vscode.workspace.getConfiguration('python');
        this.pythonPath = systemVariables.resolveAny(pythonSettings.get<string>('pythonPath'));
        this.pythonPath = getAbsolutePath(this.pythonPath, IS_TEST_EXECUTION ? __dirname : workspaceRoot);
        this.jediPath = systemVariables.resolveAny(pythonSettings.get<string>('jediPath'));
        if (typeof this.jediPath === 'string' && this.jediPath.length > 0) {
            this.jediPath = getAbsolutePath(this.jediPath, IS_TEST_EXECUTION ? __dirname : workspaceRoot);
        }
        else {
            this.jediPath = '';
        }
        this.devOptions = systemVariables.resolveAny(pythonSettings.get<any[]>('devOptions'));
        this.devOptions = Array.isArray(this.devOptions) ? this.devOptions : [];
        let lintingSettings = systemVariables.resolveAny(pythonSettings.get<ILintingSettings>('linting'));
        if (this.linting) {
            Object.assign<ILintingSettings, ILintingSettings>(this.linting, lintingSettings);
        }
        else {
            this.linting = lintingSettings;
        }
        let sortImportSettings = systemVariables.resolveAny(pythonSettings.get<ISortImportSettings>('sortImports'));
        if (this.sortImports) {
            Object.assign<ISortImportSettings, ISortImportSettings>(this.sortImports, sortImportSettings);
        }
        else {
            this.sortImports = sortImportSettings;
        }
        // Support for travis
        this.sortImports = this.sortImports ? this.sortImports : { args: [] };
        // Support for travis
        this.linting = this.linting ? this.linting : {
            enabled: false,
            ignorePatterns: [],
            flake8Args: [], flake8Enabled: false, flake8Path: 'flake',
            lintOnSave: false, lintOnTextChange: false, maxNumberOfProblems: 100,
            mypyArgs: [], mypyEnabled: false, mypyPath: 'mypy',
            outputWindow: 'python', pep8Args: [], pep8Enabled: false, pep8Path: 'pep8',
            pylamaArgs: [], pylamaEnabled: false, pylamaPath: 'pylama',
            prospectorArgs: [], prospectorEnabled: false, prospectorPath: 'prospector',
            pydocstyleArgs: [], pydocstyleEnabled: false, pydocstylePath: 'pydocstyle',
            pylintArgs: [], pylintEnabled: false, pylintPath: 'pylint',
            pylintCategorySeverity: {
                convention: vscode.DiagnosticSeverity.Hint,
                error: vscode.DiagnosticSeverity.Error,
                fatal: vscode.DiagnosticSeverity.Error,
                refactor: vscode.DiagnosticSeverity.Hint,
                warning: vscode.DiagnosticSeverity.Warning
            }
        };
        this.linting.pylintPath = getAbsolutePath(this.linting.pylintPath, workspaceRoot);
        this.linting.flake8Path = getAbsolutePath(this.linting.flake8Path, workspaceRoot);
        this.linting.pep8Path = getAbsolutePath(this.linting.pep8Path, workspaceRoot);
        this.linting.pylamaPath = getAbsolutePath(this.linting.pylamaPath, workspaceRoot);
        this.linting.prospectorPath = getAbsolutePath(this.linting.prospectorPath, workspaceRoot);
        this.linting.pydocstylePath = getAbsolutePath(this.linting.pydocstylePath, workspaceRoot);

        let formattingSettings = systemVariables.resolveAny(pythonSettings.get<IFormattingSettings>('formatting'));
        if (this.formatting) {
            Object.assign<IFormattingSettings, IFormattingSettings>(this.formatting, formattingSettings);
        }
        else {
            this.formatting = formattingSettings;
        }
        // Support for travis
        this.formatting = this.formatting ? this.formatting : {
            autopep8Args: [], autopep8Path: 'autopep8',
            outputWindow: 'python',
            provider: 'autopep8',
            yapfArgs: [], yapfPath: 'yapf',
            formatOnSave: false
        };
        this.formatting.autopep8Path = getAbsolutePath(this.formatting.autopep8Path, workspaceRoot);
        this.formatting.yapfPath = getAbsolutePath(this.formatting.yapfPath, workspaceRoot);

        let autoCompleteSettings = systemVariables.resolveAny(pythonSettings.get<IAutoCompeteSettings>('autoComplete'));
        if (this.autoComplete) {
            Object.assign<IAutoCompeteSettings, IAutoCompeteSettings>(this.autoComplete, autoCompleteSettings);
        }
        else {
            this.autoComplete = autoCompleteSettings;
        }
        // Support for travis
        this.autoComplete = this.autoComplete ? this.autoComplete : {
            extraPaths: [],
            addBrackets: false
        };

        let workspaceSymbolsSettings = systemVariables.resolveAny(pythonSettings.get<IWorkspaceSymbolSettings>('workspaceSymbols'));
        if (this.workspaceSymbols) {
            Object.assign<IWorkspaceSymbolSettings, IWorkspaceSymbolSettings>(this.workspaceSymbols, workspaceSymbolsSettings);
        }
        else {
            this.workspaceSymbols = workspaceSymbolsSettings;
        }
        // Support for travis
        this.workspaceSymbols = this.workspaceSymbols ? this.workspaceSymbols : {
            ctagsPath: 'ctags',
            enabled: true,
            exclusionPatterns: [],
            rebuildOnFileSave: true,
            rebuildOnStart: true,
            tagFilePath: path.join(workspaceRoot, "tags")
        };

        let unitTestSettings = systemVariables.resolveAny(pythonSettings.get<IUnitTestSettings>('unitTest'));
        if (this.unitTest) {
            Object.assign<IUnitTestSettings, IUnitTestSettings>(this.unitTest, unitTestSettings);
        }
        else {
            this.unitTest = unitTestSettings;
            if (IS_TEST_EXECUTION && !this.unitTest) {
                this.unitTest = { nosetestArgs: [], pyTestArgs: [], unittestArgs: [] } as IUnitTestSettings;
            }
        }

        // Support for travis
        this.unitTest = this.unitTest ? this.unitTest : {
            promptToConfigure: true,
            debugPort: 3000,
            nosetestArgs: [], nosetestPath: 'nosetest', nosetestsEnabled: false,
            outputWindow: 'python',
            pyTestArgs: [], pyTestEnabled: false, pyTestPath: 'pytest',
            unittestArgs: [], unittestEnabled: false
        };
        this.unitTest.pyTestPath = getAbsolutePath(this.unitTest.pyTestPath, workspaceRoot);
        this.unitTest.nosetestPath = getAbsolutePath(this.unitTest.nosetestPath, workspaceRoot);

        // Resolve any variables found in the test arguments
        this.unitTest.nosetestArgs = this.unitTest.nosetestArgs.map(arg => systemVariables.resolveAny(arg));
        this.unitTest.pyTestArgs = this.unitTest.pyTestArgs.map(arg => systemVariables.resolveAny(arg));
        this.unitTest.unittestArgs = this.unitTest.unittestArgs.map(arg => systemVariables.resolveAny(arg));

        let terminalSettings = systemVariables.resolveAny(pythonSettings.get<ITerminalSettings>('terminal'));
        if (this.terminal) {
            Object.assign<ITerminalSettings, ITerminalSettings>(this.terminal, terminalSettings);
        }
        else {
            this.terminal = terminalSettings;
            if (IS_TEST_EXECUTION && !this.terminal) {
                this.terminal = {} as ITerminalSettings;
            }
        }
        // Support for travis
        this.terminal = this.terminal ? this.terminal : {
            executeInFileDir: true,
            launchArgs: []
        };

        this.emit('change');
    }

    private _pythonPath: string;
    public get pythonPath(): string {
        return this._pythonPath;
    }
    public set pythonPath(value: string) {
        if (this._pythonPath === value) {
            return;
        }
        // Add support for specifying just the directory where the python executable will be located
        // E.g. virtual directory name
        try {
            this._pythonPath = getPythonExecutable(value);
        }
        catch (ex) {
            this._pythonPath = value;
        }
    }
    public jediPath: string;
    public devOptions: string[];
    public linting: ILintingSettings;
    public formatting: IFormattingSettings;
    public autoComplete: IAutoCompeteSettings;
    public unitTest: IUnitTestSettings;
    public terminal: ITerminalSettings;
    public sortImports: ISortImportSettings;
    public workspaceSymbols: IWorkspaceSymbolSettings;
}

function getAbsolutePath(pathToCheck: string, rootDir: string): string {
    if (IS_TEST_EXECUTION && !pathToCheck) { return rootDir; }
    if (pathToCheck.indexOf(path.sep) === -1) {
        return pathToCheck;
    }
    return path.isAbsolute(pathToCheck) ? pathToCheck : path.resolve(rootDir, pathToCheck);
}

function getPythonExecutable(pythonPath: string): string {
    // If only 'python'
    if (pythonPath === 'python' ||
        pythonPath.indexOf(path.sep) === -1 ||
        path.basename(pythonPath) === path.dirname(pythonPath)) {
        return pythonPath;
    }

    if (isValidPythonPath(pythonPath)) {
        return pythonPath;
    }

    // Suffix with 'python' for linux and 'osx', and 'python.exe' for 'windows'
    if (IS_WINDOWS) {
        if (isValidPythonPath(path.join(pythonPath, 'python.exe'))) {
            return path.join(pythonPath, 'python.exe');
        }
        if (isValidPythonPath(path.join(pythonPath, 'scripts', 'python.exe'))) {
            return path.join(pythonPath, 'scripts', 'python.exe');
        }
    }
    else {
        if (isValidPythonPath(path.join(pythonPath, 'python'))) {
            return path.join(pythonPath, 'python');
        }
        if (isValidPythonPath(path.join(pythonPath, 'bin', 'python'))) {
            return path.join(pythonPath, 'bin', 'python');
        }
    }

    return pythonPath;
}

function isValidPythonPath(pythonPath): boolean {
    try {
        let output = child_process.execFileSync(pythonPath, ['-c', 'print(1234)'], { encoding: 'utf8' });
        return output.startsWith('1234');
    }
    catch (ex) {
        return false;
    }
}