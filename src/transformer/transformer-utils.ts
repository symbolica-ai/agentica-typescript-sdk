import { DefMsg } from '@warpc/msg-protocol/concept/concept';
import * as ts from 'typescript';

import { CALL_TRANSFORMATION_NAME, MAGIC_TRANSFORMATION_NAME, SPAWN_TRANSFORMATION_NAME } from './transformer-config';

export function isMagicFunCall(node: ts.Node): node is ts.CallExpression {
    // Handle agenticPro`text`(config) ... always a call wrapping tagged template
    if (ts.isCallExpression(node) && ts.isTaggedTemplateExpression(node.expression)) {
        if (!ts.isIdentifier(node.expression.tag)) return false;
        const calleeName = node.expression.tag.text;
        if (calleeName !== 'agenticPro') return false;
        return checkMagicImport(node.getSourceFile(), calleeName, isMagicFnModule);
    }

    // Handle regular call: agentic("prompt", scope, config)
    if (ts.isCallExpression(node)) {
        if (!ts.isIdentifier(node.expression)) return false;
        const calleeName = node.expression.text;
        if (calleeName !== 'agentic') return false;
        return checkMagicImport(node.getSourceFile(), calleeName, isMagicFnModule);
    }

    return false;
}

function checkMagicImport(sf: ts.SourceFile, calleeName: string, moduleCheck: (spec: string) => boolean): boolean {
    for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt)) continue;
        const clause = stmt.importClause;
        if (!clause || !clause.namedBindings) continue;
        if (!ts.isNamedImports(clause.namedBindings)) continue;
        const hasName = clause.namedBindings.elements.some((e) => e.name.text === calleeName);
        if (!hasName) continue;
        const mod = stmt.moduleSpecifier;
        if (ts.isStringLiteral(mod)) {
            const spec = mod.text;
            if (moduleCheck(spec)) {
                return true;
            }
        }
    }
    return false;
}

export function isSpawnFunCall(node: ts.Node): node is ts.CallExpression {
    if (!ts.isCallExpression(node)) return false;
    if (!ts.isIdentifier(node.expression)) return false;
    const calleeName = node.expression.text;
    if (calleeName !== 'spawn') return false;
    const sf = node.getSourceFile();
    for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt)) continue;
        const clause = stmt.importClause;
        if (!clause || !clause.namedBindings) continue;
        if (!ts.isNamedImports(clause.namedBindings)) continue;
        const hasName = clause.namedBindings.elements.some((e) => e.name.text === calleeName);
        if (!hasName) continue;
        const mod = stmt.moduleSpecifier;
        if (ts.isStringLiteral(mod)) {
            const spec = mod.text;
            if (isMagicAgentModule(spec)) {
                return true;
            }
        }
    }
    return false;
}

export function isCallMethod(node: ts.Node, checker?: ts.TypeChecker): node is ts.CallExpression {
    // Handle agent.callPro`text`(config) - always a call wrapping tagged template
    if (ts.isCallExpression(node) && ts.isTaggedTemplateExpression(node.expression)) {
        if (!ts.isPropertyAccessExpression(node.expression.tag)) return false;
        if (!ts.isIdentifier(node.expression.tag.name)) return false;
        if (node.expression.tag.name.text !== 'callPro') return false;
        if (!checker) return true;
        return checkAgentReceiver(node.expression.tag.expression, checker);
    }

    // Handle regular call: agent.call("prompt", scope, config)
    if (ts.isCallExpression(node)) {
        if (!ts.isPropertyAccessExpression(node.expression)) return false;
        if (!ts.isIdentifier(node.expression.name)) return false;
        const methodName = node.expression.name.text;
        if (methodName !== 'call') return false;
        if (!checker) return true;
        const result = checkAgentReceiver(node.expression.expression, checker);
        return result;
    }

    return false;
}

function checkAgentReceiver(receiver: ts.Expression, checker: ts.TypeChecker): boolean {
    const receiverType = checker.getTypeAtLocation(receiver);

    const isAgentLike = (t: ts.Type): boolean => {
        const callSignatures = t.getCallSignatures();
        if (callSignatures.length > 0) {
            return false;
        }

        let symbol = t.getSymbol();
        if (!symbol) {
            return false;
        }
        if (symbol.flags & ts.SymbolFlags.Alias) {
            try {
                symbol = checker.getAliasedSymbol(symbol);
            } catch {
                // Ignore aliasing errors
            }
        }

        const symbolName = symbol.getName();
        if (symbolName !== 'Agent') {
            return false;
        }

        const declarations = symbol.declarations;
        if (!declarations || declarations.length === 0) {
            return false;
        }
        for (const decl of declarations) {
            const sourceFile = decl.getSourceFile();
            if (sourceFile && isMagicAgentModule(sourceFile.fileName)) {
                return true;
            }
        }
        return false;
    };

    // If the receiver is a union (e.g., Agent | null), accept if any member is Agent
    if (receiverType.flags & ts.TypeFlags.Union) {
        const unionType = receiverType as ts.UnionType;
        return unionType.types.some((t) => isAgentLike(t));
    }

    return isAgentLike(receiverType);
}

export function addMagicTransformationImport(factory: ts.NodeFactory, sourceFile: ts.SourceFile): ts.SourceFile {
    const visitor = (node: ts.Node): ts.Node => {
        if (ts.isImportDeclaration(node)) {
            const clause = node.importClause;
            if (!clause || !clause.namedBindings) return node;
            if (!ts.isNamedImports(clause.namedBindings)) return node;

            const hasMagic = clause.namedBindings.elements.some(
                (e) => e.name.text === 'agentic' || e.name.text === 'agenticPro' || e.name.text === 'spawn'
            );
            if (!hasMagic) return node;

            const mod = node.moduleSpecifier;
            if (ts.isStringLiteral(mod)) {
                const spec = mod.text;
                if (isMagicFnModule(spec) || isMagicAgentModule(spec)) {
                    const hasMagicTransformation = clause.namedBindings.elements.some(
                        (e) => e.name.text === MAGIC_TRANSFORMATION_NAME
                    );
                    const hasSpawnTransformation = clause.namedBindings.elements.some(
                        (e) => e.name.text === SPAWN_TRANSFORMATION_NAME
                    );

                    const newElements = [...clause.namedBindings.elements];

                    if (isMagicFnModule(spec) && !hasMagicTransformation) {
                        newElements.push(
                            factory.createImportSpecifier(
                                false,
                                undefined,
                                factory.createIdentifier(MAGIC_TRANSFORMATION_NAME)
                            )
                        );
                    }

                    if (isMagicAgentModule(spec) && !hasSpawnTransformation) {
                        newElements.push(
                            factory.createImportSpecifier(
                                false,
                                undefined,
                                factory.createIdentifier(SPAWN_TRANSFORMATION_NAME)
                            )
                        );
                    }

                    if (newElements.length > clause.namedBindings.elements.length) {
                        return factory.updateImportDeclaration(
                            node,
                            node.modifiers,
                            factory.updateImportClause(
                                clause,
                                clause.phaseModifier,
                                clause.name,
                                factory.createNamedImports(newElements)
                            ),
                            node.moduleSpecifier,
                            node.attributes
                        );
                    }
                }
            }
        }
        return node;
    };

    const updatedStatements = sourceFile.statements.map((stmt) => ts.visitNode(stmt, visitor) as ts.Statement);
    return factory.updateSourceFile(sourceFile, updatedStatements);
}

function isMagicFnModule(spec: string): boolean {
    return spec.includes('agentica/agentic') || spec.includes('symbolica/agentica');
}

function isMagicAgentModule(spec: string): boolean {
    // Must not match 'agentica/agentic' which contains 'agentica/agent' as substring
    return (
        spec.includes('agentica/agent.') ||
        spec.includes('agentica/agent"') ||
        spec.includes("agentica/agent'") ||
        spec.endsWith('agentica/agent') ||
        spec.includes('symbolica/agentica')
    );
}

export function isMagicLibraryModule(filePath: string): boolean {
    return isMagicFnModule(filePath) || isMagicAgentModule(filePath);
}

export function isMagicLibraryFunction(node: ts.Expression, sourceFile: ts.SourceFile): boolean {
    if (!ts.isIdentifier(node)) return false;
    const functionName = node.text;
    if (functionName !== 'spawn' && functionName !== 'agentic' && functionName !== 'agenticPro') return false;

    for (const stmt of sourceFile.statements) {
        if (!ts.isImportDeclaration(stmt)) continue;
        const clause = stmt.importClause;
        if (!clause || !clause.namedBindings) continue;
        if (!ts.isNamedImports(clause.namedBindings)) continue;
        const hasName = clause.namedBindings.elements.some((e) => e.name.text === functionName);
        if (!hasName) continue;
        const mod = stmt.moduleSpecifier;
        if (ts.isStringLiteral(mod)) {
            const spec = mod.text;
            if (isMagicFnModule(spec) || isMagicAgentModule(spec)) {
                return true;
            }
        }
    }
    return false;
}

export function isAgentCallMethodReference(node: ts.Expression, checker: ts.TypeChecker): boolean {
    if (!ts.isPropertyAccessExpression(node)) return false;
    if (!ts.isIdentifier(node.name)) return false;
    const methodName = node.name.text;
    if (methodName !== 'call' && methodName !== 'callPro') return false;
    return checkAgentReceiver(node.expression, checker);
}

export function createMagicIdDeclaration(factory: ts.NodeFactory, id: number): ts.VariableStatement {
    return factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
            [factory.createVariableDeclaration('__MAGIC_ID__', undefined, undefined, factory.createNumericLiteral(id))],
            ts.NodeFlags.Const
        )
    );
}

export function createMagicOutputDeclaration(factory: ts.NodeFactory, outputType: DefMsg): ts.VariableStatement {
    return factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
            [
                factory.createVariableDeclaration(
                    '__MAGIC_OUTPUT__',
                    undefined,
                    undefined,
                    factory.createStringLiteral(JSON.stringify(outputType))
                ),
            ],
            ts.NodeFlags.Const
        )
    );
}

function templateLiteralToString(template: ts.TemplateLiteral): string {
    if (ts.isNoSubstitutionTemplateLiteral(template)) {
        return template.text;
    }

    if (ts.isTemplateExpression(template)) {
        let result = template.head.text;
        for (const span of template.templateSpans) {
            const expr = span.expression;
            if (ts.isIdentifier(expr)) {
                result += expr.text;
            } else {
                result += '<expr>';
            }
            result += span.literal.text;
        }
        return result;
    }

    return '';
}

export function createMagicPromptDeclaration(
    factory: ts.NodeFactory,
    promptTemplate: ts.TemplateLiteral
): ts.VariableStatement {
    const promptString = templateLiteralToString(promptTemplate);
    return factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
            [
                factory.createVariableDeclaration(
                    '__MAGIC_PROMPT__',
                    undefined,
                    undefined,
                    factory.createStringLiteral(promptString)
                ),
            ],
            ts.NodeFlags.Const
        )
    );
}

export interface CodeGenPaylod {
    contextDecl: ts.Statement | undefined;
    dynamicImports: ts.Statement[];
    needsAsync: boolean;
    siteId: number;
    siteOutputType: DefMsg | undefined;
    docString?: string;
    promptTemplate?: ts.TemplateLiteral;
}

export interface WrapMagicCallOptions {
    factory: ts.NodeFactory;
    call: ts.CallExpression;
    code: CodeGenPaylod;
    functionName?: string;
}

interface ExtractedArguments {
    prompt: ts.Expression;
    config?: ts.Expression;
}

function extractArgumentsFromCall(
    factory: ts.NodeFactory,
    call: ts.CallExpression,
    _promptTemplate?: ts.TemplateLiteral
): ExtractedArguments {
    // Pro call with tagged template: agenticPro`text`(config) or agent.callPro`text`(config)
    if (ts.isTaggedTemplateExpression(call.expression)) {
        const config = call.arguments && call.arguments.length > 0 ? call.arguments[0] : undefined;
        return {
            prompt: factory.createIdentifier('__MAGIC_PROMPT__'),
            config,
        };
    }

    // Regular call: agentic("prompt", {scope}, {config}) or agent.call("prompt", {scope}, {config})
    if (call.arguments && call.arguments.length > 0) {
        const promptArg = call.arguments[0];
        const configArg = call.arguments.length > 2 ? call.arguments[2] : undefined;
        return {
            prompt: promptArg,
            config: configArg,
        };
    }

    return {
        prompt: factory.createStringLiteral(''),
    };
}

// Helper function to create context object for agentic/call transformations
function createMagicContextObject(factory: ts.NodeFactory, docString?: string): ts.ObjectLiteralExpression {
    return factory.createObjectLiteralExpression(
        [
            factory.createPropertyAssignment(
                factory.createIdentifier('concepts'),
                factory.createIdentifier('__MAGIC_CONTEXT__')
            ),
            factory.createPropertyAssignment(
                factory.createIdentifier('siteId'),
                factory.createIdentifier('__MAGIC_ID__')
            ),
            factory.createPropertyAssignment(
                factory.createIdentifier('siteOutputType'),
                factory.createIdentifier('__MAGIC_OUTPUT__')
            ),
            factory.createPropertyAssignment(
                factory.createIdentifier('docString'),
                docString ? factory.createStringLiteral(docString) : factory.createIdentifier('undefined')
            ),
        ],
        false
    );
}

// Helper function to build block statements in transformed inline function
function buildMagicStatements(
    factory: ts.NodeFactory,
    dynamicImports: ts.Statement[],
    contextDecl: ts.Statement | undefined,
    siteId: number,
    siteOutputType: DefMsg | undefined,
    promptTemplate: ts.TemplateLiteral | undefined,
    isSpawn: boolean,
    returnStatement: ts.ReturnStatement
): ts.Statement[] {
    const statements: ts.Statement[] = [...dynamicImports];

    if (contextDecl) {
        statements.push(contextDecl);
    }

    statements.push(createMagicIdDeclaration(factory, siteId));

    if (!isSpawn && siteOutputType) {
        statements.push(createMagicOutputDeclaration(factory, siteOutputType));
    }

    if (promptTemplate) {
        statements.push(createMagicPromptDeclaration(factory, promptTemplate));
    }

    statements.push(returnStatement);
    return statements;
}

export function wrapTransformationSite(options: WrapMagicCallOptions): ts.Expression {
    const { factory, call, code, functionName = MAGIC_TRANSFORMATION_NAME } = options;
    const { contextDecl, dynamicImports, needsAsync, siteId, siteOutputType, docString, promptTemplate } = code;

    const isSpawn = functionName === SPAWN_TRANSFORMATION_NAME;
    const isCall = functionName === CALL_TRANSFORMATION_NAME;

    let returnStatement: ts.ReturnStatement;

    if (isSpawn) {
        const { prompt } = extractArgumentsFromCall(factory, call as ts.CallExpression, promptTemplate);

        const contextProperties = [
            factory.createPropertyAssignment(
                factory.createIdentifier('siteId'),
                factory.createIdentifier('__MAGIC_ID__')
            ),
        ];

        // If contextDecl exists, add concepts to spawn context
        if (contextDecl) {
            contextProperties.push(
                factory.createPropertyAssignment(
                    factory.createIdentifier('concepts'),
                    factory.createIdentifier('__MAGIC_CONTEXT__')
                )
            );
        }

        const contextArg = factory.createObjectLiteralExpression(contextProperties, false);

        const updatedCall = factory.updateCallExpression(
            call as ts.CallExpression,
            factory.createIdentifier(functionName),
            call.typeArguments,
            [contextArg, prompt]
        );
        returnStatement = factory.createReturnStatement(updatedCall);
    } else if (isCall) {
        // Extract receiver from agent.call or agent.callPro
        const originalCall = call as ts.CallExpression;
        let receiver: ts.Expression;

        // For callPro`text`(config), the expression is the tagged template
        if (ts.isTaggedTemplateExpression(originalCall.expression)) {
            receiver = (originalCall.expression.tag as ts.PropertyAccessExpression).expression;
        } else {
            // For regular call("prompt", scope, config)
            receiver = (originalCall.expression as ts.PropertyAccessExpression).expression;
        }

        const { prompt, config } = extractArgumentsFromCall(factory, originalCall, promptTemplate);
        const contextArg = createMagicContextObject(factory, docString);

        const callArgs = config ? [contextArg, prompt, config] : [contextArg, prompt];

        const methodCall = factory.createCallExpression(
            factory.createPropertyAccessExpression(receiver, factory.createIdentifier(CALL_TRANSFORMATION_NAME)),
            undefined,
            callArgs
        );
        returnStatement = factory.createReturnStatement(methodCall);
    } else {
        // Handle agentic or agenticPro
        const { prompt, config } = extractArgumentsFromCall(factory, call as ts.CallExpression, promptTemplate);
        const contextArg = createMagicContextObject(factory, docString);

        const callArgs = config ? [contextArg, prompt, config] : [contextArg, prompt];

        const updatedCall = factory.createCallExpression(factory.createIdentifier(functionName), undefined, callArgs);
        returnStatement = factory.createReturnStatement(updatedCall);
    }

    const magicStatements = buildMagicStatements(
        factory,
        dynamicImports,
        contextDecl,
        siteId,
        siteOutputType,
        promptTemplate,
        isSpawn,
        returnStatement
    );

    const arrowFunction = factory.createArrowFunction(
        needsAsync ? [factory.createModifier(ts.SyntaxKind.AsyncKeyword)] : undefined,
        undefined,
        [],
        undefined,
        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        factory.createBlock(magicStatements, true)
    );

    return factory.createCallExpression(factory.createParenthesizedExpression(arrowFunction), undefined, []);
}
