import { ConceptMsg, NoDefMsg, RefMsg } from '@warpc/msg-protocol/concept/concept';
import { rehydrateMsg } from '@warpc/msg-protocol/concept/rehydrate';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { ConceptKind } from '@warpc/msg-protocol/kinds';

import { AgenticaError } from '@/errors';

abstract class ExceptionMsg extends ConceptMsg {
    constructor(public readonly kind: ConceptKind.ExceptionAny) {
        super(kind);
    }
}

export class ForeignExceptionMsg extends ExceptionMsg {
    constructor(
        public readonly kind: ConceptKind.Exception.Foreign,
        public readonly excp_cls: RefMsg<ClassMsg>,
        public readonly excp_args: NoDefMsg[]
    ) {
        super(kind);
    }

    static rehydrate(msg: ForeignExceptionMsg | any): ForeignExceptionMsg {
        return msg instanceof ForeignExceptionMsg
            ? (msg as ForeignExceptionMsg)
            : new ForeignExceptionMsg(
                  msg.kind,
                  rehydrateMsg<RefMsg<ClassMsg>>(msg.excp_cls),
                  msg.excp_args?.map(rehydrateMsg<NoDefMsg>) ?? []
              );
    }

    get isDef(): false {
        return false;
    }

    referentialize(): NoDefMsg {
        return this;
    }
}

export class GenericExceptionMsg extends ExceptionMsg {
    constructor(
        public readonly kind: ConceptKind.Exception.Generic,
        public readonly excp_cls_name: string,
        public readonly excp_str_args: string[],
        public readonly excp_stack: string[] = []
    ) {
        super(kind);
    }

    static rehydrate(msg: GenericExceptionMsg | any): GenericExceptionMsg {
        return msg instanceof GenericExceptionMsg
            ? (msg as GenericExceptionMsg)
            : new GenericExceptionMsg(msg.kind, msg.excp_cls_name, msg.excp_str_args);
    }

    get isDef(): false {
        return false;
    }

    referentialize(): NoDefMsg {
        return this;
    }

    static makeFromError(error: Error): GenericExceptionMsg {
        return new GenericExceptionMsg(
            ConceptKind.Exception.Generic,
            error.name ?? 'Unknown Error',
            [error.message ?? 'No error message available'],
            error.stack?.split('\n').map((line) => line.trim()) ?? []
        );
    }
}

export class InternalErrorMsg extends ExceptionMsg {
    constructor(
        public readonly kind: ConceptKind.Exception.Internal,
        public readonly error: string
    ) {
        super(kind);
    }

    get isDef(): false {
        return false;
    }

    referentialize(): NoDefMsg {
        return this;
    }

    static rehydrate(msg: InternalErrorMsg | any): InternalErrorMsg {
        return msg instanceof InternalErrorMsg ? (msg as InternalErrorMsg) : new InternalErrorMsg(msg.kind, msg.error);
    }
}

export class InternalError extends AgenticaError {
    constructor(public readonly error: string) {
        super(error);
    }
}
