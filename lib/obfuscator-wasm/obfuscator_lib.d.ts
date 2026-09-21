/* tslint:disable */
/* eslint-disable */

/**
 * Get obfuscator version
 */
export function get_version(): string;

/**
 * Main WASM entry point for obfuscating multiple files
 */
export function obfuscate_files(request_json: string): string;

/**
 * Single file obfuscation for simpler use cases
 */
export function obfuscate_single_file(filename: string, content: string, encryption_key?: string | null): string;
