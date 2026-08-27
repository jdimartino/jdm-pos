// src/hooks/useFirestoreStatus.js
// Monitorea la conexión real con Firestore usando metadata de snapshots
import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useFirestoreStatus() {
    const [status, setStatus] = useState('connected')
    const prevStatus = useRef(status)

    useEffect(() => {
        const ref = doc(db, 'counters', 'invoices')

        const unsubscribe = onSnapshot(
            ref,
            { includeMetadataChanges: true },
            (snapshot) => {
                const fromCache = snapshot.metadata.fromCache
                const hasPendingWrites = snapshot.metadata.hasPendingWrites

                if (fromCache && !hasPendingWrites) {
                    setStatus('offline')
                } else if (hasPendingWrites) {
                    setStatus('syncing')
                } else {
                    setStatus('connected')
                }
            },
            (error) => {
                console.error('Firestore health check error:', error)
                setStatus('error')
            }
        )

        return unsubscribe
    }, [])

    useEffect(() => {
        prevStatus.current = status
    }, [status])

    return { status, prevStatus: prevStatus.current }
}
