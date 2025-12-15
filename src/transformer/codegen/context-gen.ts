import * as fs from 'fs';
import * as path from 'path';

import { type ScopedLogger, createConsolaLogger } from '@logging/index';
import { type ConceptContext, type ProcessedRecord, findProjectRoot } from '@transformer/processor/processor-utils';
import { DefnUID } from '@warpc/msg-protocol/kinds';
import * as ts from 'typescript';

type AgenticCode = {
    contextDecl: ts.VariableStatement;
    dynamicImports: ts.Statement[];
    needsAsync: boolean;
};

type ExportInfo = {
    exportedName: string;
    isTypeOnly: boolean;
};

type PackageExportsMap = Map<string, string>; // fileSubpath -> exportPath

export class AgenticCodeInjector {
    private logger: ScopedLogger;
    private projectRoots: Map<string, string> = new Map();
    private moduleToExportInfoCache: Map<string, Map<string, ExportInfo>> = new Map();
    private packageExportsCache: Map<string, PackageExportsMap | null> = new Map(); // packageDir -> exports map

    constructor(
        private factory: ts.NodeFactory,
        private program?: ts.Program
    ) {
        this.logger = createConsolaLogger('codegen');
    }

    /**
     * Generate a magic code for a specific magicFun site.
     */
    generatePerSiteAgenticCode(
        sourceFile: ts.SourceFile,
        varName: string,
        context: ConceptContext,
        exported: boolean = false,
        siteId: number
    ): AgenticCode {
        const siteLogger = this.logger.withScope(`site-${siteId}`);
        siteLogger.debug(`Generating context for ${context.size} entries`);

        const importInfo = this.buildCrossFileImportInfo(sourceFile, context, siteId);
        const declaration = this.createAgenticContext(varName, context, importInfo, exported);
        const dynamicImports = this.generateDynamicImports(importInfo);

        return {
            contextDecl: declaration,
            dynamicImports,
            needsAsync: dynamicImports.length > 0,
        };
    }

    private buildCrossFileImportInfo(
        sourceFile: ts.SourceFile,
        context: ConceptContext,
        siteId: number
    ): Map<DefnUID, { alias: string; moduleSpecifier: string; exportName: string }> {
        const importInfo = new Map<DefnUID, { alias: string; moduleSpecifier: string; exportName: string }>();

        const resolvedSourceFileName = path.resolve(sourceFile.fileName);
        let projectRoot = this.projectRoots.get(resolvedSourceFileName);
        if (projectRoot === undefined) {
            projectRoot = findProjectRoot(resolvedSourceFileName, { preferPackageJson: true });
            this.projectRoots.set(resolvedSourceFileName, projectRoot);
        }

        for (const [uid, resource] of context) {
            // Exclude system types
            if (!resource.importModule) continue;

            // Exclude same-file transitive types
            if (path.resolve(resource.importModule) === resolvedSourceFileName) {
                continue;
            }

            // Exclude non-resource types
            const kind = (resource.defMsg as any)?.kind;
            if (kind !== 'cls' && kind !== 'func' && kind !== 'obj') {
                continue;
            }

            // Exclude @types/* packages - runtime environment dependent
            // User should explicitly import if needed for their target runtime
            if (resource.declarationOnly) {
                continue;
            }

            // Regular library with co-located types
            const moduleSpecifier = this.computeModuleSpecifier(
                resolvedSourceFileName,
                resource.importModule,
                projectRoot
            );

            // Resolve export info (handles renaming and type-only exports)
            const exportInfo = this.resolveExportInfo(resource.importModule, resource.defName);

            // Skip type-only exports (no runtime value available)
            if (exportInfo.isTypeOnly) {
                continue;
            }

            // Skip if already imported at the top of the file
            if (this.isAlreadyImported(sourceFile, resource.defName, moduleSpecifier)) {
                continue;
            }

            const alias = `__import_${resource.defName}_f${siteId}r${uid.resource}`;
            const exportName = exportInfo.exportedName;

            importInfo.set(uid, { alias, moduleSpecifier, exportName });
        }

        return importInfo;
    }

    private resolveExportInfo(modulePath: string, defName: string): ExportInfo {
        if (!this.program) return { exportedName: defName, isTypeOnly: false };

        const moduleCache = this.moduleToExportInfoCache.get(modulePath);
        if (moduleCache?.has(defName)) {
            return moduleCache.get(defName)!;
        }

        const sourceFile = this.program.getSourceFile(modulePath);
        if (!sourceFile) return { exportedName: defName, isTypeOnly: false };

        const exportMap = new Map<string, ExportInfo>();

        for (const stmt of sourceFile.statements) {
            if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
                const isTypeOnly = stmt.isTypeOnly;
                for (const element of stmt.exportClause.elements) {
                    const originalName = (element.propertyName || element.name).text;
                    const exportedName = element.name.text;
                    const elementIsTypeOnly = element.isTypeOnly || isTypeOnly;
                    exportMap.set(originalName, { exportedName, isTypeOnly: elementIsTypeOnly });
                }
            }
        }

        this.moduleToExportInfoCache.set(modulePath, exportMap);
        return exportMap.get(defName) || { exportedName: defName, isTypeOnly: false };
    }

    private isAlreadyImported(sourceFile: ts.SourceFile, symbolName: string, moduleSpecifier: string): boolean {
        const sourceDir = path.dirname(sourceFile.fileName);

        for (const stmt of sourceFile.statements) {
            if (!ts.isImportDeclaration(stmt)) continue;

            const clause = stmt.importClause;
            if (!clause || !clause.namedBindings) continue;
            if (!ts.isNamedImports(clause.namedBindings)) continue;

            // Check if the symbol is imported
            const hasSymbol = clause.namedBindings.elements.some((e) => e.name.text === symbolName);
            if (!hasSymbol) continue;

            // Check if it's from the same module
            const mod = stmt.moduleSpecifier;
            if (ts.isStringLiteral(mod)) {
                const importedFrom = mod.text;

                // For package imports (don't start with . or /), compare directly
                if (!importedFrom.startsWith('.') && !importedFrom.startsWith('/')) {
                    if (importedFrom === moduleSpecifier) {
                        return true;
                    }
                } else {
                    // For relative imports, normalize and compare
                    const normalizedImport = this.normImportPath(sourceDir, importedFrom);
                    const normalizedTarget = this.normImportPath(sourceDir, moduleSpecifier);

                    if (normalizedImport === normalizedTarget) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private normImportPath(baseDir: string, importPath: string): string {
        const resolved = path.resolve(baseDir, importPath);
        return path.normalize(resolved);
    }

    private computeModuleSpecifier(currentFile: string, targetFile: string, projectRoot: string): string {
        // Heuristic approach for module specifier resolution
        const dependencyDirs = ['node_modules', '.deno', '.bun'];
        const relativePath = path.relative(projectRoot, targetFile);
        const inDependencyDir =
            !relativePath.startsWith('..') &&
            dependencyDirs.some((dir) => relativePath.startsWith(`${dir}${path.sep}`));

        // Option 1: target file is in a dependency directory
        if (inDependencyDir) {
            // For packages, use full subpath to access actual implementation files
            return this.extractPackageNameWithSubpath(targetFile);
        }

        // Option 2: target file is not in a dependency directory
        const targetResolved = path.resolve(targetFile);
        const projectResolved = path.resolve(projectRoot);

        if (!targetResolved.startsWith(projectResolved)) {
            return this.extractPackageName(targetFile);
        }

        let rel = path.relative(path.dirname(currentFile), targetFile);
        rel = rel.split(path.sep).join(path.posix.sep);
        let spec = rel.replace(/\.(mts|cts|ts|tsx|jsx?)$/i, '.js');
        if (!spec.startsWith('.') && !spec.startsWith('/')) {
            spec = `./${spec}`;
        }
        return spec;
    }

    private extractPackageName(filePath: string): string {
        const dependencyMarkers = ['node_modules', '.deno', '.bun'];

        for (const marker of dependencyMarkers) {
            const markerPath = `${path.sep}${marker}${path.sep}`;
            if (filePath.includes(markerPath)) {
                const index = filePath.lastIndexOf(markerPath);
                const afterMarker = filePath.substring(index + markerPath.length);
                const parts = afterMarker.split(path.sep);

                if (parts[0].startsWith('@')) {
                    // Scoped package: @scope/package/subpath -> @scope/package
                    return `${parts[0]}/${parts[1]}`;
                }
                // Regular package: package/subpath -> package
                return parts[0];
            }
        }

        return filePath.split(path.sep).pop() || filePath;
    }

    private extractPackageNameWithSubpath(filePath: string): string {
        const dependencyMarkers = ['node_modules', '.deno', '.bun'];

        for (const marker of dependencyMarkers) {
            const markerPath = `${path.sep}${marker}${path.sep}`;
            if (filePath.includes(markerPath)) {
                const index = filePath.lastIndexOf(markerPath);
                const afterMarker = filePath.substring(index + markerPath.length);
                const parts = afterMarker.split(path.sep);

                let packageName: string;
                let subpathStartIndex: number;

                if (parts[0].startsWith('@')) {
                    // Scoped package: @scope/package
                    packageName = `${parts[0]}/${parts[1]}`;
                    subpathStartIndex = 2;
                } else {
                    // Regular package
                    packageName = parts[0];
                    subpathStartIndex = 1;
                }

                // Try to resolve via package.json exports first
                const packageDir =
                    filePath.substring(0, index + markerPath.length) + parts.slice(0, subpathStartIndex).join(path.sep);
                const fileSubpath = parts.slice(subpathStartIndex).join('/');

                if (fileSubpath) {
                    const exportPath = this.resolveExportPath(packageDir, fileSubpath);
                    if (exportPath) {
                        return `${packageName}/${exportPath}`;
                    }

                    // Fallback: use raw subpath (original behavior)
                    const cleanSubpath = fileSubpath.replace(/\.d\.ts$/, '');
                    return `${packageName}/${cleanSubpath}`;
                }
                return packageName;
            }
        }

        return filePath.split(path.sep).pop() || filePath;
    }

    /**
     * Resolve a file subpath to its public export path using package.json exports.
     * Returns the export path (without leading './') if found, or undefined.
     */
    private resolveExportPath(packageDir: string, fileSubpath: string): string | undefined {
        const exportsMap = this.getPackageExports(packageDir);
        if (!exportsMap) return undefined;

        // Normalize the file subpath for matching
        // Remove .d.ts extension and try matching
        const normalizedSubpath = fileSubpath.replace(/\.d\.ts$/, '');

        // Try exact match first
        if (exportsMap.has(normalizedSubpath)) {
            return exportsMap.get(normalizedSubpath);
        }

        // Try with .js extension
        if (exportsMap.has(`${normalizedSubpath}.js`)) {
            return exportsMap.get(`${normalizedSubpath}.js`);
        }

        return undefined;
    }

    /**
     * Read and parse package.json exports field, building a reverse map from file paths to export paths.
     * Returns a map of fileSubpath -> exportPath, or null if no exports field.
     */
    private getPackageExports(packageDir: string): PackageExportsMap | null {
        if (this.packageExportsCache.has(packageDir)) {
            return this.packageExportsCache.get(packageDir)!;
        }

        const packageJsonPath = path.join(packageDir, 'package.json');
        let exportsMap: PackageExportsMap | null = null;

        try {
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                if (packageJson.exports && typeof packageJson.exports === 'object') {
                    exportsMap = this.parseExportsField(packageJson.exports);
                }
            }
        } catch {
            // Ignore errors reading package.json
        }

        this.packageExportsCache.set(packageDir, exportsMap);
        return exportsMap;
    }

    /**
     * Parse the exports field and build a reverse map from file paths to export paths.
     * Handles both simple string exports and conditional exports objects.
     */
    private parseExportsField(exports: Record<string, unknown>): PackageExportsMap {
        const map: PackageExportsMap = new Map();

        for (const [exportPath, target] of Object.entries(exports)) {
            // Skip the main export "."
            if (exportPath === '.') continue;

            // Get the actual file path from the target
            const filePath = this.extractFilePathFromExportTarget(target);
            if (!filePath) continue;

            // Normalize: remove leading './' from both
            const normalizedExportPath = exportPath.replace(/^\.\//, '');
            const normalizedFilePath = filePath.replace(/^\.\//, '');

            map.set(normalizedFilePath, normalizedExportPath);
        }

        return map;
    }

    /**
     * Extract the actual file path from an export target.
     * Handles string targets and conditional exports objects.
     */
    private extractFilePathFromExportTarget(target: unknown): string | undefined {
        if (typeof target === 'string') {
            return target;
        }

        if (target && typeof target === 'object') {
            const obj = target as Record<string, unknown>;
            // Prefer 'default' for runtime, then 'import', then 'require'
            // Skip 'types' as those are .d.ts files
            if (typeof obj['default'] === 'string') return obj['default'];
            if (typeof obj['import'] === 'string') return obj['import'];
            if (typeof obj['require'] === 'string') return obj['require'];
        }

        return undefined;
    }

    private generateDynamicImports(
        importInfo: Map<DefnUID, { alias: string; moduleSpecifier: string; exportName: string }>
    ): ts.Statement[] {
        const importsByModule = new Map<string, Array<{ alias: string; exportName: string }>>();

        for (const [_uid, info] of importInfo) {
            const imports = importsByModule.get(info.moduleSpecifier) || [];
            imports.push({ alias: info.alias, exportName: info.exportName });
            importsByModule.set(info.moduleSpecifier, imports);
        }

        const statements: ts.Statement[] = [];
        for (const [moduleSpecifier, imports] of importsByModule) {
            const importBindings = this.factory.createObjectBindingPattern(
                imports.map(({ alias, exportName }) =>
                    this.factory.createBindingElement(undefined, exportName !== alias ? exportName : undefined, alias)
                )
            );

            const importDecl = this.factory.createVariableStatement(
                undefined,
                this.factory.createVariableDeclarationList(
                    [
                        this.factory.createVariableDeclaration(
                            importBindings,
                            undefined,
                            undefined,
                            this.factory.createAwaitExpression(
                                this.factory.createCallExpression(this.factory.createIdentifier('import'), undefined, [
                                    this.factory.createStringLiteral(moduleSpecifier),
                                ])
                            )
                        ),
                    ],
                    ts.NodeFlags.Const
                )
            );

            statements.push(importDecl);
        }

        return statements;
    }

    /*
     * ****** EXAMPLE ******
     * const __AGENTIC_CONTEXT__ = {
     *   // entries
     * }
     */
    private createAgenticContext(
        varName: string,
        context: ConceptContext,
        importInfo: Map<DefnUID, { alias: string; moduleSpecifier: string; exportName: string }>,
        exported: boolean = false
    ): ts.VariableStatement {
        const stmt = this.factory.createVariableStatement(
            exported ? [this.factory.createModifier(ts.SyntaxKind.ExportKeyword)] : undefined,
            this.factory.createVariableDeclarationList(
                [
                    this.factory.createVariableDeclaration(
                        varName,
                        undefined,
                        undefined,
                        this.createContextEntries(context, importInfo)
                    ),
                ],
                ts.NodeFlags.Const
            )
        );
        this.logger.debug(`Emitting context variable ${varName}`);
        return stmt;
    }

    /**
     * ****** EXAMPLE ******
     * {
     *   "127": {
     *     defName: "User",
     *     defMsg: "{...}",
     *     defGetter: get defGetter() {
     *       return fiddler;
     *     },
     *   },
     *  ...
     * }
     */
    private createContextEntries(
        context: ConceptContext,
        importInfo: Map<DefnUID, { alias: string; moduleSpecifier: string; exportName: string }>
    ): ts.ObjectLiteralExpression {
        const resProps: ts.PropertyAssignment[] = [];
        for (const [uid, resource] of context) {
            const uidAsString = `${uid.resource}`;
            const info = importInfo.get(uid);
            resProps.push(this.createContextEntry(uidAsString, resource, info));
        }
        return this.factory.createObjectLiteralExpression(resProps);
    }

    private createContextEntry(
        uidAsString: string,
        resource: ProcessedRecord,
        crossFileImportInfo?: { alias: string; moduleSpecifier: string; exportName: string }
    ): ts.PropertyAssignment {
        const defName = resource.defName;
        const defMsg = JSON.stringify(resource.defMsg);
        const props: ts.ObjectLiteralElementLike[] = [
            this.factory.createPropertyAssignment('defName', this.factory.createStringLiteral(defName)),
            this.factory.createPropertyAssignment('defMsg', this.factory.createStringLiteral(defMsg)),
        ];

        // Mark unsupported system types for debugging
        if (resource.systemInternalType) {
            props.push(this.factory.createPropertyAssignment('systemInternalType', this.factory.createTrue()));
        }

        // Mark runtime internal types (@types/* packages)
        if (resource.declarationOnly) {
            props.push(this.factory.createPropertyAssignment('declarationOnly', this.factory.createTrue()));
        }

        /*
        GETTER GENERATION RULE (Three Cases, "transitives" are concepts discovered during traversal)
        Case 1: Explicitly passed concept → use argument expressions (e.g., foo.bar from agentic({ foo.bar }))
        Case 2a: Same-file transitive concept → use accessorPath (e.g., Fiddler class in same file)
        Case 2b: Cross-file transitive concept → use accessorPath with import alias

        This excludes:
        - Transitives without accessor path (no way to access)
        - @types/* packages (runtime-environment-dependent, filtered)
        - Type-only exports (no runtime value available)
        - Standard library methods (no module, no agenticArgumentPath)

        Note: Explicitly passed concepts are always runtime values (TypeScript prevents passing types as values)
        */

        const isExplicitlyPassed = !!(resource.agenticArgumentExpr || resource.agenticArgumentPath?.length);

        if (isExplicitlyPassed) {
            // Case 1: Explicitly passed - always has runtime value
            const getterBodyExpr = resource.agenticArgumentExpr
                ? resource.agenticArgumentExpr
                : this.createLocalAccessorExpression(resource.agenticArgumentPath!);
            props.push(
                this.factory.createPropertyAssignment(this.factory.createIdentifier('defGetter'), getterBodyExpr)
            );
        } else {
            // Check if this transitive concept is a type-only export
            const isTypeOnlyExport =
                resource.importModule && this.resolveExportInfo(resource.importModule, resource.defName).isTypeOnly;

            if (isTypeOnlyExport) {
                // Type-only exports have no runtime value
                props.push(
                    this.factory.createPropertyAssignment(
                        this.factory.createIdentifier('defGetter'),
                        this.factory.createIdentifier('undefined')
                    )
                );
            } else {
                const isSameFileTransitive =
                    !crossFileImportInfo &&
                    !!resource.importModule &&
                    !!resource.accessorPath?.length &&
                    !resource.declarationOnly;
                const isCrossFileTransitive = !!crossFileImportInfo;

                const hasRuntimeAccess = isSameFileTransitive || isCrossFileTransitive;

                if (hasRuntimeAccess) {
                    let getterBodyExpr: ts.Expression | undefined;

                    if (isSameFileTransitive) {
                        // Case 2a: Same-file transitive - use accessor path
                        getterBodyExpr = this.createLocalAccessorExpression(resource.accessorPath!);
                    } else if (isCrossFileTransitive) {
                        // Case 2b: Cross-file transitive - use import alias + accessor path
                        const [_root, ...rest] = resource.accessorPath!;
                        if (rest.length) {
                            getterBodyExpr = this.createLocalAccessorExpression([crossFileImportInfo!.alias, ...rest]);
                        } else {
                            getterBodyExpr = this.factory.createIdentifier(crossFileImportInfo!.alias);
                        }
                    }

                    if (getterBodyExpr) {
                        props.push(
                            this.factory.createPropertyAssignment(
                                this.factory.createIdentifier('defGetter'),
                                getterBodyExpr
                            )
                        );
                    }
                }
            }
        }

        return this.factory.createPropertyAssignment(
            this.factory.createStringLiteral(uidAsString),
            this.factory.createObjectLiteralExpression(props)
        );
    }

    private isValidIdentifier(name: string): boolean {
        return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
    }

    private createLocalAccessorExpression(parts: string[]): ts.Expression {
        const [head, ...rest] = parts;
        let expr: ts.Expression = this.factory.createIdentifier(head);
        for (const p of rest) {
            expr = this.isValidIdentifier(p)
                ? this.factory.createPropertyAccessExpression(expr, this.factory.createIdentifier(p))
                : this.factory.createElementAccessExpression(expr, this.factory.createStringLiteral(p));
        }
        return expr;
    }
}
