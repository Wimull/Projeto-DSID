declare function send(name: string, args: any): Promise<any>
declare function listen(name: string, cb: (args: any) => void): () => void
declare function unlisten(name: string): void

declare global {
    interface Window {
        getServerSocket: () => Promise<string>
        ipcConnect: (
            id: string,
            func: (client: any, on: (cbs: any[]) => void) => void
        ) => void
        uuid: typeof import('uuid')
    }
}
