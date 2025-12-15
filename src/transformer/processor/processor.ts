import type { ConceptContext } from './processor-utils';

import { createConsolaLogger, shortenPath } from '@logging/index';
import { isAgenticFunCall, isCallMethod, isSpawnFunCall } from '@transformer/transformer-utils';
import { SchemaTraversal } from '@transformer/traverser/traverser';
import { DefMsg } from '@warpc/msg-protocol/concept/concept';
import * as ts from 'typescript';

import { type ClassTarget, processScannedClasses } from './class-targets';
import { type FunctionTarget, processScannedFunctions } from './function-targets';
import { type ObjectTarget, processScannedObjects } from './object-targets';
import {
    collectTargetsFromObjectLiteral,
    collectTargetsFromTemplateLiteral,
    extractDocstring,
    findProjectRoot,
    formatModulePath,
    replaceAliasedUids,
    resolveTraverseType,
    stripProjectRoot,
    upsertContextFromTraversalRecords,
} from './processor-utils';

/* Processor steps:
1. Collect magic fun sites
2. Generate context
*/

export type AgenticFunSite = {
    id: number;
    sourceFile: ts.SourceFile;
    lineNumber: number;
    call: ts.CallExpression;
    enclosingFunction?: ts.FunctionDeclaration;
    functionName?: string;
    docString?: string;
    siteType: 'agentic' | 'spawn' | 'call';
};

export function collectAgenticFunSites(program: ts.Program): AgenticFunSite[] {
    const logger = createConsolaLogger('collector');
    const checker = program.getTypeChecker();
    const sites: AgenticFunSite[] = [];
    let idCounter = 0;

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue;

        const visit = (node: ts.Node) => {
            if (isAgenticFunCall(node)) {
                const enclosingFn = findEnclosingFunction(node);
                const fnName = enclosingFn?.name?.text;
                const docString = enclosingFn ? extractDocstring(enclosingFn) : undefined;
                const fileName = shortenPath(sourceFile.fileName);
                const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                logger.info(`Found agentica call site #${idCounter} in ${fileName}:${lineNumber}`);
                sites.push({
                    id: idCounter++,
                    sourceFile,
                    lineNumber,
                    call: node,
                    enclosingFunction: enclosingFn,
                    functionName: fnName,
                    docString: docString,
                    siteType: 'agentic',
                });
            } else if (isSpawnFunCall(node)) {
                const enclosingFn = findEnclosingFunction(node);
                const fnName = enclosingFn?.name?.text;
                const docString = enclosingFn ? extractDocstring(enclosingFn) : undefined;
                const fileName = shortenPath(sourceFile.fileName);
                const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                logger.info(`Found agentica spawn site #${idCounter} in ${fileName}:${lineNumber}`);
                sites.push({
                    id: idCounter++,
                    sourceFile,
                    lineNumber,
                    call: node,
                    enclosingFunction: enclosingFn,
                    functionName: fnName,
                    docString: docString,
                    siteType: 'spawn',
                });
            } else if (isCallMethod(node, checker)) {
                const enclosingFn = findEnclosingFunction(node);
                const fnName = enclosingFn?.name?.text;
                const docString = enclosingFn ? extractDocstring(enclosingFn) : undefined;
                const fileName = shortenPath(sourceFile.fileName);
                const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                logger.info(`Found agentica call site #${idCounter} in ${fileName}:${lineNumber}`);
                sites.push({
                    id: idCounter++,
                    sourceFile,
                    lineNumber,
                    call: node,
                    enclosingFunction: enclosingFn,
                    functionName: fnName,
                    docString: docString,
                    siteType: 'call',
                });
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(sourceFile, visit);
    }

    logger.debug(`Collected ${sites.length} agentic sites across ${program.getSourceFiles().length} files`);
    return sites;
}

export type AgenticSiteContext = {
    context: ConceptContext;
    siteId: number;
    siteOutputType: DefMsg | undefined;
    promptTemplate?: ts.TemplateLiteral;
};

export function generateContextAtAgenticSite(
    checker: ts.TypeChecker,
    program: ts.Program,
    site: AgenticFunSite
): AgenticSiteContext {
    const logger = createConsolaLogger('processor').withScope(`site-${site.id}`);
    const span = logger.startSpan(`generateContextAtAgenticSite-${site.id}`);
    logger.setAttribute('site_id', site.id);
    logger.setAttribute('location', `${shortenPath(site.sourceFile.fileName)}:${site.lineNumber}`);

    try {
        const context: ConceptContext = new Map();
        const traversal = new SchemaTraversal(checker, program, logger);

        const functionTargets: FunctionTarget[] = [];
        const objectTargets: ObjectTarget[] = [];
        const classTargets: ClassTarget[] = [];
        let promptTemplate: ts.TemplateLiteral | undefined;

        // ** TARGET COLLECTION (PRO) **
        // Call types: agenticPro`text ${obj}`(config) or agent.callPro`text ${obj}`(config)
        if (ts.isCallExpression(site.call) && ts.isTaggedTemplateExpression(site.call.expression)) {
            const template = site.call.expression.template;
            promptTemplate = template;
            if (ts.isTemplateExpression(template)) {
                logger.debug('Collecting targets from tagged template literal (Pro)');
                const collected = collectTargetsFromTemplateLiteral(checker, site.call, template, logger);
                functionTargets.push(...collected.functionTargets);
                objectTargets.push(...collected.objectTargets);
                classTargets.push(...collected.classTargets);
            }
        }

        // ** TARGET COLLECTION (REGULAR) **
        // Call types: spawn(config, {scope}), magic("prompt", {scope}, config) or agent.call("prompt", {scope}, config)
        else if (ts.isCallExpression(site.call)) {
            const scopeArgIndex = site.siteType === 'spawn' ? 1 : 1; // Noop atm (Second arg for both)
            const scopeArg = site.call.arguments?.[scopeArgIndex];
            if (scopeArg && ts.isObjectLiteralExpression(scopeArg)) {
                logger.debug('Collecting targets from object literal (second argument)');
                const collected = collectTargetsFromObjectLiteral(checker, site.call, scopeArg, logger);
                functionTargets.push(...collected.functionTargets);
                objectTargets.push(...collected.objectTargets);
                classTargets.push(...collected.classTargets);
            }
        }

        // ** TYPE TRAVERSAL **
        // Process classes first so aliasing of class names (via explicit dict entries) takes precedence
        logger.debug(`Processing ${classTargets.length} scanned classes`);
        span.setAttribute('class_targets', classTargets.length);
        processScannedClasses(checker, classTargets, traversal);

        logger.debug(`Processing ${functionTargets.length} scanned functions`);
        span.setAttribute('function_targets', functionTargets.length);
        processScannedFunctions(checker, functionTargets, traversal);

        logger.debug(`Processing ${objectTargets.length} scanned objects`);
        span.setAttribute('object_targets', objectTargets.length);
        processScannedObjects(checker, objectTargets, traversal);

        // ** OUTPUT TYPE INFERENCE **
        // For spawn, skip the output type inference
        let outputRecord: ReturnType<typeof traversal.traverseTSType> | undefined;
        if (site.siteType !== 'spawn') {
            // Infer the narrowest type of the magic call expression and traverse it
            const traverseType = resolveTraverseType(checker, site.call as ts.CallExpression, logger, site.id);
            const typeString = checker.typeToString(traverseType);
            logger.debug(`Resolved output type: ${typeString}`);
            span.setAttribute('output_type', typeString);

            // If the call site has an explicit type argument (e.g., agentic<T>), pass it along
            let outputTypeNode: ts.TypeNode | undefined = undefined;
            if (ts.isCallExpression(site.call) && site.call.typeArguments && site.call.typeArguments.length > 0) {
                outputTypeNode = site.call.typeArguments[0];
            }
            outputRecord = traversal.traverseTSType(traverseType, false, outputTypeNode);
            // Mark the output type as top-level (it's explicitly specified in agentic<T>)
            outputRecord.__isTopLevel = true;
        }

        upsertContextFromTraversalRecords(traversal, context, program, logger);

        // Resolve UID aliases (type parameters that resolved to placeholders)
        if (traversal.uidAliases.size > 0) {
            logger.debug(`Resolving ${traversal.uidAliases.size} UID aliases`);

            // Replace all references to aliased UIDs in messages
            for (const [_, record] of context) {
                replaceAliasedUids(record.defMsg, traversal.uidAliases, logger);
            }

            logger.debug(`Replaced aliased UID references in ${context.size} entries`);
        }

        logger.debug(`Generated context with ${context.size} entries`);
        span.setAttribute('context_entries', context.size);

        // Post-processing:
        // - ensure system internal types never have is_top_level in payload
        // - strip the project path from the module fields
        const projectRoot = findProjectRoot(site.sourceFile.fileName);
        for (const record of context.values()) {
            if (record.systemInternalType && record.defMsg.payload) {
                if (record.defMsg.payload.is_top_level) {
                    logger.debug(`Removing is_top_level from system internal type ${record.defName}`);
                    record.defMsg.payload.is_top_level = false;
                }
            }
            if (record.defMsg.payload?.module) {
                const originalModule = record.defMsg.payload.module;
                record.defMsg.payload.module = stripProjectRoot(originalModule, projectRoot);
                if (originalModule !== record.defMsg.payload.module) {
                    logger.debug(`Stripped module path: ${originalModule} -> ${record.defMsg.payload.module}`);
                }
                record.defMsg.payload.module = formatModulePath(record.defMsg.payload.module);
            }
        }

        return {
            context,
            siteId: site.id,
            siteOutputType: outputRecord?.msg,
            promptTemplate,
        };
    } catch (error) {
        span.recordException(error as Error);
        logger.error(
            `[${logger.getAttribute('location')}] Failed to generate transformation for site ${site.id}. Cause:\n`,
            error as Error
        );
        throw error;
    } finally {
        span.end();
    }
}

function findEnclosingFunction(node: ts.Node): ts.FunctionDeclaration | undefined {
    let current: ts.Node | undefined = node;
    while (current) {
        if (ts.isFunctionDeclaration(current)) return current;
        current = current.parent;
    }
    return undefined;
}
