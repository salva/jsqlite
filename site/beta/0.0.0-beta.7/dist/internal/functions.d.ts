export type BuiltinFunctionFlag = "builtin" | "utf8" | "constant" | "slow-changing" | "need-collation" | "inline" | "unlikely" | "like" | "case" | "typeof" | "subtype" | "length" | "byte-length";
export interface BuiltinFunctionDefinition {
    readonly name: string;
    readonly exactArities: readonly number[];
    readonly minimumArity: number | null;
    readonly maximumArity: number;
    readonly flags: readonly BuiltinFunctionFlag[];
    readonly dispatchable: boolean;
}
export declare const builtinFunctionRegistry: readonly BuiltinFunctionDefinition[];
export declare function builtinFunction(name: string): BuiltinFunctionDefinition | undefined;
export declare function builtinFunctionAccepts(definition: BuiltinFunctionDefinition, argc: number): boolean;
export declare function builtinFunctionIsPure(definition: BuiltinFunctionDefinition): boolean;
