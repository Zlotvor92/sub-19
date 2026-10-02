import { fmtNum } from '../../domain/format';

/** Razlika sa znakom i jednom decimalom (`+1,5`, `-0,3`, `0`). */
export const sign = (n: number): string => `${n > 0 ? '+' : ''}${fmtNum(n, 1)}`;
