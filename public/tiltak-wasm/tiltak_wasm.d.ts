declare namespace wasm_bindgen {
	/* tslint:disable */
	/* eslint-disable */
	/**
	 * Parse a PTN string, annotate each move with `'` (tak) or `"` (tinue) where applicable,
	 * and return the annotated PTN. Any existing tak/tinue annotations are replaced.
	 *
	 * `tinue_nodes` controls how many proof-search iterations to run per position
	 * when checking for tinue. Higher values are more accurate but slower.
	 * Defaults to 500 if not provided.
	 */
	export function annotate_ptn(ptn: string, tinue_nodes?: number | null): string;
	/**
	 * Check whether the position described by `tps` is "in tak" — the player who
	 * just moved has an immediate winning road move available on their next turn.
	 * `size` must be 4, 5, or 6.
	 * Returns `true` if the position is in tak, `false` otherwise.
	 * Returns an error if the TPS string cannot be parsed.
	 */
	export function is_tak(tps: string, size: number): boolean;
	/**
	 * Check whether the position described by `tps` is tinue — the player who
	 * just moved has a forced road win regardless of the opponent's play.
	 * `max_nodes` limits the proof-search budget; higher values are more accurate
	 * but slower. Returns `null` if the result could not be determined within
	 * the node budget.
	 */
	export function is_tinue(tps: string, size: number, max_nodes: number): boolean | undefined;
	/**
	 * Start the TEI engine. Returns a callback that accepts one line of TEI input at a time.
	 * The `output_callback` receives one line of TEI output at a time.
	 */
	export function start_engine(output_callback: Function): Function;
	
}

declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly annotate_ptn: (a: number, b: number, c: number) => [number, number, number, number];
  readonly is_tak: (a: number, b: number, c: number) => [number, number, number];
  readonly is_tinue: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly start_engine: (a: any) => any;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly _dyn_core__ops__function__Fn__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hde031b271b30aafa: (a: number, b: number, c: number, d: number) => void;
  readonly closure132_externref_shim: (a: number, b: number, c: any) => void;
  readonly __wbindgen_start: () => void;
}

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
declare function wasm_bindgen (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
