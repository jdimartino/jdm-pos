// src/context/BusinessContext.jsx — JDM-POS
// Proveedor global de configuración del comercio

import { createContext, useContext } from 'react'
import { useBusinessSettings } from '../hooks/useBusinessSettings'

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
    const { settings, loading } = useBusinessSettings()

    const business = settings || {}

    return (
        <BusinessContext.Provider value={{ business, loading }}>
            {children}
        </BusinessContext.Provider>
    )
}

export function useBusiness() {
    return useContext(BusinessContext) || { business: {}, loading: false }
}
