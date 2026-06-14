declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  export interface Database {
    run(sql: string, params?: any[]): Database;
    prepare(sql: string): Statement;
    exec(sql: string, params?: any[]): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, any>;
    get(params?: any[]): any[];
    getColumnNames(): string[];
    free(): boolean;
    run(params?: any[]): void;
    reset(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  function initSqlJs(config?: any): Promise<SqlJsStatic>;
  export default initSqlJs;
}
