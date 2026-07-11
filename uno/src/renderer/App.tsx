import React, { useEffect, useState } from 'react'
// Suppress TypeScript error for side-effect CSS import when no declaration is present
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: TS2307
import './index.css'

export default function App() {
    const [connected, isConnected] = useState(false)
    //@ts-ignore
    listen('ready', () => {
        isConnected(true)
    })
    useEffect(() => {
        if (!connected) {
            return
        } else {
            //@ts-ignore
            send('ring-ring', []).then((result) => {
                console.log('result from ring-ring:', result)
            })
        }
    }, [connected])
    return (
        <div>
            <h1>App</h1>
        </div>
    )
}
