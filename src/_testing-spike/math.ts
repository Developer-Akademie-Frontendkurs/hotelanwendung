export function add(numbers: number[]): number {
    let sum = 0;

    for (const number of numbers) {
        sum += number;
    }
    return sum;
}

export function subtract(a: number, b: number): number {
    return a - b;
}
