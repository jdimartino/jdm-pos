// src/hooks/useOnlineStatus.js
import { useState, useEffect, useRef } from 'react'
import { useFirestoreStatus } from './useFirestoreStatus'

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const { status: firestoreStatus } = useFirestoreStatus()
    const prevFirestore = useRef(firestoreStatus)

    useEffect(() => {
        const goOnline = () => setIsOnline(true)
        const goOffline = () => setIsOnline(false)
        window.addEventListener('online', goOnline)
        window.addEventListener('offline', goOffline)
        return () => {
            window.removeEventListener('online', goOnline)
            window.removeEventListener('offline', goOffline)
        }
    }, [])

    // Compute combined status
    let connectionStatus = 'connected'
    if (!isOnline) {
        connectionStatus = 'offline'
    } else if (firestoreStatus === 'error') {
        connectionStatus = 'error'
    } else if (firestoreStatus === 'offline') {
        connectionStatus = 'offline'
    } else if (firestoreStatus === 'syncing') {
        connectionStatus = 'syncing'
    }

    const result = { isOnline, firestoreStatus, connectionStatus, prevStatus: prevFirestore.current }

    useEffect(() => {
        prevFirestore.current = firestoreStatus
    }, [firestoreStatus])

    return result
}
