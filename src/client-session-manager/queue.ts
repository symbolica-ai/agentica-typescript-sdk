/**
 * Simple queue implementation that matches Python asyncio.Queue behavior
 */
export class Queue<T> {
    private items: T[] = [];
    private waiters: Array<{ resolve: (value: T) => void; reject: (err: Error) => void }> = [];
    private closed: boolean = false;

    put(item: T) {
        if (this.closed) return;
        const waiter = this.waiters.shift();
        if (waiter !== undefined) {
            waiter.resolve(item);
        } else {
            this.items.push(item);
        }
    }

    async get(): Promise<T> {
        const item = this.items.shift();
        if (item !== undefined) {
            return item;
        }

        return new Promise<T>((resolve, reject) => {
            if (this.closed) {
                reject(new Error('Queue closed'));
            } else {
                this.waiters.push({ resolve, reject });
            }
        });
    }

    close() {
        this.closed = true;
        for (const waiter of this.waiters) {
            waiter.reject(new Error('Queue closed'));
        }
        this.waiters = [];
    }

    get empty(): boolean {
        return this.items.length === 0;
    }
}
