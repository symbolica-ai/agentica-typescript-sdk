import { createConsolaLogger, shortenPath } from '@logging/index';
import * as ts from 'typescript';

import { AgenticCodeInjector } from './codegen/context-gen';
import { type AgenticFunSite, collectAgenticFunSites, generateContextAtAgenticSite } from './processor/processor';
import { AGENTIC_TRANSFORMATION_NAME, CALL_TRANSFORMATION_NAME, SPAWN_TRANSFORMATION_NAME } from './transformer-config';
import {
    CodeGenPaylod,
    addAgenticTransformationImport,
    isAgenticFunCall,
    isCallMethod,
    isSpawnFunCall,
    wrapTransformationSite,
} from './transformer-utils';

/**
 * Main transformer entry point
 * Note: Transformer runs at build-time, so we use createConsolaLogger (never OTel)
 */
function agenticFunTransformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
    const checker = program.getTypeChecker();
    const logger = createConsolaLogger('transformer');
    const span = logger.startSpan('agenticFunTransformer');

    try {
        // Collect agentic sites
        const agenticSites: AgenticFunSite[] = collectAgenticFunSites(program);
        logger.debug(`Collected ${agenticSites.length} agentic sites`);
        span.setAttribute('agentic_sites_count', agenticSites.length);

        // Traverse each agentic site to generate context
        const agenticSiteContexts = agenticSites.map((site) => generateContextAtAgenticSite(checker, program, site));

        // Return the transformation factory
        return (ctx: ts.TransformationContext) => {
            const factory = ctx.factory;
            const agenticCodeInjector = new AgenticCodeInjector(factory, program);

            return (sourceFile: ts.SourceFile) => {
                const fileLogger = logger.withScope('file');
                const fileName = sourceFile.fileName;

                const sitesInFile = agenticSites.filter((s) => s.sourceFile.fileName === sourceFile.fileName);
                fileLogger.debug(`Processing ${shortenPath(fileName)}: ${sitesInFile.length} agentic site(s)`);
                if (!sitesInFile.length) return sourceFile;

                sourceFile = addAgenticTransformationImport(factory, sourceFile);

                const siteCodeByPos = new Map<number, CodeGenPaylod>();

                // Codegen per agentic site
                for (const site of sitesInFile) {
                    const siteIdx = agenticSites.indexOf(site);
                    const siteContext = agenticSiteContexts[siteIdx];

                    // Generate context code (spawn may have empty context if no scope provided)
                    const agenticCode = agenticCodeInjector.generatePerSiteAgenticCode(
                        sourceFile,
                        '__AGENTIC_CONTEXT__',
                        siteContext.context,
                        false,
                        site.id
                    );

                    fileLogger.debug(
                        `Injecting ${agenticCode.contextDecl ? 'context' : 'empty context'}${agenticCode.needsAsync ? ' with dynamic imports' : ''} for site ${site.id}`
                    );
                    siteCodeByPos.set(site.call.pos, {
                        contextDecl: agenticCode.contextDecl,
                        dynamicImports: agenticCode.dynamicImports,
                        needsAsync: agenticCode.needsAsync,
                        siteId: site.id,
                        siteOutputType: siteContext.siteOutputType,
                        docString: site.docString,
                        promptTemplate: siteContext.promptTemplate,
                    });
                }

                if (siteCodeByPos.size === 0) return sourceFile;

                let transformedCalls = 0;
                const visitor = (node: ts.Node): ts.Node => {
                    if (isAgenticFunCall(node)) {
                        const code = siteCodeByPos.get(node.pos);
                        if (code) {
                            transformedCalls++;
                            return wrapTransformationSite({
                                factory,
                                call: node,
                                code: code,
                                functionName: AGENTIC_TRANSFORMATION_NAME,
                            });
                        }
                    } else if (isSpawnFunCall(node)) {
                        const code = siteCodeByPos.get(node.pos);
                        if (code) {
                            transformedCalls++;
                            return wrapTransformationSite({
                                factory,
                                call: node,
                                code: code,
                                functionName: SPAWN_TRANSFORMATION_NAME,
                            });
                        }
                    } else if (isCallMethod(node, checker)) {
                        const code = siteCodeByPos.get(node.pos);
                        if (code) {
                            transformedCalls++;
                            return wrapTransformationSite({
                                factory,
                                call: node,
                                code: code,
                                functionName: CALL_TRANSFORMATION_NAME,
                            });
                        }
                    }
                    return ts.visitEachChild(node, visitor, ctx);
                };

                const updated = ts.visitEachChild(sourceFile, visitor, ctx);
                fileLogger.debug(`Transformed ${transformedCalls} agentica call(s) in ${shortenPath(fileName)}`);
                return updated;
            };
        };
    } finally {
        span.end();
    }
}

export default agenticFunTransformer;
