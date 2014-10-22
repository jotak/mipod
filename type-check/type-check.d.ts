// Type definitions for type-check

declare module "type-check" {

    module typeCheck {
        export function typeCheck(type: string, input: any, options?: any): boolean;
    }

    export = typeCheck;
}
