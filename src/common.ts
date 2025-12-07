export const id = (() => {
    let currentId = 0;
    const map = new WeakMap();

    return (object: any) => {
        if (!map.has(object)) {
            map.set(object, ++currentId);
        }
        return map.get(object);
    };
})();

export const orUndefined = <T>(...args: T[]): T | undefined => {
    return args.find((arg) => arg !== undefined);
};
