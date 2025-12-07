import { createConsolaLogger, shortenPath } from '@logging/index';
import * as ts from 'typescript';

import { MagicCodeInjector } from './codegen/context-gen';
import { type MagicFunSite, collectMagicFunSites, generateContextAtMagicSite } from './processor/processor';
import { CALL_TRANSFORMATION_NAME, MAGIC_TRANSFORMATION_NAME, SPAWN_TRANSFORMATION_NAME } from './transformer-config';
import {
    CodeGenPaylod,
    addMagicTransformationImport,
    isCallMethod,
    isMagicFunCall,
    isSpawnFunCall,
    wrapTransformationSite,
} from './transformer-utils';

/**
 * Main transformer entry point
 * Note: Transformer runs at build-time, so we use createConsolaLogger (never OTel)
 */
function magicFunTransformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
    const checker = program.getTypeChecker();
    const logger = createConsolaLogger('transformer');
    const span = logger.startSpan('magicFunTransformer');

    try {
        // Collect magic sites
        const magicSites: MagicFunSite[] = collectMagicFunSites(program);
        logger.debug(`Collected ${magicSites.length} magic sites`);
        span.setAttribute('magic_sites_count', magicSites.length);

        // Traverse each magic site to generate context
        const magicSiteContexts = magicSites.map((site) => generateContextAtMagicSite(checker, program, site));

        // Return the transformation factory
        return (ctx: ts.TransformationContext) => {
            const factory = ctx.factory;
            const magicCodeInjector = new MagicCodeInjector(factory, program);

            return (sourceFile: ts.SourceFile) => {
                const fileLogger = logger.withScope('file');
                const fileName = sourceFile.fileName;

                const sitesInFile = magicSites.filter((s) => s.sourceFile.fileName === sourceFile.fileName);
                fileLogger.debug(`Processing ${shortenPath(fileName)}: ${sitesInFile.length} magic site(s)`);
                if (!sitesInFile.length) return sourceFile;

                sourceFile = addMagicTransformationImport(factory, sourceFile);

                const siteCodeByPos = new Map<number, CodeGenPaylod>();

                // Codegen per magic site
                for (const site of sitesInFile) {
                    const siteIdx = magicSites.indexOf(site);
                    const siteContext = magicSiteContexts[siteIdx];

                    // Generate context code (spawn may have empty context if no scope provided)
                    const magicCode = magicCodeInjector.generatePerSiteMagicCode(
                        sourceFile,
                        '__MAGIC_CONTEXT__',
                        siteContext.context,
                        false,
                        site.id
                    );

                    fileLogger.debug(
                        `Injecting ${magicCode.contextDecl ? 'context' : 'empty context'}${magicCode.needsAsync ? ' with dynamic imports' : ''} for site ${site.id}`
                    );
                    siteCodeByPos.set(site.call.pos, {
                        contextDecl: magicCode.contextDecl,
                        dynamicImports: magicCode.dynamicImports,
                        needsAsync: magicCode.needsAsync,
                        siteId: site.id,
                        siteOutputType: siteContext.siteOutputType,
                        docString: site.docString,
                        promptTemplate: siteContext.promptTemplate,
                    });
                }

                if (siteCodeByPos.size === 0) return sourceFile;

                let transformedCalls = 0;
                const visitor = (node: ts.Node): ts.Node => {
                    if (isMagicFunCall(node)) {
                        const code = siteCodeByPos.get(node.pos);
                        if (code) {
                            transformedCalls++;
                            return wrapTransformationSite({
                                factory,
                                call: node,
                                code: code,
                                functionName: MAGIC_TRANSFORMATION_NAME,
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

export default magicFunTransformer;
