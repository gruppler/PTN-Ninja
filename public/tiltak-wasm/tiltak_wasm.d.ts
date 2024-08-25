declare namespace wasm_bindgen {
	/* tslint:disable */
	/* eslint-disable */
	/**
	* Start the engine, which will run asynschronously in the background until it crashes
	*
	* @param {function(string): void} output_callback - Callback that receives tei output line by line
	* @return {function(string): void} - Send one line of tei input to the engine
	*/
	export function start_engine(output_callback: Function): any;
	
}

declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly start_engine: (a: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly _dyn_core__ops__function__Fn__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h22cc4d5ac9747ad9: (a: number, b: number, c: number, d: number) => void;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hd894afd280c5d257: (a: number, b: number, c: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly wasm_bindgen__convert__closures__invoke2_mut__h035c2a7c04ebf686: (a: number, b: number, c: number, d: number) => void;
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
