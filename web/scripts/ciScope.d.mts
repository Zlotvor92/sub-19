export const DISTANCES: string[];
export const V1_REFERENCE: string[];
export const ALL_SHARDS: number;
export const V1_ALL_SHARDS: number;
export const E2E_SHARDS: number;
export const MAX_SHARDS: number;
export const TARGET_S: number;
export const ALL_RULES: Array<[RegExp, string]>;
export const CWD_READS: Record<string, string[]>;
export const PROCESS_READS: Record<string, string[]>;
export interface ModuleDeps {
  imports: Set<string>;
  exact: Set<string>;
  prefixes: Set<string>;
  anything: boolean;
  why: string[];
}
export interface Scope {
  exact: Set<string>;
  prefixes: Set<string>;
  anything: boolean;
  why: string[];
}
export interface Decision {
  mode: 'all' | 'select' | 'none';
  reasons: string[];
  static: boolean;
  e2e: boolean;
  e2eShards: number[];
  tests: 'all' | 'select' | 'none';
  testShards: number[];
  testFiles: string[];
  v1: 'all' | 'select' | 'none';
  v1Shards: number[];
  v1Files: string[];
}
export function allReason(path: string): string | null;
export function moduleDeps(path: string, code: string, files: Set<string>): ModuleDeps;
export function buildGraph(
  files: Set<string>,
  read: (f: string) => string
): Map<string, ModuleDeps>;
export function scopeOf(
  graph: Map<string, ModuleDeps>,
  entry: string,
  opts?: { importsOnly?: boolean }
): Scope;
export function isV1(webPath: string): boolean;
export function isTestFile(webPath: string): boolean;
export function decide(args: {
  changed: string[];
  files: Set<string>;
  read: (f: string) => string;
  weights?: Record<string, number>;
  force?: string | null;
}): Decision;
