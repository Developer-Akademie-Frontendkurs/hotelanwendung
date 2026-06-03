// Arrange
// Act
// Assert
import { describe, it, expect } from 'vitest';
import { add, subtract } from './math';

describe('add()', () => {
    it('it should summarize all numbers in an array', () => {
        // Arrange
        const numbers = [1, 2, 3];

        // Act
        const sum = add(numbers);

        console.log(sum);

        // Assert
        const expectedResult = numbers.reduce((preValue, curValue) => preValue + curValue, 0);
        console.log('expected result: ', expectedResult);
        expect(sum).toBe(expectedResult);
    });
});

describe('subtract()', () => {
    it('should substract a number from another', () => {
        const a = 10;
        const b = 5;

        const result = subtract(a, b);

        expect(result).toBe(5);
    });
});
