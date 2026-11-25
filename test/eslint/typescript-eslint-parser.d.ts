// The parser only publishes its types through `exports`, which `moduleResolution: node` can't see.
declare module '@typescript-eslint/parser' {
    import type { Linter } from 'eslint';
    const parser: Linter.Parser;
    export default parser;
}
