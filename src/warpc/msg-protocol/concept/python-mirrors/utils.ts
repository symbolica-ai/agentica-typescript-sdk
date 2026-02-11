export function getJsClassName(obj: any): string {
    if (typeof obj !== 'object' || obj === null) {
        throw new Error('Input must be an object');
    }
    return obj[Symbol.toStringTag] || obj.constructor?.name || 'Object';
}
export function getJsSymbolName(sym: symbol): string {
    const desc = sym.description;
    return desc ?? '';
}

export function isNumberLike(value: any): boolean {
    return +value === parseFloat(value);
}

export function isIntLike(value: any): boolean {
    return isNumberLike(value) && Number.isInteger(+value);
}
