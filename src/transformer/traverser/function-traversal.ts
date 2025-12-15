import { extractDocstringFromSymbol } from '@transformer/processor/processor-utils';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionMsg, FunctionPayload } from '@warpc/msg-protocol/concept/resource/function-msg';
import { DefnUID } from '@warpc/msg-protocol/kinds';
import * as ts from 'typescript';

import { TypeSubstitutionMap, deriveFunctionName, parseParameterArgument } from './traversal-utils';
import { TraversalCtx } from './traverser';

export function traverseThroughFunction(
    name: string | undefined,
    ctx: TraversalCtx,
    t: ts.Type,
    uid: DefnUID,
    typeSubstitutionMap?: TypeSubstitutionMap
): FunctionMsg {
    const { checker, traverseTSType } = ctx;
    const signatures = checker.getSignaturesOfType(t, ts.SignatureKind.Call);
    const sig = signatures[0];
    name = name ?? deriveFunctionName(t, sig);
    const symbol = t.getSymbol();
    const doc = symbol ? extractDocstringFromSymbol(symbol) : undefined;

    const argumentDescriptors = sig
        .getParameters()
        .map((param) => parseParameterArgument(param, checker, traverseTSType, undefined, typeSubstitutionMap));

    const payload: FunctionPayload = {
        name,
        doc: doc || undefined,
        arguments: argumentDescriptors,
        returnType: ClassMsg.createClassRefMsg(
            traverseTSType(
                checker.getReturnTypeOfSignature(sig),
                true,
                sig.declaration &&
                    (ts.isMethodSignature(sig.declaration) ||
                        ts.isMethodDeclaration(sig.declaration) ||
                        ts.isFunctionDeclaration(sig.declaration))
                    ? (sig.declaration as ts.SignatureDeclaration).type
                    : undefined
            ).uid
        ),
    };

    return new FunctionMsg(uid, payload);
}
